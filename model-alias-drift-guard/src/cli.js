#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const { loadGoldenTasks, validateTasks } = require('./tasks');
const { runTask } = require('./runner');
const { freezeBaseline, saveBaseline, loadBaseline, compareRunToBaseline } = require('./baseline');
const { buildReport, writeReport, printSummary } = require('./report');
const { appendRun, listRuns, getRun, series } = require('./storage');
const { evaluateAlerts } = require('./alerts');
const { startSchedule, nextRun } = require('./scheduler');

const APP_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.resolve(APP_ROOT, 'data');
const DEFAULT_PORT = process.env.DRIFT_GUARD_PORT || 3030;

function usage() {
  console.log(`Usage: model-alias-drift-guard <command> [options]

Commands:
  run              Run the golden suite against the live model alias and emit a drift report
  baseline         Freeze a baseline from a stored run id or a fresh run
  serve            Start the web dashboard + JSON API
  schedule         Run the scheduler (cron) loop
  tasks            List bundled golden tasks
  smoke            Run offline smoke tests
  help             Show this help

Global options:
  --data-dir <dir>     Persistent run storage dir (default: ./data)
  --alias <name>       Model alias name (default: live-alias or DRIFT_GUARD_ALIAS)
  --adapter <spec>     Model adapter spec (default: mock:tests/fixtures/mock-good.json)
                       mock:<file> | cmd:<shell> | openai:<model>@<base> | ollama:<model>@<base>
  --tasks-dir <dir>    Extra user task dir (JSON files)
  --tasks-file <file>  Extra task file (repeatable)
  --thresholds <file>  Threshold JSON {min_pass_rate,max_regressed,max_drift_score,alert_cooldown_ms}
  --baseline <file>    Baseline JSON file (default: tests/fixtures/baseline.frozen.json)
  --freeze-baseline    Freeze a baseline after run and write to --baseline path
  --out-dir <dir>      Report output dir (default: ./drift-report)
  --no-exit-code       Exit 0 even when thresholds breach
  --json               Print report JSON to stdout
  --port <n>           Dashboard port (default 3030 or DRIFT_GUARD_PORT)
  --cron <expr>        Cron expression for scheduler (default: 0 2 * * *)
  --alerts-file <file> Alert config JSON {alerts:[{type,target}], alert_cooldown_ms}
`);
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && opts[k] !== true) {
        opts[k] = next; i++;
      } else {
        opts[k] = true;
      }
    } else {
      opts._ = opts._ || []; opts._.push(a);
    }
  }
  return opts;
}

