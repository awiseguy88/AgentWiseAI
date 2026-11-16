#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ContractStore } = require('./contracts');
const { validateSchema } = require('./validator');
const { buildReport, writeReport } = require('./reporter');
const { startServer } = require('./server');

function usage() {
  return [
    'agent-contract-observatory — validate tool I/O against versioned JSON-schema contracts',
    '',
    'Usage:',
    '  agent-contract-observatory validate-input  --contract <file|server/tool[@ver]> --payload <file> [--contracts-dir <dir>] [--out-dir <dir>] [--json]',
    '  agent-contract-observatory validate-output --contract <file|server/tool[@ver]> --payload <file> [--contracts-dir <dir>] [--out-dir <dir>] [--json]',
    '  agent-contract-observatory report          --contract <file> --input <file> [--output <file>] [--out-dir <dir>] [--json]',
    '  agent-contract-observatory serve           [--contracts-dir <dir>] [--port <n>] [--host <host>]',
    '  agent-contract-observatory list            [--contracts-dir <dir>]',
    '',
    'Options:',
    '  --contract <file|key>   Contract JSON file, or "server/tool" / "server/tool@version" resolved in --contracts-dir',
    '  --payload <file>        JSON payload to validate (input or output depending on subcommand)',
    '  --contracts-dir <dir>   Directory of contract files (default: ./contracts relative to CWD)',
    '  --out-dir <dir>         Directory for report.html + report.json (default: ./report-output)',
    '  --json                  Print the JSON report to stdout instead of writing files',
    '  --port <n>              Port for the local web UI (default: 8787)',
    '  --host <host>           Host for the local web UI (default: 127.0.0.1)',
    '  --help                  Show this help',
    '',
    'Exit codes: 0 = pass (no violations), 1 = violations found, 2 = usage/input error',
    '',
    'Runs fully offline. No network, no paid APIs, no accounts.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], outDir: 'report-output', contractsDir: null, json: false, port: 8787, host: '127.0.0.1' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--json') args.json = true;
    else if (a === '--contract') args.contract = argv[++i];
    else if (a === '--payload') args.payload = argv[++i];
    else if (a === '--input') args.input = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--contracts-dir') args.contractsDir = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--port') args.port = parseInt(argv[++i], 10);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--role') args.role = argv[++i]; // ignored (compat)
    else args._.push(a);
  }
  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function resolveContractsDir(args) {
  if (args.contractsDir) return path.resolve(args.contractsDir);
  // default: ./contracts relative to cwd
  return path.resolve(process.cwd(), 'contracts');
}

function loadContractRef(ref, contractsDir) {
  // If ref is an existing file path, load it directly
  const tryFile = path.resolve(ref);
  if (fs.existsSync(tryFile) && fs.statSync(tryFile).isFile()) {
    return JSON.parse(fs.readFileSync(tryFile, 'utf8'));
  }
  // Otherwise treat as "server/tool" or "server/tool@version"
  const store = new ContractStore(contractsDir);
  store.load();
  const at = ref.lastIndexOf('@');
  let serverTool = ref, version = null;
  if (at > 0) { serverTool = ref.slice(0, at); version = ref.slice(at + 1); }
  const slash = serverTool.indexOf('/');
  if (slash < 0) throw new Error(`Unknown contract reference: ${ref} (expected file path or server/tool[@version])`);
  const server = serverTool.slice(0, slash);
  const tool = serverTool.slice(slash + 1);
  const c = store.find(server, tool, version);
  if (!c) throw new Error(`Contract not found in ${contractsDir}: ${ref}`);
  return c;
}

