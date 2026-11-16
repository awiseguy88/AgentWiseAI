#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadTasks } = require('./tasks');
const { runTask } = require('./runner');
const { buildReport, writeReport } = require('./report');
const { DEFAULT_CLOUD_PRICING } = require('./cost');

function usage() {
  console.log(`Usage: local-model-fit-checker --repo <path> --local <adapter> --cloud <adapter> [options]

Adapters:
  mock:<responses.json>        Offline deterministic responses keyed by task id
  cmd:<shell command>          Runs command with prompt on stdin, prints JSON {output,tokens_in,tokens_out}
  ollama:<model>@<baseUrl>     Ollama generate API (network; optional)

Options:
  --tasks <bundled|repo|all>   Task suite (default: all)
  --out-dir <dir>              Output directory (default: ./local-model-fit-checker-report)
  --json                       Print report JSON to stdout
  --electricity-rate <n>       USD per kWh (default: 0.15)
  --local-watts <n>            Local system watts during inference (default: 150)
  --pricing <file.json>        Cloud token pricing {input_per_million, output_per_million}
  --fail-on-local-unfit        Exit 1 if overall routing is api-preferred
  -h, --help                   Show help`);
}

function parseArgs(argv) {
  const args = { tasks: 'all', outDir: './local-model-fit-checker-report', electricityRate: 0.15, localWatts: 150, json: false, failOnLocalUnfit: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a === '--local') args.local = argv[++i];
    else if (a === '--cloud') args.cloud = argv[++i];
    else if (a === '--tasks') args.tasks = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--electricity-rate') args.electricityRate = Number(argv[++i]);
    else if (a === '--local-watts') args.localWatts = Number(argv[++i]);
    else if (a === '--pricing') args.pricingFile = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--fail-on-local-unfit') args.failOnLocalUnfit = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else { console.error('Unknown argument:', a); args.error = true; }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); process.exit(0); }
  if (args.error || !args.repo || !args.local || !args.cloud) { usage(); process.exit(2); }
  const repoPath = path.resolve(args.repo);
  if (!fs.existsSync(repoPath)) { console.error('Repo path not found:', repoPath); process.exit(2); }
  let pricing = Object.assign({}, DEFAULT_CLOUD_PRICING);
  if (args.pricingFile) {
    pricing = Object.assign(pricing, JSON.parse(fs.readFileSync(path.resolve(args.pricingFile), 'utf8')));
  }
  const toolRoot = path.resolve(__dirname, '..');
  const tasks = loadTasks(toolRoot, repoPath, args.tasks);
  if (!tasks.length) { console.error('No tasks found.'); process.exit(2); }
  const localResults = [];
  const cloudResults = [];
  for (const t of tasks) {
    localResults.push(await runTask(t, args.local));
    cloudResults.push(await runTask(t, args.cloud));
  }
  const report = buildReport(tasks, localResults, cloudResults, { localWatts: args.localWatts, electricityRate: args.electricityRate, pricing });
  writeReport(report, path.resolve(args.outDir));
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(`Report written to ${path.resolve(args.outDir)} (tasks: ${report.summary.total_tasks}, routing: ${report.summary.overall_routing})`);
  if (args.failOnLocalUnfit && report.summary.overall_routing === 'api-preferred') process.exit(1);
  process.exit(0);
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(2); });
