import fs from 'node:fs';
import path from 'node:path';

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function writeJsonReport(report, outDir) {
  const p = path.join(outDir, 'report.json');
  fs.writeFileSync(p, JSON.stringify(report, null, 2), 'utf8');
  return p;
}

export function writeHtmlReport(report, outDir) {
  const rows = report.steps.map(s => `<tr>
    <td>${s.index}</td><td>${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.span || '')}</td>
    <td>${s.duration_ms ?? ''}</td><td>${s.prompt_tokens ?? ''}</td><td>${s.completion_tokens ?? ''}</td><td>${s.total_tokens ?? ''}</td><td>${s.quality ?? ''}</td>
    <td class="preview">${esc(s.input_preview)}</td><td class="preview">${esc(s.output_preview)}</td>
  </tr>`).join('\n');
  const alerts = (report.alerts || []).map(a => `<li class="sev-${esc(a.severity||'info')}"><strong>${esc(a.type)}</strong> [${esc(a.severity||'info')}] — ${esc(a.message)}</li>`).join('\n') || '<li>No alerts.</li>';
  const spans = (report.span_breakdown || []).map(sp => `<tr><td>${esc(sp.span)}</td><td>${sp.steps}</td><td>${sp.total_duration_ms}</td><td>${sp.total_tokens}</td></tr>`).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Drift & Step-Level Monitor Report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111}
h1{margin-bottom:0}.meta{color:#555;margin-top:4px}
.summary{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.card{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:160px;background:#fafafa}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;text-align:left}
th{background:#f3f4f6} .preview{max-width:260px;white-space:pre-wrap;word-break:break-word}
.sev-critical{color:#b91c1c}.sev-warning{color:#92400e}.sev-info{color:#1f2937}
code{background:#f3f4f6;padding:1px 4px;border-radius:4px}
</style></head><body>
<h1>Agent Drift &amp; Step-Level Monitor</h1>
<p class="meta">Generated ${esc(report.generated_at)} · offline report</p>
<div class="summary">
  <div class="card"><strong>Steps</strong><div>${report.summary.steps}</div></div>
  <div class="card"><strong>Total duration (ms)</strong><div>${report.summary.total_duration_ms}</div></div>
  <div class="card"><strong>Total tokens</strong><div>${report.summary.total_tokens}</div></div>
  <div class="card"><strong>Spans</strong><div>${(report.summary.spans||[]).length}</div></div>
  <div class="card"><strong>Alerts</strong><div>${(report.alerts||[]).length}</div></div>
</div>
<h2>Alerts</h2><ul>${alerts}</ul>
<h2>Span breakdown</h2>
<table><thead><tr><th>Span</th><th>Steps</th><th>Total duration (ms)</th><th>Total tokens</th></tr></thead><tbody>${spans || '<tr><td colspan="4">No span data</td></tr>'}</tbody></table>
<h2>Step-level breakdown</h2>
<table><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Span</th><th>Duration (ms)</th><th>Prompt</th><th>Completion</th><th>Total tokens</th><th>Quality</th><th>Input</th><th>Output</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Trends</h2><pre>${esc(JSON.stringify(report.trends, null, 2))}</pre>
</body></html>`;
  const p = path.join(outDir, 'report.html');
  fs.writeFileSync(p, html, 'utf8');
  return p;
}
