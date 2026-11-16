'use strict';

const fs = require('fs');
const path = require('path');
const { getRun } = require('./db');

function jsonReport(run) {
  const lines = [];
  lines.push(JSON.stringify({ run_id: run.id, name: run.name, imported_at: run.importedAt, aggregate: run.aggregate, gate: run.gate }, null, 2));
  for (const t of run.turns) {
    lines.push(JSON.stringify({ turn_index: t.index, role: t.role, step_signature: t.step_signature, metrics: t.metrics }));
  }
  return lines.join('\n');
}

function htmlReport(run) {
  const rows = run.turns.map(t => `
    <tr>
      <td>${t.index}</td>
      <td>${esc(t.role || 'assistant')}</td>
      <td>${esc(t.metrics.verbosity_ratio)}</td>
      <td>${esc(t.metrics.redundancy)}</td>
      <td>${esc(t.metrics.step_signature_repetition)}</td>
      <td>${esc(t.metrics.claim_density)}</td>
      <td>${esc(t.metrics.code_yield)}</td>
      <td class="num">${esc(t.metrics.slop_score)}</td>
      <td>${esc(t.step_signature || '')}</td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Quality Report — ${esc(run.name)}</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;line-height:1.5}
h1{font-size:20px} table{border-collapse:collapse;width:100%;margin-top:16px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}
th{background:#f4f4f4} .num{text-align:right} .pass{color:#166534} .fail{color:#b91c1c;font-weight:700}
.meta{margin-bottom:16px} .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
.pass-badge{background:#dcfce7;color:#166534} .fail-badge{background:#fee2e2;color:#b91c1c}
</style></head><body>
<h1>Agent Output Quality Report</h1>
<div class="meta">
  <strong>Run:</strong> ${esc(run.name)} &nbsp;
  <strong>Imported:</strong> ${esc(run.importedAt)} &nbsp;
  <strong>Turns:</strong> ${run.aggregate.turn_count} &nbsp;
  <strong>Mean slop:</strong> ${run.aggregate.mean_slop} &nbsp;
  <strong>Max slop:</strong> ${run.aggregate.max_slop}
</div>
<span class="badge ${run.gate.pass ? 'pass-badge' : 'fail-badge'}">${run.gate.pass ? 'GATE PASS' : 'GATE FAIL'}</span>
<table><thead><tr><th>Turn</th><th>Role</th><th>Verbosity</th><th>Redundancy</th><th>Step Repetition</th><th>Claim Density</th><th>Code Yield</th><th>Slop Score</th><th>Step Signature</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function writeReport(runId, options = {}) {
  const run = getRun(runId);
  if (!run) throw new Error(`run ${runId} not found`);
  const outDir = options.outDir || path.resolve(process.cwd(), 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${outDir}/run-${runId}`;
  const json = jsonReport(run);
  const html = htmlReport(run);
  const jsonPath = `${base}.json`;
  const htmlPath = `${base}.html`;
  fs.writeFileSync(jsonPath, json, 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');
  return { jsonPath, htmlPath, runId, runName: run.name, gatePass: run.gate.pass };
}

module.exports = { writeReport, htmlReport, jsonReport, esc };