function runValidate(args, phase) {
  if (!args.contract) return { code: 2, err: 'Missing --contract' };
  if (!args.payload) return { code: 2, err: 'Missing --payload' };
  const contractsDir = resolveContractsDir(args);
  let contract, payload;
  try { contract = loadContractRef(args.contract, contractsDir); } catch (e) { return { code: 2, err: e.message }; }
  try { payload = readJson(path.resolve(args.payload)); } catch (e) { return { code: 2, err: `Failed to read payload: ${e.message}` }; }
  const schema = phase === 'input' ? contract.input : contract.output;
  const violations = validateSchema(schema, payload);
  const executed = phase === 'output'; // input validation blocks execution on failure
  const report = buildReport({ contract, phase, payload, violations, executed, sideEffect: contract.sideEffect });
  if (!args.json) {
    const outDir = path.resolve(args.outDir);
    const { jsonPath, htmlPath } = writeReport(outDir, report);
    if (violations.length > 0) {
      console.error(`[FAIL] ${phase} validation for ${contract.server}/${contract.tool}@${contract.version}: ${violations.length} violation(s)`);
      for (const v of violations) {
        console.error(`  - ${v.field}: ${v.message}${v.expected !== undefined ? ` (expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(v.actual)})` : ''}`);
      }
      console.error(`Report: ${jsonPath}`);
      console.error(`HTML:   ${htmlPath}`);
    } else {
      console.log(`[PASS] ${phase} validation for ${contract.server}/${contract.tool}@${contract.version}: no violations`);
      console.log(`Report: ${jsonPath}`);
      console.log(`HTML:   ${htmlPath}`);
    }
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  return { code: violations.length > 0 ? 1 : 0, report };
}

function runReport(args) {
  if (!args.contract) return { code: 2, err: 'Missing --contract' };
  if (!args.input) return { code: 2, err: 'Missing --input' };
  const contractsDir = resolveContractsDir(args);
  let contract, inputPayload;
  try { contract = loadContractRef(args.contract, contractsDir); } catch (e) { return { code: 2, err: e.message }; }
  try { inputPayload = readJson(path.resolve(args.input)); } catch (e) { return { code: 2, err: `Failed to read input: ${e.message}` }; }
  const inputViolations = validateSchema(contract.input, inputPayload);
  const inputReport = buildReport({ contract, phase: 'input', payload: inputPayload, violations: inputViolations, executed: false });
  let outputReport = null;
  if (args.output) {
    let outputPayload;
    try { outputPayload = readJson(path.resolve(args.output)); } catch (e) { return { code: 2, err: `Failed to read output: ${e.message}` }; }
    const outputViolations = validateSchema(contract.output, outputPayload);
    outputReport = buildReport({ contract, phase: 'output', payload: outputPayload, violations: outputViolations, executed: true });
  }
  const combined = { contract: { server: contract.server, tool: contract.tool, version: contract.version }, input: inputReport, output: outputReport };
  if (!args.json) {
    const outDir = path.resolve(args.outDir);
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'report.json');
    const htmlPath = path.join(outDir, 'report.html');
    const combinedHtml = renderCombinedHtml(combined);
    fs.writeFileSync(jsonPath, JSON.stringify(combined, null, 2) + '\n', 'utf8');
    fs.writeFileSync(htmlPath, combinedHtml, 'utf8');
    console.log(`Report: ${jsonPath}`);
    console.log(`HTML:   ${htmlPath}`);
  } else {
    process.stdout.write(JSON.stringify(combined, null, 2) + '\n');
  }
  const fail = inputReport.status === 'fail' || (outputReport && outputReport.status === 'fail');
  return { code: fail ? 1 : 0, report: combined };
}

