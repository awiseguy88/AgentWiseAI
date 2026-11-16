'use strict';

const fs = require('fs');
const path = require('path');
const { cloudTokenCost, electricityCost } = require('./cost');

function buildReport(tasks, localResults, cloudResults, opts) {
  const perTask = tasks.map((t, i) => {
    const l = localResults[i];
    const c = cloudResults[i];
    const localElec = electricityCost(l.latency_ms, opts.localWatts, opts.electricityRate);
    const cloudCost = cloudTokenCost(c.tokens_in, c.tokens_out, opts.pricing);
    let recommendation = 'api';
    let rationale = 'cloud performed better or local failed';
    if (l.pass && c.pass) {
      recommendation = localElec <= cloudCost ? 'local' : 'api';
      rationale = recommendation === 'local' ? 'local passed at equal/lower estimated cost' : 'cloud passed at lower token cost than local electricity estimate';
    } else if (l.pass && !c.pass) {
      recommendation = 'local';
      rationale = 'local passed, cloud failed';
    } else if (!l.pass && c.pass) {
      recommendation = 'api';
      rationale = 'cloud passed, local failed';
    } else {
      recommendation = 'api';
      rationale = 'neither passed reliably; prefer stronger (API) model';
    }
    return {
      id: t.id, title: t.title, type: t.type,
      local: { pass: l.pass, reason: l.reason, tokens_in: l.tokens_in, tokens_out: l.tokens_out, latency_ms: l.latency_ms, estimated_electricity_usd: localElec },
      cloud: { pass: c.pass, reason: c.reason, tokens_in: c.tokens_in, tokens_out: c.tokens_out, latency_ms: c.latency_ms, token_cost_usd: cloudCost },
      recommendation, rationale,
    };
  });
  const localPass = perTask.filter(x => x.local.pass).length;
  const cloudPass = perTask.filter(x => x.cloud.pass).length;
  const localWins = perTask.filter(x => x.recommendation === 'local').length;
  const apiWins = perTask.filter(x => x.recommendation === 'api').length;
  const overall = localWins >= apiWins && localPass >= cloudPass ? 'local-preferred-for-many-tasks' : (localWins > 0 ? 'mixed' : 'api-preferred');
  return {
    summary: {
      total_tasks: perTask.length,
      local_pass: localPass,
      cloud_pass: cloudPass,
      local_pass_rate: perTask.length ? +(localPass / perTask.length).toFixed(3) : 0,
      cloud_pass_rate: perTask.length ? +(cloudPass / perTask.length).toFixed(3) : 0,
      recommended_local: localWins,
      recommended_api: apiWins,
      overall_routing: overall,
      assumptions: { local_watts: opts.localWatts, electricity_rate_usd_per_kwh: opts.electricityRate, pricing: opts.pricing }
    },
    tasks: perTask,
  };
}

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderHtml(report) {
  const rows = report.tasks.map(t => `<tr>
    <td>${escapeHtml(t.id)}</td><td>${escapeHtml(t.type)}</td>
    <td class="${t.local.pass?'pass':'fail'}">${t.local.pass?'PASS':'FAIL'}</td>
    <td>${t.local.tokens_in}/${t.local.tokens_out}</td><td>$${t.local.estimated_electricity_usd}</td>
    <td class="${t.cloud.pass?'pass':'fail'}">${t.cloud.pass?'PASS':'FAIL'}</td>
    <td>${t.cloud.tokens_in}/${t.cloud.tokens_out}</td><td>$${t.cloud.token_cost_usd}</td>
    <td><strong>${escapeHtml(t.recommendation.toUpperCase())}</strong></td>
    <td>${escapeHtml(t.rationale)}</td>
  </tr>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Local Model Fit Checker Report</title>
  <style>body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #ddd;padding:8px;vertical-align:top}th{background:#f4f6f8}.pass{color:#0a7a2f;font-weight:600}.fail{color:#b00020;font-weight:600}.summary{margin-bottom:16px;padding:12px;background:#f8fafc;border:1px solid #e5e7eb}</style>
  </head><body>
  <h1>Local Model Coding Fit Checker — Routing Report</h1>
  <div class="summary">
    <p><strong>Overall routing:</strong> ${escapeHtml(report.summary.overall_routing)}</p>
    <p>Tasks: ${report.summary.total_tasks} | Local pass: ${report.summary.local_pass} (${report.summary.local_pass_rate}) | Cloud pass: ${report.summary.cloud_pass} (${report.summary.cloud_pass_rate})</p>
    <p>Recommendations — Local: ${report.summary.recommended_local}, API: ${report.summary.recommended_api}</p>
    <p>Assumptions: ${report.summary.assumptions.local_watts}W @ $${report.summary.assumptions.electricity_rate_usd_per_kwh}/kWh; cloud pricing in/out per 1M tokens: $${report.summary.assumptions.pricing.input_per_million}/$${report.summary.assumptions.pricing.output_per_million}</p>
  </div>
  <table><thead><tr><th>Task</th><th>Type</th><th>Local Pass</th><th>Local Tokens in/out</th><th>Local Elec $</th><th>Cloud Pass</th><th>Cloud Tokens in/out</th><th>Cloud Token $</th><th>Route</th><th>Rationale</th></tr></thead><tbody>
  ${rows}
  </tbody></table>
  </body></html>`;
}

function writeReport(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.html'), renderHtml(report));
}

module.exports = { buildReport, writeReport, renderHtml };