function readJsonFile(f, fallback) {
  try { return JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')); } catch { return fallback; }
}

async function runSuite(opts) {
  const alias = opts.alias || process.env.DRIFT_GUARD_ALIAS || 'live-alias';
  const adapter = opts.adapter || process.env.DRIFT_GUARD_ADAPTER || 'mock:tests/fixtures/mock-good.json';
  const dataDir = opts['data-dir'] || DEFAULT_DATA_DIR;
  const toolRoot = APP_ROOT;
  const tasks = loadGoldenTasks({
    userTasksDir: opts['tasks-dir'],
    taskFiles: opts['tasks-file'],
  });
  const errs = validateTasks(tasks);
  if (errs.length) { console.error('Invalid tasks:'); errs.forEach(e => console.error(' -', e)); process.exit(2); }

  const thresholds = readJsonFile(opts.thresholds, { min_pass_rate: 1.0, max_regressed: 0 });
  const baselinePath = opts.baseline || path.resolve(toolRoot, 'tests/fixtures/baseline.frozen.json');
  const baseline = loadBaseline(baselinePath);

  const results = [];
  let totalLatency = 0, totalCost = 0;
  for (const t of tasks) {
    const r = await runTask(t, adapter, { temperature: 0 });
    results.push(r);
    if (r.current) { totalLatency += r.current.latency_ms || 0; totalCost += r.cost_usd || 0; }
  }

  const comparison = compareRunToBaseline({ results }, baseline, thresholds);
  const n = results.length || 1;
  const summary = {
    total: results.length,
    pass_count: comparison.summary.pass_count,
    fail_count: comparison.summary.fail_count,
    regressed_count: comparison.summary.regressed_count,
    pass_rate: comparison.summary.pass_rate,
    avg_drift_score: comparison.summary.avg_drift_score,
    avg_latency_ms: Math.round(totalLatency / n),
    total_cost_usd: Number(totalCost.toFixed(8)),
  };

  const run = {
    id: null,
    alias,
    at: new Date().toISOString(),
    adapter,
    thresholds,
    baseline_id: baseline ? baseline.frozen_at : null,
    results,
    summary,
    threshold_breached: comparison.threshold_breached,
    threshold_reasons: comparison.threshold_reasons,
  };

  if (opts['freeze-baseline']) {
    const b = freezeBaseline(run);
    saveBaseline(b, baselinePath);
    run.baseline_id = b.frozen_at;
  }

  // persist run first so run.id is set for report
  const stored = appendRun(Object.assign({}, run), dataDir);
  run.id = stored.id;

  // alerts
  const alertCfg = readJsonFile(opts['alerts-file'], null);
  if (alertCfg) {
    const alertRes = evaluateAlerts(run, alertCfg, dataDir);
    run.alerted = alertRes.alerted;
    run.alert_results = alertRes.results;
    console.log(`alerts: ${alertRes.alerted ? 'fired' : 'not fired'} (${alertRes.reason})`);
  }

  const outDir = path.resolve(opts['out-dir'] || path.resolve(toolRoot, 'drift-report'));
  const report = buildReport(run, baseline, { thresholds });
  const written = writeReport(report, outDir);

  if (opts.json) console.log(JSON.stringify(report, null, 2));
  printSummary(report);

  if (!opts['no-exit-code'] && comparison.threshold_breached) process.exit(1);
  process.exit(0);
}

async function startServer(opts) {
  const port = Number(opts.port || DEFAULT_PORT);
  const dataDir = opts['data-dir'] || DEFAULT_DATA_DIR;
  const webRoot = path.resolve(APP_ROOT, 'web');

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${port}`);
    const pathname = u.pathname;
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
      res.end(body);
    };

    try {
      if (pathname === '/api/config') {
        const thresholds = readJsonFile(opts.thresholds, { min_pass_rate: 1.0, max_regressed: 0 });
        const alerts = readJsonFile(opts['alerts-file'], { alerts: [] });
        const baseline = loadBaseline(path.resolve(APP_ROOT, 'tests/fixtures/baseline.frozen.json'));
        send(200, JSON.stringify({
          alias: opts.alias || process.env.DRIFT_GUARD_ALIAS || 'live-alias',
          cron: opts.cron || process.env.DRIFT_GUARD_CRON || '0 2 * * *',
          thresholds,
          alerts: (alerts.alerts || []),
          baseline_id: baseline ? baseline.frozen_at : null,
          baseline_tasks: baseline ? baseline.task_count : 0,
          has_baseline: !!baseline,
        }));
      } else if (pathname === '/api/runs') {
        const limit = u.searchParams.get('limit');
        send(200, JSON.stringify({ runs: listRuns(dataDir, limit ? Number(limit) : 200) }));
      } else if (pathname === '/api/runs/baseline') {
        const basePath = path.resolve(APP_ROOT, 'tests/fixtures/baseline.frozen.json');
        if (!fs.existsSync(basePath)) send(404, JSON.stringify({ error: 'no baseline' }));
        else send(200, JSON.stringify(loadBaseline(basePath)));
      } else if (pathname === '/api/baseline') {
        const basePath = path.resolve(APP_ROOT, 'tests/fixtures/baseline.frozen.json');
        if (!fs.existsSync(basePath)) send(404, JSON.stringify({ error: 'no baseline' }));
        else send(200, JSON.stringify(loadBaseline(basePath)));
      } else if (pathname === '/api/series') {
        const alias = u.searchParams.get('alias');
        const limit = u.searchParams.get('limit');
        send(200, JSON.stringify({ points: series(alias, limit ? Number(limit) : 120, dataDir) }));
      } else if (pathname === '/api/tasks') {
        const tasks = loadGoldenTasks();
        send(200, JSON.stringify({ tasks: tasks.map(t => ({ id: t.id, title: t.title, tags: t.tags })) }));
      } else if (pathname.startsWith('/api/runs/') && req.method === 'GET') {
        const id = pathname.split('/').pop();
        if (!id || id === 'baseline') { send(404, JSON.stringify({ error: 'not found' })); return; }
        const run = getRun(id, dataDir);
        if (!run) send(404, JSON.stringify({ error: 'run not found' }));
        else send(200, JSON.stringify({ run }));
      } else if (pathname === '/api/runs' && req.method === 'POST') {
        await runSuite(Object.assign({}, opts, { 'no-exit-code': true }));
        const runs = listRuns(dataDir, 5);
        send(200, JSON.stringify({ ok: true, runs: runs.slice(0, 1) }));
      } else if (pathname === '/api/alerts/test' && req.method === 'POST') {
        const alertCfg = readJsonFile(opts['alerts-file'], { alerts: [] });
        const fakeRun = { id: 'test-'+Date.now(), alias: opts.alias || 'live-alias', at: new Date().toISOString(),
          threshold_breached: true, threshold_reasons: ['test alert'], summary: { pass_count: 28, fail_count: 0, regressed_count: 2, pass_rate: 0.933 } };
        const resAlert = evaluateAlerts(fakeRun, alertCfg, dataDir);
        send(200, JSON.stringify({ ok: true, alerted: resAlert.alerted, results: resAlert.results }));
      } else if (pathname === '/' || pathname === '/index.html') {
        const index = path.join(webRoot, 'index.html');
        send(200, fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '<h1>Drift Guard</h1><p>Dashboard not built yet.</p>', 'text/html');
      } else if (pathname.startsWith('/static/') || pathname.startsWith('/styles.css') || pathname.startsWith('/app.js')) {
        const file = path.join(webRoot, pathname.startsWith('/static/') ? pathname.slice(1) : pathname.slice(1));
        const ext = path.extname(file);
        const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
        if (fs.existsSync(file)) send(200, fs.readFileSync(file, 'utf8'), type);
        else send(404, 'not found');
      } else {
        send(404, JSON.stringify({ error: 'not found' }));
      }
    } catch (e) {
      send(500, JSON.stringify({ error: e && e.message }));
    }
  });

  server.listen(port, () => console.log(`Drift Guard dashboard listening on http://localhost:${port}`));
  return server;
}

async function main() {
  const opts = parseArgs(process.argv);
  const cmd = opts._[0];
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') { usage(); process.exit(0); }

  if (cmd === 'tasks') {
    const tasks = loadGoldenTasks();
    console.log(`${tasks.length} bundled golden tasks:`);
    for (const t of tasks) console.log(`  ${t.id.padEnd(6)} ${t.title}`);
    process.exit(0);
  }

  if (cmd === 'smoke') {
    const smoke = path.resolve(APP_ROOT, 'tests/smoke.js');
    require(smoke);
    return;
  }

  if (cmd === 'serve') { await startServer(opts); return; }
  if (cmd === 'schedule') {
    const cron = opts.cron || process.env.DRIFT_GUARD_CRON || '0 2 * * *';
    console.log(`scheduler cron: ${cron}, next run ${nextRun(cron)}`);
    const runFn = async () => {
      await runSuite(Object.assign({}, opts, { 'no-exit-code': true, json: false }));
      console.log('scheduled run complete', new Date().toISOString());
    };
    const sched = startSchedule(cron, runFn, { log: m => console.log('[sched]', m) });
    process.on('SIGINT', () => { sched.stop(); process.exit(0); });
    process.on('SIGTERM', () => { sched.stop(); process.exit(0); });
    return;
  }

  if (cmd === 'run' || cmd === 'baseline') {
    if (cmd === 'baseline') {
      // freeze baseline from a fresh run (default adapter mock-good) unless --from-run
      const runSuiteOpts = Object.assign({}, opts, { 'freeze-baseline': true, 'no-exit-code': true });
      await runSuite(runSuiteOpts);
      console.log('baseline frozen at', opts.baseline || path.resolve(APP_ROOT, 'tests/fixtures/baseline.frozen.json'));
      process.exit(0);
    }
    await runSuite(opts);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exit(2);
}

main().catch(err => { console.error(err && err.stack || err); process.exit(2); });
