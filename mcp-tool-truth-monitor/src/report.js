'use strict';

const fs = require('fs');
const path = require('path');
const { _extractText } = require('./parser');

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP Tool-Call Truth Monitor — Report</title>
<style>
  :root { --bg:#0f1115; --fg:#e8e8e8; --muted:#8b909a; --acc:#4da6ff; --acc2:#ffb84d; --ok:#22c55e; --warn:#f59e0b; --err:#ef4444; --card:#16191f; --border:#2a2e36; --sel:#2b3a4f; }
  * { box-sizing:border-box; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:var(--bg); color:var(--fg); margin:0; line-height:1.5; }
  header { border-bottom:1px solid var(--border); padding:16px 24px; background:linear-gradient(180deg,rgba(77,166,255,0.08),transparent); position:sticky; top:0; z-index:10; }
  h1 { margin:0; font-size:1.2rem; font-weight:600; }
  .meta { color:var(--muted); font-size:.85rem; margin-top:4px; }
  .tabs { display:flex; gap:4px; padding:12px 16px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.02); overflow-x:auto; }
  .tab { padding:8px 16px; border:none; background:transparent; color:var(--muted); font-size:.85rem; cursor:pointer; border-radius:6px; white-space:nowrap; }
  .tab:hover { background:rgba(255,255,255,0.05); color:var(--fg); }
  .tab.active { background:var(--sel); color:var(--acc); font-weight:600; }
  main { padding:16px 24px 40px; max-width:1400px; margin:0 auto; }
  .panel { display:none; }
  .panel.active { display:block; animation:fade .15s ease; }
  @keyframes fade { from {opacity:0; transform:translateY(4px);} to {opacity:1; transform:none;} }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:16px; }
  .card h2 { margin:0 0 12px; font-size:.95rem; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:.82rem; }
  th, td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--border); }
  th { color:var(--muted); font-weight:500; font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:rgba(255,255,255,0.02); }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.7rem; font-weight:600; text-transform:uppercase; letter-spacing:.02em; }
  .badge-mismatch { background:rgba(239,68,68,0.15); color:#ef4444; }
  .badge-ok { background:rgba(34,197,94,0.15); color:#22c55e; }
  .badge-warn { background:rgba(245,158,11,0.15); color:#f59e0b; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.78rem; }
  .excerpt { color:var(--muted); max-width:400px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .detail-row { display:flex; gap:24px; flex-wrap:wrap; margin-top:8px; }
  .detail-col { flex:1; min-width:260px; }
  .detail-col h3 { margin:0 0 6px; font-size:.75rem; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .detail-col pre { margin:0; background:#0a0c10; border:1px solid var(--border); border-radius:6px; padding:10px; overflow:auto; max-height:280px; font-size:.72rem; }
  .tool-name { font-weight:600; color:var(--acc); }
  .summary-bar { display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
  .stat { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 18px; min-width:140px; }
  .stat .label { color:var(--muted); font-size:.7rem; text-transform:uppercase; }
  .stat .value { font-size:1.4rem; font-weight:700; color:var(--fg); }
  .stat.err .value { color:#ef4444; }
  .stat.ok .value { color:#22c55e; }
  .stat.warn .value { color:#f59e0b; }
  .empty-state { text-align:center; padding:40px; color:var(--muted); }
  .empty-state svg { width:48px; height:48px; margin-bottom:12px; opacity:.6; }
  .timeline-item { border-left:2px solid var(--border); padding-left:16px; margin-left:8px; margin-bottom:16px; position:relative; }
  .timeline-item::before { content:''; position:absolute; left:-6px; top:2px; width:10px; height:10px; border-radius:50%; background:var(--bg); border:2px solid var(--border); }
  .timeline-item.call { border-left-color:var(--acc); } .timeline-item.call::before { border-color:var(--acc); }
  .timeline-item.result.ok { border-left-color:var(--ok); } .timeline-item.result.ok::before { border-color:var(--ok); }
  .timeline-item.result.err { border-left-color:var(--err); } .timeline-item.result.err::before { border-color:var(--err); }
  .timeline-item.claim { border-left-color:var(--acc2); } .timeline-item.claim::before { border-color:var(--acc2); }
  .timeline-item.mismatch { border-left-color:var(--err); } .timeline-item.mismatch::before { border-color:var(--err); background:var(--err); }
  .timeline-type { font-size:.7rem; color:var(--muted); text-transform:uppercase; margin-bottom:2px; }
  .timeline-content { font-size:.82rem; }
  .timeline-content .tool { font-weight:600; color:var(--acc); }
  .dropzone { border:2px dashed var(--border); border-radius:10px; padding:40px; text-align:center; color:var(--muted); cursor:pointer; transition:border-color .15s,background .15s; }
  .dropzone:hover, .dropzone.drag { border-color:var(--acc); background:rgba(77,166,255,0.05); }
  .dropzone input { display:none; }
  .footer { margin-top:40px; padding-top:20px; border-top:1px solid var(--border); color:var(--muted); font-size:.75rem; text-align:center; }
  .footer a { color:var(--acc); text-decoration:none; }
  .footer a:hover { text-decoration:underline; }
</style>
</head>
<body>
<header>
  <h1>MCP Tool-Call Truth Monitor</h1>
  <div class="meta" id="meta"></div>
</header>
<div class="tabs" id="tabs">
  <button class="tab active" data-panel="summary">Summary</button>
  <button class="tab" data-panel="timeline">Trace Timeline</button>
  <button class="tab" data-panel="mismatches">Mismatch Table</button>
  <button class="tab" data-panel="pairs">Claim vs Result</button>
</div>
<main>
  <div id="panel-summary" class="panel active">
    <div class="summary-bar" id="summaryBar"></div>
    <div class="card">
      <h2>About this report</h2>
      <p style="color:var(--muted);margin:0;">This offline report compares tool call results against subsequent agent claims. Mismatches indicate cases where a tool failed, errored, returned empty, or timed out, yet the agent later claimed success.</p>
    </div>
  </div>
  <div id="panel-timeline" class="panel">
    <div class="card">
      <h2>Trace Timeline</h2>
      <div id="timeline"></div>
    </div>
  </div>
  <div id="panel-mismatches" class="panel">
    <div class="card">
      <h2>Mismatch Table</h2>
      <div id="mismatchTable"></div>
    </div>
  </div>
  <div id="panel-pairs" class="panel">
    <div class="card">
      <h2>Claim vs Result Pairs</h2>
      <div id="pairsView"></div>
    </div>
  </div>
</main>
<footer class="footer">
  Generated by <a href="https://github.com/awiseguy88/AgentWiseAI/tree/main/mcp-tool-truth-monitor" target="_blank">MCP Tool-Call Truth Monitor</a> · Part of the <a href="https://aaronwiseai.com/" target="_blank">AaronWiseAI</a> open-source tool collection
</footer>
<script>
const DATA = __REPORT_DATA__;

function escapeHtml(s) {
  return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function init() {
  if (!DATA) return;
  document.getElementById('meta').textContent = \`Source: \${escapeHtml(DATA.traceFile || '—')} · Generated: \${new Date(DATA.timestamp).toLocaleString()}\`;

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
    });
  });

  renderSummary();
  renderTimeline();
  renderMismatches();
  renderPairs();
}

function renderSummary() {
  const s = DATA.summary || { totalCalls:0, mismatches:0, cleanMatches:0 };
  const el = document.getElementById('summaryBar');
  el.innerHTML = \`
    <div class="stat"><div class="label">Tool Calls</div><div class="value">\${s.totalCalls}</div></div>
    <div class="stat err"><div class="label">Mismatches</div><div class="value">\${s.mismatches}</div></div>
    <div class="stat ok"><div class="label">Clean</div><div class="value">\${s.cleanMatches}</div></div>
  \`;
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!DATA.timeline || !DATA.timeline.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5v14M15 5v14M5 9h14M5 15h14"/></svg>No timeline data</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const entry of DATA.timeline) {
    const div = document.createElement('div');
    const isMismatch = entry.problem && ['isError','empty','timeout','error'].includes(entry.problem.type) && entry.claims?.length;
    const klass = isMismatch ? 'timeline-item mismatch' : entry.problem ? 'timeline-item result err' : 'timeline-item result ok';
    let content = \`<div class="timeline-type">Step \${entry.step} · \${escapeHtml(entry.tool)}</div>\`;

    if (entry.callArgs) {
      content += \`<div class="timeline-content"><span class="mono">Call args: </span>\${escapeHtml(JSON.stringify(entry.callArgs).slice(0,200))}</div>\`;
    }
    if (entry.problem) {
      content += \`<div class="timeline-content" style="color:#ef4444;">\${escapeHtml(entry.problem.summary)}</div>\`;
    } else {
      content += \`<div class="timeline-content" style="color:#22c55e;">Result OK</div>\`;
    }
    if (entry.claims && entry.claims.length) {
      for (const c of entry.claims) {
        content += \`<div class="timeline-content" style="color:#ffb84d;"><span class="mono">Claim: </span>\${escapeHtml(c.excerpt)}</div>\`;
      }
    }
    div.className = klass;
    div.innerHTML = content;
    frag.appendChild(div);
  }
  el.appendChild(frag);
}

function renderMismatches() {
  const el = document.getElementById('mismatchTable');
  const mm = DATA.mismatches || [];
  if (!mm.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>No mismatches found — all tool results match agent claims.</div>';
    return;
  }
  const rows = mm.map(m => \`
    <tr>
      <td><span class="tool-name">\${escapeHtml(m.tool)}</span></td>
      <td class="mono">\${m.step}</td>
      <td class="mono">\${escapeHtml(m.callId || '—')}</td>
      <td><span class="badge badge-mismatch">\${escapeHtml(m.problemType)}</span></td>
      <td class="mono">\${escapeHtml(m.resultSummary)}</td>
      <td class="excerpt">\${escapeHtml(m.claim.excerpt)}</td>
      <td class="mono">call:\${m.references.callLine || '—'} res:\${m.references.resultLine || '—'} claim:\${m.references.claimLine || '—'}</td>
    </tr>\`).join('');
  el.innerHTML = \`
    <table>
      <thead><tr><th>Tool</th><th>Step</th><th>Call ID</th><th>Problem</th><th>Result</th><th>Claim Excerpt</th><th>Refs (line)</th></tr></thead>
      <tbody>\${rows}</tbody>
    </table>\`;
}

function renderPairs() {
  const el = document.getElementById('pairsView');
  const mm = DATA.mismatches || [];
  if (!mm.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>No mismatches to display.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const m of mm) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom = '16px';
    const resultJson = m.result ? JSON.stringify(m.result, null, 2) : '{}';
    const callArgsJson = m.callArgs ? JSON.stringify(m.callArgs, null, 2) : '{}';
    div.innerHTML = \`
      <h2><span class="tool-name">\${escapeHtml(m.tool)}</span> · Step \${m.step} · <span class="badge badge-mismatch">\${escapeHtml(m.problemType)}</span></h2>
      <div class="detail-row">
        <div class="detail-col">
          <h3>Tool Call</h3>
          <pre>\${escapeHtml(callArgsJson)}</pre>
        </div>
        <div class="detail-col">
          <h3>Tool Result</h3>
          <pre style="color:#ef4444;">\${escapeHtml(resultJson)}</pre>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-col">
          <h3>Agent Claim</h3>
          <pre style="color:#ffb84d;">\${escapeHtml(m.claim.excerpt)}</pre>
        </div>
        <div class="detail-col">
          <h3>References</h3>
          <pre>call line: \${m.references.callLine || '—'}\nresult line: \${m.references.resultLine || '—'}\nclaim line: \${m.references.claimLine || '—'}</pre>
        </div>
      </div>
    \`;
    frag.appendChild(div);
  }
  el.appendChild(frag);
}

// Support loading external report JSON via file input / drag-drop (for web/index.html).
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
  const drop = document.body; // not used in embedded report
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,.jsonl';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
}
</script>
</body>
</html>
`;

function _writeFile(dir, name, content) {
  const outPath = path.join(dir, name);
  fs.writeFileSync(outPath, content, 'utf8');
  return outPath;
}

/**
 * Write JSON and self-contained HTML reports.
 * @param {object} analysis - output from analyzeTrace
 * @param {object} opts - { outDir, traceFile, exportFixturePath }
 * @returns {object} { htmlPath, jsonPath, fixturePath?, payload }
 */
function writeReports(analysis, opts = {}) {
  const outDir = opts.outDir || path.join(process.cwd(), 'truth-report');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    timestamp: new Date().toISOString(),
    traceFile: opts.traceFile || 'unknown',
    summary: analysis.summary,
    mismatches: analysis.mismatches,
    timeline: analysis.timeline,
    pairs: analysis.mismatches,
  };

  const jsonPath = _writeFile(outDir, 'report.json', JSON.stringify(payload, null, 2));

  // Embed data into HTML template.
  const htmlContent = HTML_TEMPLATE.replace('__REPORT_DATA__', JSON.stringify(payload));
  const htmlPath = _writeFile(outDir, 'report.html', htmlContent);

  let fixturePath = null;
  if (opts.exportFixturePath) {
    const fixture = {
      version: 1,
      sourceTrace: opts.traceFile,
      normalized: analysis.timeline,
      mismatches: analysis.mismatches,
    };
    const abs = path.resolve(opts.exportFixturePath);
    const fixtureDir = path.dirname(abs);
    if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(fixture, null, 2), 'utf8');
    fixturePath = abs;
  }

  return { htmlPath, jsonPath, fixturePath, payload };
}

module.exports = { writeReports };