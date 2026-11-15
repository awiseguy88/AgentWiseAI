import { loadTrace, parseTrace, analyze, makeReport } from './lib.js';
import { writeJsonReport, writeHtmlReport } from './report.js';

function parseArgs(argv) {
  const args = { input: null, out: null, json: false, html: false, maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' && argv[i+1]) { args.input = argv[++i]; continue; }
    if (a === '--out' && argv[i+1]) { args.out = argv[++i]; continue; }
    if (a === '--json') { args.json = true; continue; }
    if (a === '--html') { args.html = true; continue; }
    if (a === '--max-step-ms' && argv[i+1]) { args.maxStepMs = Number(argv[++i]); continue; }
    if (a === '--max-step-tokens' && argv[i+1]) { args.maxStepTokens = Number(argv[++i]); continue; }
    if (a === '--loop-repeat' && argv[i+1]) { args.loopRepeat = Number(argv[++i]); continue; }
    if (a === '--help' || a === '-h') {
      printUsage(); process.exit(0);
    }
    console.error(`Unknown argument: ${a}`);
    printUsage(); process.exit(2);
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node src/cli.js --input <trace.json|trace.jsonl> [--out dir] [--json] [--html]
  [--max-step-ms N] [--max-step-tokens N] [--loop-repeat N]`);
}

export default async function main(argv) {
  const args = parseArgs(argv);
  if (!args.input) {
    console.error('Error: --input is required');
    printUsage(); return 2;
  }
  let data;
  try {
    const lt = loadTrace(args.input);
    data = lt.data;
  } catch (e) {
    console.error(`Error reading trace: ${e.message}`);
    return 1;
  }
  let steps;
  try {
    steps = parseTrace(data);
  } catch (e) {
    console.error(`Error parsing trace: ${e.message}`);
    return 1;
  }
  const analysis = analyze(steps, {
    maxStepMs: args.maxStepMs,
    maxStepTokens: args.maxStepTokens,
    loopRepeat: args.loopRepeat
  });
  const report = makeReport(steps, analysis, { source: args.input });
  const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19).replace('T','_');
  const outDir = args.out || `reports/${ts}`;
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  if (!args.json && !args.html) args.html = true;
  if (args.json) written.push(writeJsonReport(report, outDir));
  if (args.html) written.push(writeHtmlReport(report, outDir));
  console.log(`Agent Drift Monitor: ${steps.length} steps, ${analysis.alerts.length} alerts`);
  console.log(`Report(s): ${written.join(', ')}`);
  return 0;
}

import fs from 'node:fs';

if (process.argv[1] && process.argv[1].endsWith('src/cli.js')) {
  main(process.argv).then(code => process.exit(code || 0)).catch(e => { console.error(e); process.exit(1); });
}
