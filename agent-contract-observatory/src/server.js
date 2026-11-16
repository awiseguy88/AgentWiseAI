'use strict';

const http = require('http');
const { ContractStore } = require('./contracts');
const { validateSchema } = require('./validator');
const { renderHtml } = require('./reporter');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function writeJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function writeHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function uiPage(store) {
  const contracts = store.list().map((c) => {
    const key = c.server + '/' + c.tool + '@' + c.version;
    const side = c.sideEffect ? ' [' + c.sideEffect + ']' : '';
    return '<option value="' + esc(key) + '">' + esc(c.server) + '/' + esc(c.tool) + ' @ ' + esc(c.version) + esc(side) + '</option>';
  }).join('\n') || '<option>No contracts loaded</option>';

  const browserScript = 'const contractEl = document.getElementById("contract");\n' +
    'const payloadEl = document.getElementById("payload");\n' +
    'const outputEl = document.getElementById("output");\n' +
    'const outputLabelWrap = document.getElementById("outputLabelWrap");\n' +
    'const btnInput = document.getElementById("btnInput");\n' +
    'const btnOutput = document.getElementById("btnOutput");\n' +
    'const btnValidate = document.getElementById("btnValidate");\n' +
    'const resultCard = document.getElementById("resultCard");\n' +
    'const resultBadge = document.getElementById("resultBadge");\n' +
    'const resultGate = document.getElementById("resultGate");\n' +
    'const resultTable = document.getElementById("resultTable");\n' +
    'const resultTbody = resultTable.querySelector("tbody");\n' +
    'const resultEmpty = document.getElementById("resultEmpty");\n' +
    'const btnDownloadHtml = document.getElementById("btnDownloadHtml");\n' +
    'const btnDownloadJson = document.getElementById("btnDownloadJson");\n' +
    'let phase = "input";\n' +
    'function setPhase(p) { phase = p; btnInput.className = p === "input" ? "secondary" : ""; btnOutput.className = p === "output" ? "" : "secondary"; const lbl = document.getElementById("lblPayload"); lbl.innerHTML = p === "input" ? "Paste tool-call <b>input</b> JSON" : "Paste tool result <b>output</b> JSON"; outputLabelWrap.style.display = p === "output" ? "" : "none"; payloadEl.value = ""; outputEl.value = ""; resultCard.classList.add("hidden"); }\n' +
    'btnInput.addEventListener("click", () => setPhase("input"));\n' +
    'btnOutput.addEventListener("click", () => setPhase("output"));\n' +
    'function setPhaseFromQuery() { const params = new URLSearchParams(window.location.search); if (params.get("phase") === "output") setPhase("output"); }\n' +
    'setPhaseFromQuery();\n' +
    'async function fetchJson(p, body) { const init = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}; const res = await fetch(p, init); if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(res.status + " " + txt); } return res.json(); }\n' +
    'async function loadContracts() { try { const list = await fetchJson("/api/contracts"); contractEl.innerHTML = list.map(c => { const key = c.server + "/" + c.tool + "@" + c.version; const side = c.sideEffect ? " [" + c.sideEffect + "]" : ""; return "<option value=\\"" + esc2(key) + "\\">" + esc2(c.server) + "/" + esc2(c.tool) + " @ " + esc2(c.version) + esc2(side) + "</option>"; }).join("\\n") || "<option>No contracts loaded</option>"; } catch (e) { console.error("failed to load contracts", e); } }\n' +
    'function esc2(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}\n' +
    'async function validate() { const key = contractEl.value; const at = key.lastIndexOf("@"); const serverTool = at > 0 ? key.slice(0, at) : key; const version = at > 0 ? key.slice(at + 1) : null; const slash = serverTool.indexOf("/"); const server = serverTool.slice(0, slash); const tool = serverTool.slice(slash + 1); const payload = payloadEl.value.trim(); const body = { server, tool, version, phase, payload }; if (phase === "output") body.output = outputEl.value.trim(); try { const rep = await fetchJson("/api/validate", body); renderResult(rep); } catch (e) { alert("Validation failed: " + e.message); } }\n' +
    'btnValidate.addEventListener("click", validate);\n' +
    'function renderResult(rep) { resultCard.classList.remove("hidden"); const statusClass = rep.status === "pass" ? "pass" : "fail"; resultBadge.className = "badge " + statusClass; resultBadge.textContent = rep.status.toUpperCase() + " \\u2014 " + rep.summary.violations + " violation(s)"; resultGate.textContent = rep.gate + (rep.sideEffectOccurred === false ? " \\u2014 side effect blocked" : ""); resultTbody.innerHTML = ""; if (rep.violations.length === 0) { resultTable.style.display = "none"; resultEmpty.style.display = "block"; resultEmpty.textContent = "No violations. Payload conforms to the contract."; setupDownloads(rep); return; } resultTable.style.display = ""; resultEmpty.style.display = "none"; for (const v of rep.violations) { const tr = document.createElement("tr"); tr.innerHTML = "<td><code>" + esc2(v.field) + "</code></td><td>" + esc2(v.keyword) + "</td><td>" + esc2(v.message) + "</td><td><code>" + esc2(JSON.stringify(v.expected)) + "</code></td><td><code>" + esc2(JSON.stringify(v.actual)) + "</code></td>"; resultTbody.appendChild(tr); } setupDownloads(rep); }\n' +
    'function setupDownloads(rep) { const jsonBlob = new Blob([JSON.stringify(rep, null, 2)], { type: "application/json" }); const htmlBlob = new Blob([renderHtml(rep)], { type: "text/html" }); const name = rep.contract.server + "-" + rep.contract.tool + "-" + rep.contract.version + "-" + rep.phase; btnDownloadHtml.onclick = () => downloadBlob(htmlBlob, name + ".report.html"); btnDownloadJson.onclick = () => downloadBlob(jsonBlob, name + ".report.json"); }\n' +
    'function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }\n' +
    'function renderHtml(rep) { const rows = (rep.violations || []).map(v => "<tr><td><code>" + esc2(v.field) + "</code></td><td>" + esc2(v.keyword) + "</td><td>" + esc2(v.message) + "</td><td><code>" + esc2(JSON.stringify(v.expected)) + "</code></td><td><code>" + esc2(JSON.stringify(v.actual)) + "</code></td></tr>").join(""); const statusClass = rep.status === "pass" ? "pass" : "fail"; return "<!doctype html><html lang=\\"en\\"><head><meta charset=\\"utf-8\\"><title>Agent Contract Observatory \\u2014 Violation Report</title><style>body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;margin:2rem;color:#1a1a1a;background:#fafafa}h1{margin-bottom:.25rem}.meta{color:#555;font-size:.9rem;margin-bottom:1.5rem}.badge{display:inline-block;padding:.2rem .6rem;border-radius:4px;font-weight:600}.pass{background:#d4edda;color:#155724}.fail{background:#f8d7da;color:#721c24}table{border-collapse:collapse;width:100%;margin-top:1rem;background:#fff}th,td{border:1px solid #ddd;padding:.6rem .8rem;text-align:left}th{background:#f1f1f1}code{background:#eee;padding:1px 4px;border-radius:3px;font-size:.85em;word-break:break-all}.empty{padding:1rem;background:#fff;border:1px solid #ddd;border-radius:6px;margin-top:1rem}footer{margin-top:2rem;color:#888;font-size:.8rem}</style></head><body><h1>Agent Contract Observatory \\u2014 Violation Report</h1><div class=\\"meta\\">Contract: <strong>" + esc2(rep.contract.server) + "/" + esc2(rep.contract.tool) + "</strong> @ " + esc2(rep.contract.version) + " \\u00b7 Phase: " + esc2(rep.gate) + " \\u00b7 Generated: " + esc2(rep.generatedAt) + "</div><div class=\\"badge " + statusClass + "\\">" + rep.status.toUpperCase() + " \\u2014 " + rep.summary.violations + " violation(s)</div>" + (rep.violations.length===0?"<div class=\\"empty\\">No violations. Payload conforms to the contract.</div>":"<table><thead><tr><th>Field</th><th>Keyword</th><th>Reason</th><th>Expected</th><th>Actual</th></tr></thead><tbody>" + rows + "</tbody></table>") + "<footer>Part of the AaronWiseAI open-source tool collection \\u2014 https://aaronwiseai.com/</footer></body></html>"; }\n' +
    'loadContracts();\n';

  return '<!doctype html>\n<html lang="en"><head>' +
    '<meta charset="utf-8"><title>Agent Contract Observatory</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>' +
    '  * { box-sizing: border-box; }' +
    '  body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 0; color: #1a1a1a; background: #f4f5f7; }' +
    '  header { background: #0b2a4a; color: #fff; padding: 1rem 2rem; }' +
    '  header h1 { margin: 0; font-size: 1.1rem; letter-spacing: .4px; text-transform: uppercase; }' +
    '  header p { margin: .2rem 0 0; font-size: .8rem; opacity: .8; }' +
    '  .container { max-width: 1000px; margin: 0 auto; padding: 1.5rem 1rem; }' +
    '  .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); padding: 1.25rem; margin-bottom: 1rem; }' +
    '  h2 { margin-top: 0; font-size: 1rem; color: #0b2a4a; margin-bottom: .75rem; }' +
    '  label { display: block; font-size: .85rem; color: #444; margin-bottom: .35rem; }' +
    '  select, input[type=file], textarea, input[type=text] { width: 100%; padding: .55rem .65rem; border: 1px solid #c9d2da; border-radius: 6px; background: #fff; font-size: .9rem; }' +
    '  textarea { min-height: 140px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }' +
    '  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }' +
    '  @media (max-width: 700px) { .row { grid-template-columns: 1fr; } }' +
    '  button { background: #0b2a4a; color: #fff; border: none; border-radius: 6px; padding: .6rem 1rem; font-size: .9rem; cursor: pointer; font-weight: 600; margin-top: .5rem; }' +
    '  button:hover { background: #16406b; }' +
    '  button.secondary { background: #6b7280; }' +
    '  button.secondary:hover { background: #4b5563; }' +
    '  button:disabled { opacity: .6; cursor: not-allowed; }' +
    '  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 4px; font-weight: 600; font-size: .8rem; margin-left: .4rem; }' +
    '  .pass { background: #d4edda; color: #155724; }' +
    '  .fail { background: #f8d7da; color: #721c24; }' +
    '  .none { color: #6b7280; font-style: italic; }' +
    '  table { width: 100%; border-collapse: collapse; margin-top: .75rem; background: #fff; }' +
    '  th, td { border: 1px solid #ddd; padding: .55rem .7rem; text-align: left; font-size: .88rem; vertical-align: top; }' +
    '  th { background: #f1f1f1; }' +
    '  code { background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: .85em; word-break: break-all; }' +
    '  .hint { font-size: .85rem; color: #555; margin-top: .4rem; }' +
    '  .hidden { display: none !important; }' +
    '  footer { padding: 1.5rem 1rem; color: #6b7280; font-size: .8rem; text-align: center; }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<header>' +
    '  <h1>Agent Contract Observatory</h1>' +
    '  <p>Load versioned tool contracts &nbsp;\u00b7&nbsp; validate inputs before execution and outputs after execution &nbsp;\u00b7&nbsp; offline HTML/JSON violation reports</p>' +
    '</header>' +
    '<div class="container">' +
    '  <div class="card">' +
    '    <h2>Contracts</h2>' +
    '    <div class="row">' +
    '      <div>' +
    '        <label for="contract">Contract</label>' +
    '        <select id="contract">' + contracts + '</select>' +
    '        <p class="hint">Files in <code>contracts/</code> (editable in the terminal: <code>node src/cli.js list</code>).</p>' +
    '      </div>' +
    '      <div>' +
    '        <label>Phase</label>' +
    '        <div style="margin-top:-14px;">' +
    '          <button class="secondary" id="btnInput" style="margin-right:.5rem;">Input (preflight)</button>' +
    '          <button id="btnOutput">Output (postflight)</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '' +
    '  <div class="card">' +
    '    <h2>Payload</h2>' +
    '    <div class="row">' +
    '      <div>' +
    '        <label id="lblPayload">Paste tool-call <b>input</b> JSON</label>' +
    '        <textarea id="payload" placeholder=\'{"items":[{"quantity":2,"price":19.99}]}\'></textarea>' +
    '      </div>' +
    '      <div id="outputLabelWrap" style="display:none;">' +
    '        <label id="lblOutput">Paste tool result <b>output</b> JSON</label>' +
    '        <textarea id="output" placeholder=\'{"transactionId":"tx-1","amount":12.5,"currency":"EUR","status":"settled"}\'></textarea>' +
    '      </div>' +
    '    </div>' +
    '    <button id="btnValidate">Validate</button>' +
    '  </div>' +
    '' +
    '  <div class="card hidden" id="resultCard">' +
    '    <h2 id="resultTitle">Violation Report</h2>' +
    '    <div id="resultBadge" class="badge none"></div>' +
    '    <div id="resultGate" class="hint"></div>' +
    '    <table id="resultTable"><thead><tr><th>Field</th><th>Keyword</th><th>Reason</th><th>Expected</th><th>Actual</th></tr></thead><tbody></tbody></table>' +
    '    <div id="resultEmpty" class="none"></div>' +
    '    <div style="margin-top: .75rem;">' +
    '      <button class="secondary" id="btnDownloadHtml">Download HTML report</button>' +
    '      <button class="secondary" id="btnDownloadJson">Download JSON report</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '' +
    '<footer>Part of the AaronWiseAI open-source tool collection \u2014 https://aaronwiseai.com/</footer>' +
    '' +
    '<script>' +
    browserScript +
    '</script>' +
    '</body></html>';
}

