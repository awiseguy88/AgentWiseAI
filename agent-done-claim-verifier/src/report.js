'use strict';

const fs = require('fs');
const path = require('path');

function writeReports(result, opts) {
  const outDir = path.resolve(opts.outDir || path.join(process.cwd(), 'done-claim-report'));
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  const payload = buildPayload(result, opts);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(htmlPath, renderHtml(payload));
  return { outDir, jsonPath, htmlPath, payload };
}

function buildPayload(result, opts) {
  return {
    tool: 'agent-done-claim-verifier',
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    source: opts.source || null,
    format: opts.format || null,
    summary: result.summary,
    claims: result.claims,
    hookSnippets: opts.snippets || []
  };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderHtml(payload) {
  const rows = payload.claims.map((c, i) => `
    <tr class="status-${esc(c.status)}">
      <td>${i + 1}</td>
      <td><span class="badge ${esc(c.status)}">${esc(c.status)}</span></td>
      <td>${esc(c.claimType)}</td>
      <td class="excerpt">${esc(c.excerpt || c.claimText)}</td>
      <td><ul>${(c.reasons||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul></td>
      <td>${esc(c.evidence?.matchedCommand || '—')} ${c.evidence?.matchedExitCode !== null && c.evidence?.matchedExitCode !== undefined ? `(exit ${esc(c.evidence.matchedExitCode)})` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6">No completion claims detected.</td></tr>';

  const hooks = (payload.hookSnippets||[]).map(h => `
    <section class="hook">
      <h3>${esc(h.name)}</h3>
      <p>${esc(h.description)}</p>
      <p><strong>File:</strong> <code>${esc(h.file)}</code></p>
      <pre>${esc(h.content || '')}</pre>
    </section>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Agent Done Claim Verifier Report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111;line-height:1.4}
h1{margin-bottom:0.2rem} .meta{color:#555;margin-bottom:1rem}
.summary{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.card{border:1px solid #ddd;border-radius:8px;padding:12px 16px;min-width:140px;background:#fafafa}
.card .num{font-size:1.6rem;font-weight:700}
table{border-collapse:collapse;width:100%;margin-top:12px;font-size:0.95rem}
th,td{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left}
th{background:#f3f4f6}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:600;font-size:0.85rem}
.badge.verified{background:#dcfce7;color:#166534}
.badge.unverified{background:#fee2e2;color:#991b1b}
.excerpt{max-width:420px}
pre{background:#0b1020;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto}
code{background:#f3f4f6;padding:1px 4px;border-radius:4px}
.hook{margin:16px 0}
ul{margin:0;padding-left:18px}
</style>
</head>
<body>
<h1>Agent Done Claim Verifier Report</h1>
<p class="meta">Source: <code>${esc(payload.source || '')}</code> · Format: ${esc(payload.format || '')} · Generated: ${esc(payload.generatedAt)}</p>
<div class="summary">
  <div class="card"><div>Total claims</div><div class="num">${payload.summary.total}</div></div>
  <div class="card"><div>Verified</div><div class="num">${payload.summary.verified}</div></div>
  <div class="card"><div>Unverified</div><div class="num">${payload.summary.unverified}</div></div>
</div>
<h2>Claim verification</h2>
<table>
<thead><tr><th>#</th><th>Status</th><th>Type</th><th>Claim excerpt</th><th>Reasons</th><th>Matched evidence</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Starter hook-policy snippets</h2>
<p>Use these local guardrail snippets to require passing command evidence before accepting “done/test passed/build succeeded” claims in popular agent CLIs. Adapt paths/commands to your project.</p>
${hooks || '<p>No snippets bundled.</p>'}
</body>
</html>`;
}

module.exports = { writeReports, buildPayload, renderHtml };
