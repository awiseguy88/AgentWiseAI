#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.resolve(ROOT, 'src/cli.js');
const OUT_GOOD = path.resolve(ROOT, 'drift-report-good');
const OUT_DRIFTED = path.resolve(ROOT, 'drift-report-drifted');
const BASELINE = path.resolve(ROOT, 'tests/fixtures/baseline.frozen.json');
const ALERT_LOG = path.resolve(ROOT, 'data', 'alert-test.log');

let failures = 0;

function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); failures++; }
  else { console.log(`ok: ${msg}`); }
}

function runCli(args, opts = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      ...opts,
    });
    return { code: 0, stdout: out };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ? e.stdout.toString() : '', stderr: e.stderr ? e.stderr.toString() : '' };
  }
}

function cleanup() {
  for (const d of [OUT_GOOD, OUT_DRIFTED]) {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  }
  if (fs.existsSync(ALERT_LOG)) fs.rmSync(ALERT_LOG, { force: true });
}
cleanup();

// 1. Baseline-regeneration check: mock-good against existing frozen baseline -> exit 0, 30 pass, no drift
const good = runCli(['run', '--alias', 'live-alias', '--adapter', 'mock:tests/fixtures/mock-good.json',
  '--out-dir', OUT_GOOD, '--no-exit-code']);
console.log('--- mock-good run stdout ---'); console.log(good.stdout.slice(0, 1200));
assert(good.code === 0, 'mock-good run exits 0 (no drift against baseline)');
assert(fs.existsSync(path.join(OUT_GOOD, 'report.json')), 'report.json written');
assert(fs.existsSync(path.join(OUT_GOOD, 'report.html')), 'report.html written');
const goodReport = JSON.parse(fs.readFileSync(path.join(OUT_GOOD, 'report.json'), 'utf8'));
assert(goodReport.summary.total === 30, `baseline total 30 (got ${goodReport.summary.total})`);
assert(goodReport.summary.pass_count === 30, `baseline pass_count 30 (got ${goodReport.summary.pass_count})`);
assert(goodReport.summary.regressed_count === 0, `baseline regressed_count 0 (got ${goodReport.summary.regressed_count})`);
assert(goodReport.threshold_breached === false, 'baseline not breached');

// 2. Regression check: mock-drifted against same baseline -> non-zero exit, exactly 2 regressed tasks
const drift = runCli(['run', '--alias', 'live-alias', '--adapter', 'mock:tests/fixtures/mock-drifted.json',
  '--out-dir', OUT_DRIFTED]);
console.log('--- mock-drifted run stdout ---'); console.log(drift.stdout.slice(0, 1500));
assert(drift.code !== 0, 'mock-drifted run exits non-zero (drift detected)');
const driftReport = JSON.parse(fs.readFileSync(path.join(OUT_DRIFTED, 'report.json'), 'utf8'));
assert(driftReport.summary.regressed_count === 2, `drift regressed_count exactly 2 (got ${driftReport.summary.regressed_count})`);
assert(driftReport.threshold_breached === true, 'drift threshold breached');
assert(driftReport.summary.pass_count === 28, `drift pass_count 28 (got ${driftReport.summary.pass_count})`);
const regressedIds = driftReport.results.filter(r => r.regressed).map(r => r.task_id).sort();
assert(JSON.stringify(regressedIds) === JSON.stringify(['T-07', 'T-15']), `regressed tasks T-07,T-15 (got ${regressedIds.join(',')})`);
// per-task diff printed to stdout
assert(drift.stdout.includes('T-07') && drift.stdout.includes('T-15'), 'per-task diffs printed to stdout');
// diff content: T-07 date arg changed
const t07 = driftReport.results.find(r => r.task_id === 'T-07');
assert(t07 && t07.diff && t07.diff.changes.some(c => c.kind === 'tool_arg' && c.arg === 'schedule_deploy.date'), 'T-07 date arg diff flagged');
// T-15 refusal replaced by tool call
const t15 = driftReport.results.find(r => r.task_id === 'T-15');
assert(t15 && t15.regressed === true, 'T-15 flagged regressed (refusal -> hallucinated tool call)');

// 3. JSON report structure sanity
assert(typeof driftReport.id === 'string' && driftReport.id.length > 0, 'run id present');
assert(typeof driftReport.at === 'string', 'run timestamp present');
assert(Array.isArray(driftReport.results) && driftReport.results.length === 30, 'results array 30');
assert(driftReport.results.every(r => r.task_id && r.title && r.status !== undefined), 'each result has id/title/status');
assert(goodReport.results.every(r => r.diff && r.baseline), 'baseline embedded in results');

// 4. Scheduler/persistence: appendRun via CLI run stores timestamped run; series includes run
const stored = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'data/index.json'), 'utf8'));
assert(Array.isArray(stored.runs) && stored.runs.length >= 1, 'at least one run persisted');
const last = stored.runs[0];
assert(last.alias === 'live-alias', 'run alias stored');
assert(typeof last.at === 'string', 'run timestamp stored');
assert(last.regressed_count === 2 || last.regressed_count === 0, 'run summary stored');

// 5. Baseline freeze + regenerate: baseline command freezes to tests/fixtures/baseline.frozen.json
const fresh = runCli(['baseline', '--adapter', 'mock:tests/fixtures/mock-good.json', '--out-dir', OUT_GOOD]);
assert(fresh.code === 0, 'baseline command exits 0');
assert(fs.existsSync(BASELINE), 'baseline.frozen.json written');
// re-run against freshly frozen baseline -> still 30 pass exit 0
const again = runCli(['run', '--adapter', 'mock:tests/fixtures/mock-good.json', '--out-dir', OUT_GOOD, '--no-exit-code']);
assert(again.code === 0, 're-run against fresh baseline exits 0');
const againReport = JSON.parse(fs.readFileSync(path.join(OUT_GOOD, 'report.json'), 'utf8'));
assert(againReport.summary.pass_count === 30, 'fresh baseline re-run: 30 pass');

// 6. Alert routing via CLI with alerts-file writes to file channel
if (fs.existsSync(ALERT_LOG)) fs.rmSync(ALERT_LOG, { force: true });
const alertCfg = path.resolve(ROOT, 'tests/fixtures/alerts-test.json');
fs.writeFileSync(alertCfg, JSON.stringify({ alerts: [{ type: 'file', target: ALERT_LOG }], alert_cooldown_ms: 0 }));
const alerted = runCli(['run', '--adapter', 'mock:tests/fixtures/mock-drifted.json',
  '--out-dir', OUT_DRIFTED, '--no-exit-code', '--alerts-file', alertCfg]);
const alertLines = fs.existsSync(ALERT_LOG) ? fs.readFileSync(ALERT_LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
assert(alertLines.length >= 1, 'alert fired to file channel');
fs.rmSync(alertCfg, { force: true });

// 7. tasks command lists 30 tasks
const tasksOut = runCli(['tasks']);
assert(tasksOut.stdout.split('\n').filter(l => l.startsWith('  T-')).length === 30, 'tasks command lists 30 tasks');

cleanup();
console.log(`\n${failures === 0 ? 'ALL SMOKE TESTS PASSED' : failures + ' SMOKE TEST(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
