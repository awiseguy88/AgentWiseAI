#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readTranscript } = require('./parser');
const { analyze } = require('./verifier');
const { writeReports } = require('./report');
const { loadSnippets } = require('./snippets');

function usage() {
  console.log(`Usage: node src/cli.js <transcript-file> [--out-dir DIR] [--json]\n\nOptions:\n  --out-dir DIR   Output directory for report.html and report.json (default: ./done-claim-report)\n  --json          Print JSON report to stdout (still writes files unless no out dir possible)\n  -h, --help      Show help`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  let input = null;
  let outDir = path.join(process.cwd(), 'done-claim-report');
  let jsonStdout = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-dir') { outDir = args[++i]; }
    else if (a === '--json') { jsonStdout = true; }
    else if (!a.startsWith('-') && !input) { input = a; }
    else { console.error(`Unknown argument: ${a}`); usage(); process.exit(1); }
  }
  if (!input) { console.error('Missing transcript file.'); usage(); process.exit(1); }
  const absInput = path.resolve(input);
  if (!fs.existsSync(absInput) || !fs.statSync(absInput).isFile()) {
    console.error(`Transcript not found: ${absInput}`);
    process.exit(1);
  }
  const { events, format, source } = readTranscript(absInput);
  const result = analyze(events);
  const snippets = loadSnippets();
  const written = writeReports(result, { outDir, source, format, snippets });
  if (jsonStdout) {
    console.log(JSON.stringify(written.payload, null, 2));
  } else {
    console.log(`Analyzed ${path.basename(source)} (${format})`);
    console.log(`Claims: ${result.summary.total} (verified: ${result.summary.verified}, unverified: ${result.summary.unverified})`);
    console.log(`HTML report: ${written.htmlPath}`);
    console.log(`JSON report: ${written.jsonPath}`);
  }
}

if (require.main === module) {
  try { main(process.argv); } catch (err) { console.error(err && err.stack ? err.stack : String(err)); process.exit(1); }
}

module.exports = { main };
