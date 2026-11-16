'use strict';

const fs = require('fs');
const path = require('path');
const { cloudTokenCost } = require('./cost');

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n, d = 6) { return +Number(n).toFixed(d); }

function buildModelSummary(modelSpec, tasks, results, pricing) {
  const perTask = tasks.map((t, i) => {
    const r = results[i];
    const cost = cloudTokenCost(r.tokens_in, r.tokens_out, pricing);
    return {
      task_id: t.id,
      title: t.title,
      type: t.type,
      pass: !!r.pass,
      reason: r.reason,
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
      latency_ms: r.latency_ms,
      tool_call: r.tool_call || null,
      cost_usd: cost,
    };
  });
  const total = perTask.length;
  const passed = perTask.filter(x => x.pass).length;
  const failed = perTask.filter(x => !x.pass);
  const toolTasks = tasks.filter(t => t.checker && t.checker.tool);
  const toolCorrect = toolTasks.filter((t, idx) => {
    const p = perTask[tasks.indexOf(t)];
    return p && p.pass; // pass implies tool correct when tool checker used
  }).length;
  const toolAccuracy = toolTasks.length ? round(toolCorrect / toolTasks.length, 4) : null;
  const costs = perTask.map(x => x.cost_usd);
  const lats = perTask.map(x => x.latency_ms);
  return {
    model: modelSpec,
    pass_count: passed,
    fail_count: failed.length,
    total_tasks: total,
    pass_rate: total ? round(passed / total, 4) : 0,
    average_cost_usd: round(avg(costs)),
    average_latency_ms: round(avg(lats), 2),
    tool_call_accuracy: toolAccuracy,
    tool_tasks: toolTasks.length,
    failures: failed.map(x => ({ task_id: x.task_id, title: x.title, reason: x.reason, tool_call: x.tool_call })),
    tasks: perTask,
  };
}

function makeRecommendation(currentSummary, candidateSummary, opts) {
  const failures = candidateSummary.failures || [];
  const passDelta = round((candidateSummary.pass_rate - currentSummary.pass_rate) * 100, 2); // percentage points
  const costDeltaPerTask = round(candidateSummary.average_cost_usd - currentSummary.average_cost_usd);
  const monthlyRequests = Number(opts.monthlyRequests || 100000);
  const projectedMonthlySavings = round(-costDeltaPerTask * monthlyRequests, 2); // positive = saves money
  const qualityDeltaPctPoints = passDelta;

  let do_not_migrate = false;
  let verdict = 'go';
  let reason = 'Candidate meets or exceeds current model quality at acceptable cost.';

  if (failures.length > 0) {
    // any regression on checks (incl tool accuracy) => do not migrate
    do_not_migrate = true;
    verdict = 'do_not_migrate';
    const f = failures[0];
    reason = `Regression detected: task "${f.task_id}" failed (${f.reason}).`;
  } else if (candidateSummary.pass_rate < currentSummary.pass_rate) {
    // cheaper but lower pass rate tradeoff
    verdict = projectedMonthlySavings > 0 ? 'consider' : 'do_not_migrate';
    do_not_migrate = verdict === 'do_not_migrate';
    reason = projectedMonthlySavings > 0
      ? `Candidate is cheaper but has lower pass rate (${qualityDeltaPctPoints} pp). Review tradeoff.`
      : `Candidate has lower pass rate and is not cheaper.`;
  } else if (candidateSummary.pass_rate === currentSummary.pass_rate && costDeltaPerTask > 0) {
    verdict = 'consider';
    do_not_migrate = false;
    reason = 'Same pass rate but higher cost; migrate only if other benefits justify it.';
  } else {
    verdict = 'go';
    do_not_migrate = false;
    reason = 'Candidate is equal/better quality and cost-competitive.';
  }

  return {
    verdict,
    do_not_migrate,
    reason,
    quality_delta_percentage_points: qualityDeltaPctPoints,
    cost_delta_per_task_usd: costDeltaPerTask,
    projected_monthly_savings_usd: projectedMonthlySavings,
    assumptions: { monthly_requests: monthlyRequests },
    failure_evidence: failures,
  };
}

