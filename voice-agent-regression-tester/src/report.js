const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHtml(results, meta) {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;
  const status = failed === 0 ? 'PASS' : 'FAIL';
  const rows = results.map((r) => {
    const failList = r.failures.length
      ? `<ul>${r.failures.map((f) => `<li><strong>${esc(f.type)}</strong>: ${esc(f.message)}</li>`).join('')}</ul>`
      : '<p class="ok">All assertions passed.</p>';
    const turns = (r.transcript.turns || []).map((t, idx) =>
      `<div class="turn"><div class="role">Turn ${idx + 1}</div>
       <div><b>User:</b> ${esc(t.user)}</div>
       <div><b>Agent:</b> ${esc(t.reply)}</div>
       ${t.toolCalls.length ? `<div class="tools"><b>Tools:</b> ${esc(JSON.stringify(t.toolCalls))}</div>` : ''}
       ${Object.keys(t.captured || {}).length ? `<div class="captured"><b>Captured:</b> ${esc(JSON.stringify(t.captured))}</div>` : ''}
       </div>`
    ).join('');
    return `<section class="scenario ${r.pass ? 'pass' : 'fail'}">
      <h2>${esc(r.scenario.id)} — ${r.pass ? 'PASS' : 'FAIL'}</h2>
      <p class="desc">${esc(r.scenario.description || '')}</p>
      ${failList}
      <details><summary>Transcript</summary>${turns}</details>
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Voice Agent Regression Report</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:980px;margin:0 auto;padding:1.5rem;color:#1a1a1a}
h1{border-bottom:2px solid #e5e7eb;padding-bottom:.4rem}
.scenario{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0}
.scenario.pass{border-left:6px solid #16a34a}
.scenario.fail{border-left:6px solid #dc2626}
.ok{color:#16a34a}
.turn{background:#f9fafb;border-radius:6px;padding:.6rem;margin:.5rem 0;font-size:.92rem}
.tools,.captured{color:#374151;font-size:.86rem;margin-top:.3rem}
.meta{color:#6b7280;font-size:.9rem}
</style></head>
<body>
<h1>Voice Agent Regression Report</h1>
<p class="meta">Generated ${esc(meta.timestamp)} — fixtures: ${esc(meta.fixtures || '')} — agent: ${esc(meta.agent || meta.endpoint || '')}</p>
<p class="meta"><strong>Summary:</strong> ${passed}/${total} scenarios passed — <strong>${status}</strong>${failed ? ` (${failed} failed)` : ''}</p>
${rows}
</body></html>`;
}

function writeReports(results, { outDir = 'reports/latest', fixtures, agent, endpoint } = {}) {
  const timestamp = new Date().toISOString();
  const summary = {
    timestamp,
    fixtures: fixtures || '',
    agent: agent || '',
    endpoint: endpoint || '',
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    status: results.every((r) => r.pass) ? 'PASS' : 'FAIL',
    scenarios: results,
  };
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'report.json');
  const htmlPath = path.join(dir, 'report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(htmlPath, buildHtml(results, summary));
  return { jsonPath, htmlPath, summary };
}

module.exports = { writeReports };
