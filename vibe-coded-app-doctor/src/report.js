const CATEGORIES = [
  { key: 'hardcoded-secrets', label: 'Hardcoded Secrets', icon: '🔑', desc: 'API keys, tokens, passwords embedded in source code.' },
  { key: 'missing-env-validation', label: 'Missing Env Validation', icon: '🔐', desc: 'Configuration read without schema/check or missing .env.example.' },
  { key: 'unhandled-errors', label: 'Unhandled Errors', icon: '⚠️', desc: 'Async code paths that can reject without catch/try.' },
  { key: 'dependency-issues', label: 'Dependency Issues', icon: '📦', desc: 'Unpinned deps, missing lockfile, floating versions.' },
  { key: 'exposed-endpoints', label: 'Exposed Endpoints', icon: '🌐', desc: 'Overly permissive CORS, 0.0.0.0 binds, debug/admin routes.' },
  { key: 'missing-tests', label: 'Missing Tests', icon: '🧪', desc: 'No test files or test script configured.' },
];

const SEV = { high: 'High', medium: 'Medium', low: 'Low' };
const SEV_COLOR = { high: '#dc2626', medium: '#f59e0b', low: '#10b981' };

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderHtmlReport(data) {
  const { scannedAt, root, stats, summary, issues } = data;
  const catMeta = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
  const categoriesWithIssues = CATEGORIES.filter(c => (summary.byCategory[c.key] || 0) > 0);

  const issueRows = issues.map((it, idx) => {
    const cat = catMeta[it.category] || { label: it.category, icon: '📋', desc: '' };
    return `<tr data-sev="${it.severity}" data-cat="${it.category}">
      <td class="num">${idx + 1}</td>
      <td><span class="sev-badge" style="background:${SEV_COLOR[it.severity]}">${SEV[it.severity]}</span></td>
      <td><span class="cat-badge" title="${escapeHtml(cat.desc)}">${escapeHtml(cat.icon)} ${escapeHtml(cat.label)}</span></td>
      <td class="file-cell"><code>${escapeHtml(it.file)}:${it.line}</code></td>
      <td class="title-cell">${escapeHtml(it.title)}</td>
      <td class="detail-cell">${escapeHtml(it.detail)}</td>
      <td class="fix-cell">${escapeHtml(it.fix)}</td>
    </tr>`;
  }).join('');

  const catSummary = CATEGORIES.map(c => {
    const count = summary.byCategory[c.key] || 0;
    if (!count) return '';
    return `<li><span class="cat-icon">${c.icon}</span> <strong>${escapeHtml(c.label)}</strong>: ${count}</li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vibe-Coded App Doctor — Report</title>
<style>
:root { --bg:#0f172a; --panel:#111827; --text:#e5e7eb; --muted:#9ca3af; --border:#1f2937; --accent:#22d3ee; }
@media (prefers-color-scheme: light) { :root { --bg:#f8fafc; --panel:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb; --accent:#0891b2; } }
* { box-sizing:border-box; }
body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
header { background:var(--panel); border-bottom:1px solid var(--border); padding:1.25rem 1.5rem; position:sticky; top:0; z-index:10; }
h1 { margin:0; font-size:1.25rem; font-weight:600; display:flex; align-items:center; gap:.5rem; }
h1::before { content:"🩺"; font-size:1.3rem; }
.meta { font-size:.85rem; color:var(--muted); margin-top:.25rem; }
main { padding:1.5rem; max-width:1400px; margin:0 auto; }
.summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem; margin-bottom:1.5rem; }
.card { background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:1rem; }
.card h3 { margin:0 0 .5rem; font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
.card .val { font-size:1.75rem; font-weight:700; }
.card .val.ok { color:#10b981; }
.card .val.warn { color:#f59e0b; }
.card .val.err { color:#dc2626; }
table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
th, td { padding:.6rem .75rem; text-align:left; border-bottom:1px solid var(--border); vertical-align:top; font-size:.85rem; }
th { background:#0b1220; color:var(--muted); font-weight:600; text-transform:uppercase; font-size:.7rem; letter-spacing:.05em; }
tr:last-child td { border-bottom:none; }
tr[data-sev="high"] td.num::after { content:""; display:inline-block; width:6px; height:6px; background:#dc2626; border-radius:50%; margin-left:.5rem; vertical-align:middle; }
tr[data-sev="medium"] td.num::after { content:""; display:inline-block; width:6px; height:6px; background:#f59e0b; border-radius:50%; margin-left:.5rem; vertical-align:middle; }
tr[data-sev="low"] td.num::after { content:""; display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%; margin-left:.5rem; vertical-align:middle; }
.num { width:3rem; font-variant-numeric:tabular-nums; }
.sev-badge { display:inline-block; padding:.1rem .4rem; border-radius:999px; font-size:.65rem; font-weight:700; color:#fff; text-transform:uppercase; }
.cat-badge { display:inline-flex; align-items:center; gap:.3rem; padding:.1rem .5rem; background:rgba(34,211,238,.12); border:1px solid rgba(34,211,238,.3); border-radius:999px; font-size:.7rem; font-weight:500; }
.file-cell code { font-size:.75rem; background:rgba(0,0,0,.2); padding:.1rem .35rem; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; max-width:220px; }
.title-cell { max-width:280px; font-weight:500; }
.detail-cell, .fix-cell { max-width:360px; color:var(--muted); }
.fix-cell { color:var(--accent); }
@media (max-width: 900px) {
  .file-cell code { max-width:160px; }
  .title-cell, .detail-cell, .fix-cell { max-width:180px; }
}
.empty { text-align:center; padding:3rem; color:var(--muted); }
footer { text-align:center; padding:1.5rem; color:var(--muted); font-size:.8rem; border-top:1px solid var(--border); margin-top:1.5rem; }
</style>
</head>
<body>
<header>
  <h1>Vibe-Coded App Doctor</h1>
  <div class="meta">Scanned ${escapeHtml(root)} · ${new Date(scannedAt).toLocaleString()} · ${stats.filesScanned} code files / ${stats.totalFiles} total · ${summary.total} issues found</div>
</header>
<main>
  <section class="summary-grid">
    <div class="card"><h3>Issues</h3><div class="val ${summary.total===0?'ok':summary.byCategory['hardcoded-secrets']||summary.byCategory['unhandled-errors']?'err':'warn'}">${summary.total}</div></div>
    <div class="card"><h3>Files Scanned</h3><div class="val">${stats.filesScanned}</div></div>
    <div class="card"><h3>Categories Hit</h3><div class="val">${Object.keys(summary.byCategory).length} / ${CATEGORIES.length}</div></div>
    <div class="card"><h3>High Severity</h3><div class="val ${(issues.filter(i=>i.severity==='high').length?'err':'ok')}">${issues.filter(i=>i.severity==='high').length}</div></div>
  </section>
  <section style="margin-bottom:1.5rem;">
    <h3 style="margin:0 0 .5rem;">Categories with findings</h3>
    <ul style="list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:.5rem; margin:0;">${catSummary}</ul>
  </section>
  <section>
    ${summary.total === 0
      ? '<div class="empty">🎉 No issues detected in the scanned categories.</div>'
      : `<table><thead><tr><th>#</th><th>Severity</th><th>Category</th><th>Location</th><th>Issue</th><th>Details</th><th>Suggested Fix</th></tr></thead><tbody>${issueRows}</tbody></table>`
    }
  </section>
</main>
<footer>Generated by <a href="https://github.com/awiseguy88/AgentWiseAI" style="color:var(--accent);">Vibe-Coded App Doctor</a> — offline, zero-dependency scan</footer>
</body>
</html>`;
}

module.exports = { renderHtmlReport };
