'use strict';

const fs = require('fs');
const path = require('path');

function buildReport(run, baseline, opts) {
  const o = opts || {};
  const results = run.results || [];
  const summary = run.summary || {};
  return {
    id: run.id,
    alias: run.alias || null,
    at: run.at || new Date().toISOString(),
    adapter: run.adapter || null,
    baseline_id: baseline ? (baseline.run_id || baseline.frozen_at) : null,
    thresholds: o.thresholds || run.thresholds || null,
    threshold_breached: !!run.threshold_breached,
    threshold_reasons: run.threshold_reasons || [],
    alerted: !!run.alerted,
    alert_results: run.alert_results || [],
    summary: {
      total: summary.total || results.length,
      pass_count: summary.pass_count || 0,
      fail_count: summary.fail_count || 0,
      regressed_count: summary.regressed_count || 0,
      pass_rate: summary.pass_rate != null ? summary.pass_rate : 0,
      avg_drift_score: summary.avg_drift_score || 0,
      avg_latency_ms: summary.avg_latency_ms || 0,
      total_cost_usd: summary.total_cost_usd || 0,
    },
    results: results.map(r => ({
      task_id: r.task_id,
      title: r.title,
      status: r.status,
      passed: !!r.passed,
      regressed: !!r.regressed,
      drift_score: r.drift_score || 0,
      checks: r.checks || {},
      baseline: r.baseline || null,
      current: r.current || null,
      diff: r.diff || null,
      error: r.error || null,
    })),
  };
}

function renderHtml(report) {
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const s = report.summary || {};
  const badge = report.threshold_breached ? '<span class="badge bad">BREACHED</span>' : '<span class="badge ok">OK</span>';
  const rows = (report.results || []).map(r => {
    const cls = r.regressed ? 'regressed' : (r.passed ? 'pass' : 'fail');
    const diff = r.diff && r.diff.summary ? esc(r.diff.summary) : '';
    const bTool = r.baseline && r.baseline.tool_calls ? esc(r.baseline.tool_calls.map(t=>t.name).join('>')) : '';
    const cTool = r.current && r.current.tool_calls ? esc(r.current.tool_calls.map(t=>t.name).join('>')) : '';
    return `<tr class="${cls}">
      <td>${esc(r.task_id)}</td><td>${esc(r.title||'')}</td>
      <td>${esc(r.status)}</td><td>${r.passed?'yes':'no'}</td><td>${r.regressed?'YES':'no'}</td>
      <td>${Number(r.drift_score||0).toFixed(3)}</td>
      <td class="mono">${bTool}</td><td class="mono">${cTool}</td>
      <td>${diff}</td>
    </tr>`;
  }).join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Drift Report ${esc(report.id||'')}</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#111;background:#fafafa}
h1{margin:0 0 8px} .meta{color:#555;margin-bottom:16px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 16px;min-width:140px}
.card .label{font-size:12px;color:#666;text-transform:uppercase}
.card .value{font-size:22px;font-weight:700}
.badge{padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700}
.badge.ok{background:#e6f7ea;color:#137333}.badge.bad{background:#fdecea;color:#b3261e}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd}
th,td{border-bottom:1px solid #eee;padding:8px;text-align:left;font-size:13px;vertical-align:top}
th{background:#f6f7f9} tr.regressed{background:#fff4f2} tr.fail{background:#fffaf0} tr.pass{}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}
pre{white-space:pre-wrap;background:#fff;border:1px solid #ddd;padding:12px;border-radius:6px}
</style></head><body>
<h1>Model Alias Drift Guard — Drift Report ${badge}</h1>
<div class="meta">Run: <b>${esc(report.id)}</b> · Alias: <b>${esc(report.alias||'n/a')}</b> · At: ${esc(report.at)} · Baseline: ${esc(report.baseline_id||'none')}</div>
<div class="cards">
  <div class="card"><div class="label">Tasks</div><div class="value">${s.total}</div></div>
  <div class="card"><div class="label">Pass</div><div class="value">${s.pass_count}</div></div>
  <div class="card"><div class="label">Fail</div><div class="value">${s.fail_count}</div></div>
  <div class="card"><div class="label">Regressed</div><div class="value">${s.regressed_count}</div></div>
  <div class="card"><div class="label">Pass rate</div><div class="value">${(Number(s.pass_rate||0)*100).toFixed(1)}%</div></div>
  <div class="card"><div class="label">Avg drift</div><div class="value">${Number(s.avg_drift_score||0).toFixed(3)}</div></div>
</div>
${report.threshold_reasons && report.threshold_reasons.length ? `<p><b>Threshold breaches:</b> ${esc(report.threshold_reasons.join('; '))}</p>` : '<p><b>No threshold breaches.</b></p>'}
<h2>Per-task results & diffs</h2>
<table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Passed</th><th>Regressed</th><th>Drift</th><th>Baseline tools</th><th>Current tools</th><th>Diff</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Thresholds</h2><pre>${esc(JSON.stringify(report.thresholds||{}, null, 2))}</pre>
</body></html>`;
}

function writeReport(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(htmlPath, renderHtml(report));
  return { jsonPath, htmlPath };
}

function printSummary(report, stream) {
  const out = stream || process.stdout;
  const s = report.summary || {};
  out.write(`Drift report ${report.id} alias=${report.alias||'n/a'}\n`);
  out.write(`Tasks: ${s.total} pass=${s.pass_count} fail=${s.fail_count} regressed=${s.regressed_count} pass_rate=${(Number(s.pass_rate||0)*100).toFixed(1)}%\n`);
  for (const r of (report.results||[])) {
    if (r.regressed || !r.passed) {
      const diff = r.diff && r.diff.summary ? ` diff: ${r.diff.summary}` : '';
      out.write(`- ${r.task_id} ${r.status} drift=${Number(r.drift_score||0).toFixed(3)}${diff}\n`);
      if (r.diff && r.diff.changes && r.diff.changes.length) {
        for (const c of r.diff.changes) out.write(`    * ${c.kind}: ${JSON.stringify(c)}\n`);
      }
    }
  }
  if (report.threshold_breached) out.write(`THRESHOLD BREACHED: ${(report.threshold_reasons||[]).join('; ')}\n`);
}

module.exports = { buildReport, renderHtml, writeReport, printSummary };