#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { importTranscript } = require('./import');
const { writeReport } = require('./report');

function usage() {
  console.error('Usage: node src/cli.js --input <file> [--out <dir>] [--json] [--html] [--gate <threshold>] [--name <run name>]');
  process.exit(2);
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.input) usage();

  const filePath = path.resolve(args.input);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  let gateThreshold = args.gate ? Number(args.gate) : 60;
  if (Number.isNaN(gateThreshold)) gateThreshold = 60;

  const result = importTranscript(filePath, { gateThreshold, name: args.name });
  console.log(`Imported: ${result.name} (${result.format})`);
  console.log(`Turns: ${result.aggregate.turn_count}`);
  console.log(`Mean slop: ${result.aggregate.mean_slop} | Max slop: ${result.aggregate.max_slop}`);
  console.log(`CI gate (threshold ${gateThreshold}): ${result.gate.pass ? 'PASS' : 'FAIL'}`);
  for (const b of result.gate.breaches) {
    console.error(`Breach: ${b.type} ${b.turn_index != null ? 'turn ' + b.turn_index : ''} score=${b.score} threshold=${b.threshold}`);
  }

  if (args.out || args.json || args.html) {
    const rpt = writeReport(result.runId, { outDir: args.out || 'reports' });
    console.log(`JSON report: ${rpt.jsonPath}`);
    console.log(`HTML report: ${rpt.htmlPath}`);
  }

  if (!result.gate.pass) process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a === '--input' || a === '-i') { out.input = argv[++i]; continue; }
    if (a === '--out' || a === '-o') { out.out = argv[++i]; continue; }
    if (a === '--json') { out.json = true; continue; }
    if (a === '--html') { out.html = true; continue; }
    if (a === '--gate') { out.gate = argv[++i]; continue; }
    if (a === '--name') { out.name = argv[++i]; continue; }
    if (a === '-g') { out.gate = argv[++i]; continue; }
    out[a] = true;
  }
  return out;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { main };
