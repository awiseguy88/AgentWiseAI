#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadCsvFile } = require('./csv');
const { analyzeAll } = require('./analyze');
const { loadNotes } = require('./notes');
const { writeOutputs } = require('./report');

function usage() {
  return `Glide Classic Escape Kit (offline)

Usage:
  node src/cli.js [--csv <file.csv> ...] [--notes <app-notes.json|yaml>] [--out <dir>] [--name <app>]
  glide-classic-escape-kit [options]

Options:
  --csv <file>     CSV export to ingest (repeatable). You can also pass .csv paths as positional args.
  --notes <file>   App notes file (.json or simple .yaml/.yml) with screens/logic/roles/cost.
  --out <dir>      Output directory (default: ./glide-escape-report)
  --name <text>    App name for the report header.
  -h, --help       Show this help.

Examples:
  node src/cli.js --csv samples/tasks.csv --csv samples/users.csv --notes samples/app-notes.json --out report
  node src/cli.js samples/tasks.csv samples/users.csv --notes samples/app-notes.yaml

Outputs: report.html, inventory.json, checklist.md, cost-worksheet.csv
No external services. Verified data findings are separated from user-supplied logic notes.`;
}

function parseArgs(argv) {
  const opts = { csv: [], notes: null, out: './glide-escape-report', name: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { opts.help = true; }
    else if (a === '--csv') { opts.csv.push(argv[++i]); }
    else if (a === '--notes') { opts.notes = argv[++i]; }
    else if (a === '--out') { opts.out = argv[++i]; }
    else if (a === '--name') { opts.name = argv[++i]; }
    else if (a.endsWith('.csv')) { opts.csv.push(a); }
    else { throw new Error(`Unknown argument: ${a}`); }
  }
  return opts;
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv); } catch (e) { console.error(e.message); console.error(usage()); process.exit(2); }
  if (opts.help) { console.log(usage()); process.exit(0); }
  if (!opts.csv.length) { console.error('Error: provide at least one --csv file.'); console.error(usage()); process.exit(2); }

  const tables = [];
  for (const f of opts.csv) {
    if (!fs.existsSync(f)) { console.error(`Error: CSV not found: ${f}`); process.exit(2); }
    tables.push(loadCsvFile(f));
  }
  let notes = null;
  if (opts.notes) {
    if (!fs.existsSync(opts.notes)) { console.error(`Error: notes file not found: ${opts.notes}`); process.exit(2); }
    notes = loadNotes(opts.notes);
  }

  const analysis = analyzeAll(tables);
  const meta = { generatedAt: new Date().toISOString(), csvFiles: opts.csv.map(f => path.basename(f)), notesFile: opts.notes ? path.basename(opts.notes) : null, appName: opts.name || (notes && notes.appName) || '' };
  const files = writeOutputs(opts.out, analysis, notes, meta);
  console.log(`Glide Classic Escape Kit report generated in: ${path.resolve(opts.out)}`);
  for (const f of files) console.log(` - ${f}`);
  console.log(`Tables analyzed: ${analysis.tables.length}, relation hints: ${analysis.relationHints.length}, mostly-empty columns: ${analysis.emptyColumns.length}`);
}

if (require.main === module) main();
module.exports = { main, parseArgs };
