#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseTrace } = require('./parser');
const { analyzeTrace } = require('./analyzer');
const { writeReports } = require('./report');

function usage() {
  console.log(`MCP Tool-Call Truth Monitor

Usage: node src/cli.js <trace-file> [--out-dir DIR] [--json] [--export-fixture PATH]

Options:
  <trace-file>        Path to trace file (agent-inspect JSONL or MCP capture JSON)
  --out-dir DIR       Output directory for report.html and report.json (default: ./truth-report)
  --json              Also print JSON report to stdout
  --export-fixture PATH  Write normalized replayable fixture JSON to this path
  -h, --help          Show this help
`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let input = null;
  let outDir = path.join(process.cwd(), 'truth-report');
  let jsonStdout = false;
  let exportFixture = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-dir') outDir = args[++i];
    else if (a === '--json') jsonStdout = true;
    else if (a === '--export-fixture') exportFixture = args[++i];
    else if (!a.startsWith('-') && !input) input = a;
    else { console.error(`Unknown argument: ${a}`); usage(); process.exit(1); }
  }

  if (!input) { console.error('Missing trace file.'); usage(); process.exit(1); }

  const absInput = path.resolve(input);
  if (!fs.existsSync(absInput) || !fs.statSync(absInput).isFile()) {
    console.error(`Trace not found: ${absInput}`);
    process.exit(1);
  }

  console.log(`Parsing: ${absInput}`);
  const { events, source, format } = parseTrace(absInput);
  console.log(`Format: ${format} · Events: ${events.length}`);

  if (events.length === 0) {
    console.error('No parsable events found in trace.');
    process.exit(1);
  }

  const analysis = analyzeTrace(events);
  const written = writeReports(analysis, { outDir, traceFile: absInput, exportFixturePath: exportFixture });

  console.log(`\nAnalyzed ${path.basename(source)} (${format})`);
  console.log(`Tool calls: ${analysis.summary.totalCalls}`);
  console.log(`Mismatches: ${analysis.summary.mismatches}`);
  console.log(`Clean matches: ${analysis.summary.cleanMatches}`);
  console.log(`\nHTML report: ${written.htmlPath}`);
  console.log(`JSON report: ${written.jsonPath}`);
  if (written.fixturePath) console.log(`Fixture exported: ${written.fixturePath}`);

  if (jsonStdout) {
    console.log('\n--- JSON REPORT ---');
    console.log(JSON.stringify(written.payload, null, 2));
  }

  // Exit non-zero if mismatches found (useful for CI gating)
  process.exit(analysis.summary.mismatches > 0 ? 2 : 0);
}

if (require.main === module) {
  try { main(process.argv); } catch (err) { console.error(err && err.stack ? err.stack : String(err)); process.exit(1); }
}

module.exports = { main };