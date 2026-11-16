'use strict';

const fs = require('fs');
const path = require('path');

function buildReport({ contract, phase, payload, violations, executed, sideEffect, outDir }) {
  const ok = violations.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    contract: {
      server: contract.server,
      tool: contract.tool,
      version: contract.version,
      sideEffect: contract.sideEffect || sideEffect || null,
      description: contract.description || null,
    },
    phase: phase, // 'input' | 'output'
    gate: phase === 'input' ? 'preflight (before execution)' : 'postflight (after execution)',
    executed: Boolean(executed),
    sideEffectOccurred: phase === 'output' ? true : false,
    status: ok ? 'pass' : 'fail',
    violations: violations.map((v) => ({
      field: v.field,
      keyword: v.keyword,
      message: v.message,
      expected: v.expected !== undefined ? v.expected : null,
      actual: v.actual !== undefined ? v.actual : null,
    })),
    summary: {
      status: ok ? 'pass' : 'fail',
      violations: violations.length,
      passed: ok ? 1 : 0,
    },
    payload,
  };
  return report;
}

function renderHtml(report) {
  const rows = (report.violations || []).map((v) => `
    <tr>
      <td><code>${escapeHtml(v.field)}</code></td>
      <td>${escapeHtml(v.keyword)}</td>
      <td>${escapeHtml(v.message)}</td>
      <td><code>${escapeHtml(JSON.stringify(v.expected))}</code></td>
      <td><code>${escapeHtml(JSON.stringify(v.actual))}</code></td>
    </tr>`).join('');
  const statusClass = report.status === 'pass' ? 'pass' : 'fail';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agent Contract Observatory — Violation Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 2rem; color: #1a1a1a; background: #fafafa; }
  h1 { margin-bottom: .25rem; }
  .meta { color: #555; font-size: .9rem; margin-bottom: 1.5rem; }
  .badge { display: inline-block; padding: .2rem .6rem; border-radius: 4px; font-weight: 600; }
  .pass { background: #d4edda; color: #155724; }
  .fail { background: #f8d7da; color: #721c24; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; background: #fff; }
  th, td { border: 1px solid #ddd; padding: .6rem .8rem; text-align: left; vertical-align: top; }
  th { background: #f1f1f1; }
  code { background: #eee; padding: 1px 4px; border-radius: 3px; font-size: .85em; word-break: break-all; }
  .empty { padding: 1rem; background: #fff; border: 1px solid #ddd; border-radius: 6px; margin-top: 1rem; }
  footer { margin-top: 2rem; color: #888; font-size: .8rem; }
</style>
</head>
<body>
  <h1>Agent Contract Observatory — Violation Report</h1>
  <div class="meta">
    Contract: <strong>${escapeHtml(report.contract.server)}/${escapeHtml(report.contract.tool)}</strong> @ ${escapeHtml(report.contract.version)} &nbsp;·&nbsp;
    Phase: ${escapeHtml(report.gate)} &nbsp;·&nbsp;
    Generated: ${escapeHtml(report.generatedAt)}
  </div>
  <div class="badge ${statusClass}">${report.status.toUpperCase()} — ${report.summary.violations} violation(s)</div>
  ${report.sideEffect && report.sideEffectOccurred === false ? '' : ''}
  <p class="meta">Executed: ${report.executed ? 'yes' : 'no (blocked before side effect)'}</p>
  ${report.violations.length === 0
    ? '<div class="empty">No violations. Payload conforms to the contract.</div>'
    : `<table><thead><tr><th>Field</th><th>Keyword</th><th>Reason</th><th>Expected</th><th>Actual</th></tr></thead><tbody>${rows}</tbody></table>`}
  <footer>Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/</footer>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeReport(outDir, report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(htmlPath, renderHtml(report), 'utf8');
  return { jsonPath, htmlPath, report };
}

module.exports = { buildReport, renderHtml, writeReport };
