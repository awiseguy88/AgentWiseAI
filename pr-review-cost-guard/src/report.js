'use strict';

// --- report.js: HTML + JSON report + markdown summary-comment payload ---

const fs = require('node:fs');
const path = require('node:path');

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function jsonReport(report) {
  return JSON.stringify(report, null, 2);
}

function htmlReport(report) {
  const { config, summary, prs } = report;
  const rows = (prs || []).map((p) => {
    const flagList = (p.flag_reasons || []).join(', ') || '—';
    return `<tr>
      <td>${esc(p.pr)}</td>
      <td>${esc(p.path)}</td>
      <td>${p.total_hunks}</td>
      <td>${p.flagged_hunks}</td>
      <td>${money(p.cheap_cost_usd)}</td>
      <td>${money(p.pricier_cost_usd)}</td>
      <td>${money(p.total_usd)}</td>
      <td>${esc(flagList)}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PR Review Cost Guard — Run Report</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #1f2937; }
  h1 { font-size: 20px; margin: 0 0 8px 0; }
  .sub { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #6b7280; }
  tr:nth-child(even) td { background: #fcfcfd; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .allowed { background: #dcfce7; color: #166534; }
  .blocked { background: #fee2e2; color: #991b1b; }
  .kvs td:first-child { font-weight: 600; color: #6b7280; width: 30%; }
  .note { margin-top: 16px; font-size: 13px; color: #6b7280; }
  .money { font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>PR Review Cost Guard — Run Report</h1>
<div class="sub">Generated ${esc(report.generated_at)} · Offline-first · No per-review metering</div>

<table class="kvs">
  <tr><td>PRs scanned</td><td>${summary.pr_count}</td></tr>
  <tr><td>Total hunks</td><td>${summary.total_hunks}</td></tr>
  <tr><td>Flagged hunks (pricier review)</td><td>${summary.flagged_hunks}</td></tr>
  <tr><td>Estimated cost this run</td><td class="money">$${money(summary.estimated_cost_usd)}</td></tr>
  <tr><td>Monthly cap</td><td class="money">$${money(summary.cap_usd)}</td></tr>
  <tr><td>Remaining after run</td><td class="money">$${money(summary.remaining_usd)}</td></tr>
  <tr><td>Status</td><td><span class="badge ${summary.status}">${summary.status === 'allowed' ? '✅ allowed' : '⛔ blocked'}</span></td></tr>
</table>

<table>
  <thead><tr>
    <th>PR</th><th>Path</th><th>Hunks</th><th>Flagged</th><th>Cheap \$</th><th>Pricier \$</th><th>Total \$</th><th>Flag reasons</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="note">
  Cost model: cheap model scans every hunk (${esc(config.cheap_model)}, \$${money(config.cheap_input_price)}/1K input tokens);
  only flagged hunks go to the pricier model (${esc(config.pricier_model)}).<br>
  The cheap first-pass is a local heuristic — no model call and no network is made by this tool.<br>
  This tool never auto-approves or merges pull requests.
</div>
</body>
</html>`;
}

function commentPayload(report) {
  const s = report.summary;
  const lines = [
    '## PR Review Cost Guard — run report',
    '',
    `- PRs scanned: ${s.pr_count}`,
    `- Hunks: ${s.total_hunks} total · ${s.flagged_hunks} flagged for pricier review`,
    `- Estimated cost this run: **$${money(s.estimated_cost_usd)}**`,
    `- Monthly cap: **$${money(s.cap_usd)}** · Remaining: **$${money(s.remaining_usd)}**`,
    `- Status: ${s.status === 'allowed' ? '✅ Allowed within budget' : '⛔ Blocked — over monthly budget'}`,
    '',
    'This tool never auto-approves or merges pull requests.',
  ];
  if (report.html_path) lines.push(`Full HTML report: ${esc(report.html_path)}`);
  return lines.join('\n');
}

function writeReports(outDir, report) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `cost-guard-report-${report.run_id || 'run'}`);
  const jsonPath = base + '.json';
  const htmlPath = base + '.html';
  fs.writeFileSync(jsonPath, jsonReport(report), 'utf8');
  fs.writeFileSync(htmlPath, htmlReport(report), 'utf8');
  return { jsonPath, htmlPath };
}

module.exports = { esc, money, jsonReport, htmlReport, commentPayload, writeReports };
