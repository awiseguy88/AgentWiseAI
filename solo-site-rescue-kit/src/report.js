/**
 * Solo Site Rescue Kit — single-file HTML report generator.
 *
 * Produces a self-contained report.html with inline CSS/JS and embedded run data
 * (no external resources). Summarizes pages, submissions, rescued/missing assets,
 * and next steps.
 */

import { jsonEscapeForHtml } from "./utils.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate report.html contents.
 * @param {object} data - { run, inventory, extraction, rescueSummary, buildResult, options }
 */
export function generateReportHtml(data) {
  const payload = {
    generatedAt: new Date().toISOString(),
    run: data.run || {},
    inventory: summarizeInventory(data.inventory),
    rescue: data.rescueSummary || {},
    build: data.buildResult || null,
    pages: (data.extraction?.pages || []).map((p) => ({ path: p.path, name: p.name })),
    submissions: (data.extraction?.submissions || []).length,
    missing: (data.extraction?.images || [])
      .filter((i) => i.status === "missing")
      .map((i) => ({ url: i.url, page: i.page, context: i.context })),
    rescued: (data.extraction?.images || [])
      .filter((i) => i.status === "rescued")
      .map((i) => ({ url: i.url, localPath: i.localPath, page: i.page })),
  };

  const embedded = jsonEscapeForHtml(payload);
  const missingRows = payload.missing
    .map((m) => `<tr><td>${escapeHtml(m.url || "")}</td><td>${escapeHtml(m.page || "")}</td><td>${escapeHtml(m.context || "")}</td></tr>`)
    .join("");
  const rescuedRows = payload.rescued
    .map((r) => `<tr><td>${escapeHtml(r.url || "")}</td><td>${escapeHtml(r.localPath || "")}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solo Site Rescue Kit — Report</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111;line-height:1.5}
  h1{margin:0 0 8px} .meta{color:#555;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0}
  .card{border:1px solid #ddd;border-radius:8px;padding:12px;background:#fafafa}
  .card .n{font-size:28px;font-weight:700} .card .l{color:#555;font-size:13px}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;word-break:break-all}
  th{background:#f3f4f6}
  .ok{color:#166534} .warn{color:#92400e} .bad{color:#991b1b}
  code{background:#f3f4f6;padding:2px 4px;border-radius:4px}
  .section{margin:24px 0}
</style>
</head>
<body>
<h1>Solo Site Rescue Kit — Rescue Report</h1>
<p class="meta">Generated: ${escapeHtml(payload.generatedAt)} &nbsp;|&nbsp; Source: <code>${escapeHtml(payload.run.sourcePath || "")}</code> &nbsp;|&nbsp; Output: <code>${escapeHtml(payload.run.outDir || "")}</code></p>

<div class="grid">
  <div class="card"><div class="n">${payload.inventory?.pages || 0}</div><div class="l">HTML pages</div></div>
  <div class="card"><div class="n ok">${payload.rescued.length}</div><div class="l">Images rescued</div></div>
  <div class="card"><div class="n ${(payload.missing.length ? "bad" : "ok")}">${payload.missing.length}</div><div class="l">Images unrecoverable</div></div>
  <div class="card"><div class="n">${payload.submissions}</div><div class="l">Submissions found</div></div>
</div>

<div class="section">
  <h2>Build</h2>
  <p>Format: <strong>${escapeHtml(payload.build?.kind || "n/a")}</strong> &nbsp; Path: <code>${escapeHtml(payload.build?.path || "")}</code></p>
</div>

<div class="section">
  <h2>Unrecoverable assets</h2>
  ${payload.missing.length === 0 ? '<p class="ok">No unrecoverable assets. All remote references were rescued or cached.</p>' : `<table><thead><tr><th>Original URL</th><th>Page</th><th>Context</th></tr></thead><tbody>${missingRows}</tbody></table>`}
</div>

<div class="section">
  <h2>Rescued assets</h2>
  ${payload.rescued.length === 0 ? "<p>No remote assets were rescued (none found, or all were local/data URIs).</p>" : `<table><thead><tr><th>Original URL</th><th>Local path</th></tr></thead><tbody>${rescuedRows}</tbody></table>`}
</div>

<div class="section">
  <h2>Next steps</h2>
  <ul>
    <li>Open the generated site and verify pages render correctly.</li>
    <li>Review <code>MIGRATION-CHECKLIST.md</code> for manual follow-up.</li>
    <li>Re-run with network access if you have unrecoverable remote images and can go online temporarily; cached rescues are reused offline.</li>
    <li>Check <code>data/submissions.json</code> (if present) for exported contact/newsletter data.</li>
  </ul>
</div>

<script id="rescue-data" type="application/json">${embedded}</script>
</body>
</html>`;
}

function summarizeInventory(inventory) {
  if (!inventory) return null;
  return {
    pages: inventory.html?.length || 0,
    csv: inventory.csv?.length || 0,
    json: inventory.json?.length || 0,
    images: inventory.images?.length || 0,
    other: inventory.other?.length || 0,
    total: inventory.all?.length || 0,
  };
}
