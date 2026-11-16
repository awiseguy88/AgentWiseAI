#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { newProxy } = require('./proxy');
const { newAuditLog } = require('./audit');

function usage() {
  return [
    'agent-ontology-guardrails - machine-checkable agent action guardrails',
    '',
    'Usage:',
    '  agent-ontology-guardrails validate <action.json> --rules <rule-pack.json> [--data <runtime-data.json>]',
    '  agent-ontology-guardrails replay <trace.json> --rules <rule-pack.json> --data <runtime-data.json> [--out-dir <dir>]',
    '  agent-ontology-guardrails proxy --rules <rule-pack.json> [--target-host 127.0.0.1] [--target-port 4000] [--port 8080]',
    '  agent-ontology-guardrails audit-report <audit.json> --out-dir <dir>',
    '  agent-ontology-guardrails --help',
    '',
    'Exit codes: 0 = pass, 1 = blocked/violations, 2 = usage/input error',
    'Runs offline on local files; no paid APIs.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], rules: null, data: null, outDir: 'agent-ontology-guardrails-report', targetHost: '127.0.0.1', targetPort: '4000', port: '8080' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--rules') args.rules = argv[++i];
    else if (a === '--data') args.data = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--target-host') args.targetHost = argv[++i];
    else if (a === '--target-port') args.targetPort = argv[++i];
    else if (a === '--port') args.port = argv[++i];
    else args._.push(a);
  }
  return args;
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
    process.exit(2);
  }
}

async function cmdValidate(args) {
  const action = readJson(args._[1]);
  const rulePack = args.rules ? readJson(args.rules) : null;
  const data = args.data ? readJson(args.data) : {};
  const { validateAction } = require('./validator');
  const result = validateAction(rulePack, action, data);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

async function cmdReplay(args) {
  const trace = readJson(args._[1]);
  const rulePack = args.rules ? readJson(args.rules) : null;
  const data = args.data ? readJson(args.data) : {};
  const { validateAction } = require('./validator');
  const audit = newAuditLog({ outDir: args.outDir });
  const actions = Array.isArray(trace) ? trace : (trace.actions || []);
  let pass = 0, block = 0;
  for (const action of actions) {
    const result = validateAction(rulePack, action, data);
    audit.entry(action, result);
    if (result.valid) pass++; else block++;
  }
  const jsonPath = path.resolve(args.outDir, 'audit.json');
  const htmlPath = path.resolve(args.outDir, 'audit.html');
  audit.writeJson(jsonPath);
  audit.writeHtml(htmlPath);
  console.log(`Replayed ${actions.length} actions: ${pass} passed, ${block} blocked.`);
  console.log(`Audit: ${jsonPath}, ${htmlPath}`);
  process.exit(block ? 1 : 0);
}

async function cmdProxy(args) {
  if (!args.rules) { console.error('--rules is required for proxy mode.'); process.exit(2); }
  const rulePack = readJson(args.rules);
  const data = args.data ? readJson(args.data) : {};
  const proxy = newProxy({ rulePack, targetHost: args.targetHost, targetPort: args.targetPort, runtimeContext: data });
  const port = await proxy.start(parseInt(args.port, 10));
  console.log(`Validator proxy listening on http://127.0.0.1:${port}`);
  console.log(`POST proposed actions here; valid actions are forwarded to ${args.targetHost}:${args.targetPort}.`);
}

async function cmdAuditReport(args) {
  const auditJson = readJson(args._[1]);
  const audit = newAuditLog({ outDir: args.outDir });
  for (const e of auditJson) audit.entry(e.action, e);
  const jsonPath = path.resolve(args.outDir, 'audit.json');
  const htmlPath = path.resolve(args.outDir, 'audit.html');
  audit.writeJson(jsonPath);
  audit.writeHtml(htmlPath);
  console.log(`Audit report written to ${htmlPath}`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(usage()); process.exit(0); }
  if (!args._.length) { console.log(usage()); process.exit(2); }
  const cmd = args._[0];
  try {
    if (cmd === 'validate') await cmdValidate(args);
    else if (cmd === 'replay') await cmdReplay(args);
    else if (cmd === 'proxy') await cmdProxy(args);
    else if (cmd === 'audit-report') await cmdAuditReport(args);
    else { console.error(`Unknown command: ${cmd}`); process.exit(2); }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  }
}

main();