function buildReport({ current, candidates, tasks, resultsByModel, pricing, opts }) {
  const currentSummary = buildModelSummary(current, tasks, resultsByModel[current], pricing);
  const candidateSummaries = candidates.map(c => {
    const summary = buildModelSummary(c, tasks, resultsByModel[c], pricing);
    const rec = makeRecommendation(currentSummary, summary, opts || {});
    return Object.assign({}, summary, { recommendation: rec });
  });
  return {
    generated_at: new Date().toISOString(),
    tasks_total: tasks.length,
    current: currentSummary,
    candidates: candidateSummaries,
    overall: {
      any_do_not_migrate: candidateSummaries.some(c => c.recommendation.do_not_migrate),
      go_candidates: candidateSummaries.filter(c => c.recommendation.verdict === 'go').map(c => c.model),
    },
  };
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderHtml(report) {
  const modelRow = (m, isCurrent) => {
    const rec = m.recommendation;
    const verdict = rec ? `<td class="${rec.verdict}"><strong>${escapeHtml(rec.verdict.toUpperCase().replace(/_/g,' '))}</strong>${rec.do_not_migrate ? ' (do not migrate)' : ''}<br><small>${escapeHtml(rec.reason)}</small></td>` : '<td><strong>CURRENT (baseline)</strong></td>';
    return `<tr>
      <td>${escapeHtml(m.model)} ${isCurrent ? '(current)' : '(candidate)'}</td>
      <td>${(m.pass_rate * 100).toFixed(1)}% (${m.pass_count}/${m.total_tasks})</td>
      <td>$${m.average_cost_usd}</td>
      <td>${m.average_latency_ms} ms</td>
      <td>${m.tool_call_accuracy == null ? 'n/a' : (m.tool_call_accuracy * 100).toFixed(1) + '%'}</td>
      ${verdict}
    </tr>`;
  };

  const failureBlocks = report.candidates.map(c => {
    if (!c.failures.length) return '';
    const items = c.failures.map(f => `<li><strong>${escapeHtml(f.task_id)}</strong>: ${escapeHtml(f.reason)}${f.tool_call ? ` (tool_call: ${escapeHtml(f.tool_call)})` : ''}</li>`).join('');
    return `<div class="block bad"><h3>Failure evidence — ${escapeHtml(c.model)}</h3><ul>${items}</ul></div>`;
  }).join('');

  const tradeoffs = report.candidates.map(c => {
    const r = c.recommendation;
    return `<div class="block"><h3>Cost vs Quality — ${escapeHtml(c.model)}</h3>
      <p>Quality delta: <strong>${r.quality_delta_percentage_points} percentage points</strong> (pass rate vs current). Cost delta per task: <strong>$${r.cost_delta_per_task_usd}</strong>.</p>
      <p>Projected monthly savings (assumes ${r.assumptions.monthly_requests} requests/month): <strong>$${r.projected_monthly_savings_usd}</strong> ${r.projected_monthly_savings_usd >= 0 ? '(savings)' : '(extra cost)'}.</p>
    </div>`;
  }).join('');

  const perTaskRows = report.current.tasks.map((t, i) => {
    const cells = [report.current, ...report.candidates].map(m => {
      const x = m.tasks[i];
      const cls = x.pass ? 'pass' : 'fail';
      return `<td class="${cls}">${x.pass ? 'PASS' : 'FAIL'}<br><small>${escapeHtml(x.reason)}</small></td>`;
    }).join('');
    return `<tr><td>${escapeHtml(t.task_id)}</td><td>${escapeHtml(t.type)}</td>${cells}</tr>`;
  }).join('');

  const headers = [report.current, ...report.candidates].map(m => `<th>${escapeHtml(m.model)}</th>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>LLM Model Migration Watch Report</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;margin:24px;color:#111;line-height:1.45}
    table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f4f6f8;text-align:left}
    .pass{color:#0a7a2f;font-weight:600}.fail{color:#b00020;font-weight:600}
    .go{color:#0a7a2f}.consider{color:#8a5a00}.do_not_migrate{color:#b00020}
    .summary{padding:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px}
    .block{padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin:12px 0;background:#fff}
    .block.bad{border-color:#f3c2c2;background:#fff7f7}
    h1{margin-bottom:4px}.meta{color:#555;margin-top:0}
  </style></head><body>
  <h1>LLM Model Migration Watch — Comparison Report</h1>
  <p class="meta">Generated: ${escapeHtml(report.generated_at)} | Tasks: ${report.tasks_total}</p>
  <div class="summary">
    <h2>Per-model summary</h2>
    <table><thead><tr><th>Model</th><th>Pass rate</th><th>Avg cost/task</th><th>Avg latency</th><th>Tool-call accuracy</th><th>Recommendation</th></tr></thead>
    <tbody>${modelRow(report.current, true)}${report.candidates.map(c => modelRow(c, false)).join('')}</tbody></table>
    <p><strong>Overall:</strong> ${report.overall.any_do_not_migrate ? 'At least one candidate is marked DO NOT MIGRATE.' : 'No blocking regressions detected.'}</p>
  </div>
  ${failureBlocks}
  ${tradeoffs}
  <h2>Per-task comparison</h2>
  <table><thead><tr><th>Task</th><th>Type</th>${headers}</tr></thead><tbody>${perTaskRows}</tbody></table>
  </body></html>`;
}

function writeReport(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.html'), renderHtml(report));
}

module.exports = { buildReport, buildModelSummary, makeRecommendation, writeReport, renderHtml };