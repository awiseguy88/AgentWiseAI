#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { scanConfigs } = require('./scanners');
const { classifyAll } = require('./classifier');
const { loadPolicy, evaluate } = require('./policy');
const { renderJsonReport, writeReport } = require('./report');

function usage() {
  return [
    'agent-cap-audit - offline-first agent capability auditor',
    '',
    'Usage:',
    '  agent-cap-audit <scan-root> [--role <role>] [--policy <file>] [--out-dir <dir>] [--json]',
    '',
    'Options:',
    '  --role <role>        Role to check against policy (default: executor)',
    '  --policy <file>      Path to a per-role policy JSON file',
    '  --out-dir <dir>      Output directory for report.html/report.json (default: ./agent-cap-audit-report)',
    '  --json               Print report JSON to stdout instead of writing files',
    '  --help               Show this help',
    '',
    'Exit codes: 0 = pass, 1 = policy violations found, 2 = usage/input error',
    'Runs offline on local files; no paid APIs.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], role: 'executor', outDir: 'agent-cap-audit-report', json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; }
    else if (a === '--json') { args.json = true; }
    else if (a === '--role') { args.role = argv[++i]; }
    else if (a === '--policy') { args.policy = argv[++i]; }
    else if (a === '--out-dir') { args.outDir = argv[++i]; }
    else { args._.push(a); }
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) { console.log(usage()); return 0; }
  const scanRoot = args._[0];
  if (!scanRoot) { console.error(usage()); return 2; }
  const root = path.resolve(scanRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Scan root not found or not a directory: ${root}`);
    return 2;
  }

  let policyInfo;
  try {
    policyInfo = loadPolicy(root, args.policy);
  } catch (e) {
    console.error(`Policy error: ${e.message}`);
    return 2;
  }

  const rawCaps = scanConfigs(root);
  const capabilities = classifyAll(rawCaps);
  const evaluation = evaluate(capabilities, policyInfo.policy, args.role);
  const jsonReport = renderJsonReport(root, args.role, policyInfo, evaluation, capabilities);

  if (args.json) {
    console.log(JSON.stringify(jsonReport, null, 2));
  } else {
    const outDir = path.resolve(args.outDir);
    const { jsonPath, htmlPath } = writeReport(outDir, jsonReport);
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${htmlPath}`);
    console.log(`Status: ${jsonReport.summary.status.toUpperCase()} (${jsonReport.summary.violations} violation(s), ${jsonReport.summary.passed} passed)`);
  }

  return jsonReport.summary.violations > 0 ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = { main };