function validatePayload(store, contractKey, phase, payload) {
  const at = contractKey.lastIndexOf('@');
  const serverTool = at > 0 ? contractKey.slice(0, at) : contractKey;
  const version = at > 0 ? contractKey.slice(at + 1) : null;
  const slash = serverTool.indexOf('/');
  const server = serverTool.slice(0, slash);
  const tool = serverTool.slice(slash + 1);
  const contract = store.find(server, tool, version);
  if (!contract) throw new Error('contract not found');
  const schema = phase === 'input' ? contract.input : contract.output;
  const violations = validateSchema(schema, payload);
  const executed = phase === 'output';
  const report = {
    contract: { server: contract.server, tool: contract.tool, version: contract.version, sideEffect: contract.sideEffect },
    phase,
    gate: phase === 'input' ? 'preflight (before execution)' : 'postflight (after execution)',
    executed,
    status: violations.length === 0 ? 'pass' : 'fail',
    violations,
    generatedAt: new Date().toISOString(),
  };
  return report;
}

async function startServer({ contractsDir, port, host }) {
  const store = new ContractStore(contractsDir);
  try { store.load(); } catch (e) { /* continue empty */ }

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (url === '/') {
      writeHtml(res, 200, uiPage(store));
      return;
    }
    if (url === '/api/contracts' && req.method === 'GET') {
      writeJson(res, 200, store.list());
      return;
    }
    if (url === '/api/validate' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req));
        const report = validatePayload(store, body.server + '/' + body.tool + (body.version ? '@' + body.version : ''), body.phase, JSON.parse(body.payload || '{}'));
        writeJson(res, 200, report);
      } catch (e) {
        writeJson(res, 400, { error: e.message });
      }
      return;
    }
    if (url === '/api/validate') {
      writeJson(res, 405, { error: 'POST required' });
      return;
    }
    writeHtml(res, 404, '<h1>404</h1><p>Not found</p>');
  });

  await new Promise((resolve, reject) => {
    server.listen(port, host, (err) => err ? reject(err) : resolve());
    server.on('error', reject);
  });
  return server;
}

module.exports = { startServer };
