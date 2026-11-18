'use strict';

const fs = require('fs');
const path = require('path');

function renderJson(report) {
  // JSON report structure consumable by agents: pass, tests[], networkCalls, errors summary.
  const errors = report.tests.filter(t => !t.pass).map(t => ({
    test: t.name,
    type: t.error && t.error.type,
    message: t.error && t.error.message,
    permission: t.error && t.error.permission || null,
    resourceArn: t.error && t.error.resourceArn || null,
  }));
  return JSON.stringify({ ...report, errors }, null, 2);
}

function renderHtml(report) {
  const rows = report.tests.map(t => {
    const status = t.pass ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
    const err = t.error ? `<pre>${escapeHtml(JSON.stringify(t.error, null, 2))}</pre>` : '';
    return `<tr><td>${status}</td><td><code>${escapeHtml(t.name)}</code></td><td>${err}</td></tr>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Agent Cloud Sandbox Report</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}.pass{color:#0a7a0a;font-weight:700}.fail{color:#b00020;font-weight:700}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}pre{margin:0;white-space:pre-wrap}</style>
</head><body>
<h1>Agent Cloud Sandbox Report</h1>
<p><strong>Result:</strong> ${report.pass ? 'PASS' : 'FAIL'} &nbsp; <strong>Network calls:</strong> ${report.networkCalls}</p>
<table><thead><tr><th>Status</th><th>Test</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function writeReport(report, outPath) {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderJson(report));
  return abs;
}

function writeHtmlReport(report, outPath) {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderHtml(report));
  return abs;
}

module.exports = { renderJson, renderHtml, writeReport, writeHtmlReport };