function renderCombinedHtml(combined) {
  const { buildReport: br, renderHtml } = require('./reporter');
  // build a single HTML page showing both phases
  function section(rep, label) {
    if (!rep) return `<h2>${label}</h2><p>No payload provided.</p>`;
    const rows = (rep.violations || []).map((v) => `
      <tr>
        <td><code>${esc(v.field)}</code></td>
        <td>${esc(v.keyword)}</td>
        <td>${esc(v.message)}</td>
        <td><code>${esc(JSON.stringify(v.expected))}</code></td>
        <td><code>${esc(JSON.stringify(v.actual))}</code></td>
      </tr>`).join('');
    const cls = rep.status === 'pass' ? 'pass' : 'fail';
    return `
      <h2>${label}</h2>
      <div class="badge ${cls}">${rep.status.toUpperCase()} — ${rep.summary.violations} violation(s)</div>
      ${rep.violations.length === 0 ? '<div class="empty">No violations.</div>' : `<table><thead><tr><th>Field</th><th>Keyword</th><th>Reason</th><th>Expected</th><th>Actual</th></tr></thead><tbody>${rows}</tbody></table>`}`;
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Agent Contract Observatory — Report</title>
  <style>body{font-family:-apple-system,system-ui,sans-serif;margin:2rem;color:#1a1a1a;background:#fafafa}
  h1{margin-bottom:.25rem}.meta{color:#555;font-size:.9rem;margin-bottom:1.5rem}
  .badge{display:inline-block;padding:.2rem .6rem;border-radius:4px;font-weight:600;margin:.5rem 0}
  .pass{background:#d4edda;color:#155724}.fail{background:#f8d7da;color:#721c24}
  table{border-collapse:collapse;width:100%;margin-top:1rem;background:#fff}
  th,td{border:1px solid #ddd;padding:.6rem .8rem;text-align:left;vertical-align:top}th{background:#f1f1f1}
  code{background:#eee;padding:1px 4px;border-radius:3px;font-size:.85em;word-break:break-all}
  .empty{padding:1rem;background:#fff;border:1px solid #ddd;border-radius:6px;margin-top:1rem}
  footer{margin-top:2rem;color:#888;font-size:.8rem}</style></head><body>
  <h1>Agent Contract Observatory — Report</h1>
  <div class="meta">Contract: <strong>${esc(combined.contract.server)}/${esc(combined.contract.tool)}</strong> @ ${esc(combined.contract.version)}</div>
  ${section(combined.input, 'Input (preflight — before execution)')}
  ${section(combined.output, 'Output (postflight — after execution)')}
  <footer>Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/</footer>
  </body></html>`;
}

async function runServe(args) {
  const contractsDir = resolveContractsDir(args);
  const port = Number.isFinite(args.port) ? args.port : 8787;
  const host = args.host || '127.0.0.1';
  try {
    const srv = await startServer({ contractsDir, port, host });
    console.log(`Agent Contract Observatory running at http://${host}:${srv.port}`);
    console.log(`Contracts: ${contractsDir}`);
    console.log('Press Ctrl+C to stop.');
    // keep alive
    await new Promise((resolve) => {
      process.on('SIGINT', () => { srv.close(); resolve(); });
      process.on('SIGTERM', () => { srv.close(); resolve(); });
    });
    return { code: 0 };
  } catch (e) {
    return { code: 2, err: e.message };
  }
}

function runList(args) {
  const contractsDir = resolveContractsDir(args);
  const store = new ContractStore(contractsDir);
  try {
    store.load();
  } catch (e) {
    return { code: 2, err: e.message };
  }
  const list = store.list();
  if (args.json) {
    process.stdout.write(JSON.stringify(list, null, 2) + '\n');
  } else {
    if (list.length === 0) {
      console.log(`No contracts found in ${contractsDir}`);
    } else {
      console.log(`Contracts in ${contractsDir}:`);
      for (const c of list) {
        console.log(`  - ${c.key}${c.sideEffect ? ` [${c.sideEffect}]` : ''}${c.description ? ` — ${c.description}` : ''}`);
      }
    }
  }
  return { code: 0 };
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) {
    console.log(usage());
    return args.help ? 0 : 2;
  }
  const cmd = args._[0];
  let result;
  if (cmd === 'validate-input') result = runValidate(args, 'input');
  else if (cmd === 'validate-output') result = runValidate(args, 'output');
  else if (cmd === 'report') result = runReport(args);
  else if (cmd === 'serve') result = await runServe(args);
  else if (cmd === 'list') result = runList(args);
  else {
    console.error(`Unknown command: ${cmd}`);
    console.log(usage());
    return 2;
  }
  if (result && result.err) {
    console.error(result.err);
    return result.code || 2;
  }
  return result ? (result.code || 0) : 0;
}

if (require.main === module) {
  main(process.argv).then((code) => { process.exitCode = code; }).catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 2;
  });
}

module.exports = { main };
