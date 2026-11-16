#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadBundledTasks, extractRepoTasks } = require('./tasks');
const { runTask } = require('./runner');
const { buildReport, writeReport } = require('./report');

function usage() {
  console.log(`Usage: llm-model-migration-watch --current <adapter> --candidate <adapter> [--candidate <adapter>] [options]

Options:
  --suite <path>            Repo/project path for extracting repo tasks (default: cwd)
  --tasks <bundled|repo|all>  Task suite scope (default: all)
  --current <adapter>       Current/baseline model adapter (required)
  --candidate <adapter>     Candidate model adapter (repeatable, required >=1)
  --out-dir <dir>           Output directory (default: ./llm-migration-report)
  --json                    Print report JSON to stdout
  --pricing <file.json>     Pricing {input_per_million, output_per_million}
  --monthly-requests <n>    Requests/month for projected savings (default: 100000)
  --fail-on-no-go           Exit 1 if any candidate is do_not_migrate
  -h, --help                Show help

Adapters:
  mock:<file.json>          Offline deterministic responses keyed by task id
  cmd:<shell command>       Reads prompt on stdin, expects JSON on stdout
  ollama:<model>@<url>      Calls Ollama /api/generate (opt-in network)
`);
}

function parseArgs(argv) {
  const opts = { suite: process.cwd(), tasks: 'all', current: null, candidates: [], outDir: './llm-migration-report', json: false, pricing: null, monthlyRequests: 100000, failOnNoGo: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { opts.help = true; }
    else if (a === '--suite') opts.suite = argv[++i];
    else if (a === '--tasks') opts.tasks = argv[++i];
    else if (a === '--current') opts.current = argv[++i];
    else if (a === '--candidate') opts.candidates.push(argv[++i]);
    else if (a === '--out-dir') opts.outDir = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--pricing') opts.pricing = JSON.parse(fs.readFileSync(path.resolve(argv[++i]), 'utf8'));
    else if (a === '--monthly-requests') opts.monthlyRequests = Number(argv[++i]);
    else if (a === '--fail-on-no-go') opts.failOnNoGo = true;
    else { console.error(`Unknown argument: ${a}`); opts.bad = true; }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { usage(); process.exit(0); }
  if (opts.bad) { usage(); process.exit(2); }
  if (!opts.current || opts.candidates.length === 0) {
    console.error('Error: --current and at least one --candidate are required.');
    usage();
    process.exit(2);
  }
  const suitePath = path.resolve(opts.suite);
  if (opts.tasks !== 'bundled' && !fs.existsSync(suitePath)) {
    console.error(`Error: suite path does not exist: ${suitePath}`);
    process.exit(2);
  }
  const toolRoot = path.resolve(__dirname, '..');
  let tasks = [];
  if (opts.tasks === 'bundled' || opts.tasks === 'all') tasks = tasks.concat(loadBundledTasks(toolRoot));
  if (opts.tasks === 'repo' || opts.tasks === 'all') tasks = tasks.concat(extractRepoTasks(suitePath));
  // de-duplicate by id
  const seen = new Set();
  tasks = tasks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  if (!tasks.length) {
    console.error('Error: no tasks found for the selected suite.');
    process.exit(2);
  }

  const models = [opts.current, ...opts.candidates];
  const resultsByModel = {};
  for (const model of models) {
    const results = [];
    for (const task of tasks) {
      results.push(await runTask(task, model));
    }
    resultsByModel[model] = results;
  }

  const report = buildReport({
    current: opts.current,
    candidates: opts.candidates,
    tasks,
    resultsByModel,
    pricing: opts.pricing,
    opts: { monthlyRequests: opts.monthlyRequests },
  });

  const outDir = path.resolve(opts.outDir);
  writeReport(report, outDir);

  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`LLM Model Migration Watch report written to ${outDir}`);
    console.log(`Tasks: ${report.tasks_total} | Current pass rate: ${(report.current.pass_rate*100).toFixed(1)}%`);
    for (const c of report.candidates) {
      console.log(`Candidate ${c.model}: pass ${(c.pass_rate*100).toFixed(1)}%, avg cost $${c.average_cost_usd}, avg latency ${c.average_latency_ms}ms, verdict=${c.recommendation.verdict}${c.recommendation.do_not_migrate ? ' (do not migrate)' : ''}`);
    }
  }

  if (opts.failOnNoGo && report.overall.any_do_not_migrate) process.exit(1);
  process.exit(0);
}

main().catch(err => { console.error(err && err.stack || err); process.exit(2); });