import * as fs from "fs";
import * as path from "path";
import { analyzeRun } from "./analyze.js";
import { compareDrift, RegressionRecord } from "./drift.js";
import { NormalizedRun, Report, DriftComparison } from "./types.js";

export function buildReport(
  runs: NormalizedRun[],
  source: string,
  opts?: { baseline?: RegressionRecord[]; current?: RegressionRecord[] },
): Report {
  const analyses = runs.map(analyzeRun);

  let drift: DriftComparison[] = [];
  if (opts?.baseline && opts?.current) {
    drift = compareDrift(opts.baseline, opts.current, runs);
  }

  const totalCost = analyses.reduce((a, r) => a + r.total_cost_usd, 0);
  const attributed = analyses
    .filter((r) => r.workflow || r.customer)
    .reduce((a, r) => a + r.total_cost_usd, 0);
  const unattributed = totalCost - attributed;

  const retry_loops = analyses
    .filter((r) => r.retry.inflated)
    .map((r) => ({
      run_id: r.run_id,
      workflow: r.workflow ?? r.customer,
      looping_step: r.retry.looping_step,
      intended: r.retry.intended_calls,
      actual: r.retry.actual_calls,
    }));

  const context_creep = analyses.map((r) => ({
    run_id: r.run_id,
    ratio: r.context_creep.ratio,
    flagged: r.context_creep.flagged,
  }));

  const findings: string[] = [];
  for (const r of analyses) {
    if (r.retry.inflated) {
      findings.push(
        `Retry loop in ${r.run_id} (customer/workflow: ${r.customer ?? r.workflow ?? "unknown"}): step '${r.retry.looping_step ?? "?"}' ${r.retry.actual_calls} actual calls vs ${r.retry.intended_calls} intended.`,
      );
    }
    if (r.context_creep.flagged) {
      findings.push(
        `Context creep in ${r.run_id}: context-growth ratio ${r.context_creep.ratio.toFixed(2)}x (50th/last vs first message cost).`,
      );
    }
  }
  for (const d of drift) {
    if (d.unversioned_runs.length) {
      findings.push(
        `Unversioned runs excluded from drift comparison: ${d.unversioned_runs.join(", ")}.`,
      );
    }
    if (d.compared) {
      findings.push(
        `Drift ${d.workflow}: ${d.baseline_version ?? "?"} -> ${d.current_version ?? "?"} score ${d.baseline_score.toFixed(3)} to ${d.current_score.toFixed(3)} (delta ${d.delta.toFixed(3)}), verdict ${d.verdict}.`,
      );
    }
  }

  const flagged = analyses.filter((r) => r.verdict === "investigate").length;

  return {
    generated_at: new Date().toISOString(),
    source,
    runs: analyses,
    totals: {
      runs: analyses.length,
      cost_usd: totalCost,
      latency_ms: analyses.reduce((a, r) => a + r.total_latency_ms, 0),
      input_tokens: analyses.reduce((a, r) => a + r.total_input_tokens, 0),
      output_tokens: analyses.reduce((a, r) => a + r.total_output_tokens, 0),
      flagged_runs: flagged,
      unversioned_runs: analyses.filter((r) => r.unversioned).length,
      attributed_cost_usd: attributed,
      unattributed_cost_usd: unattributed,
    },
    retry_loops,
    context_creep,
    drift,
    verdict_counts: {
      keep: analyses.filter((r) => r.verdict === "keep").length,
      investigate: flagged,
    },
    findings,
  };
}

export function renderHtml(report: Report): string {
  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = report.runs
    .map(
      (r) => `<tr>
        <td>${esc(r.run_id)}</td><td>${esc(r.customer ?? r.workflow ?? "")}</td>
        <td>${esc(r.model_version ?? (r.unversioned ? "unversioned" : ""))}</td>
        <td>${r.step_count}</td><td>$${r.total_cost_usd.toFixed(4)}</td>
        <td>${r.total_latency_ms}</td><td>${r.context_creep.ratio === Infinity ? "∞" : r.context_creep.ratio.toFixed(2)}x</td>
        <td>${esc(r.verdict)}</td>
      </tr>`,
    )
    .join("\n");

  const loops = report.retry_loops
    .map((l) => `<li><b>${esc(l.run_id)}</b> (${esc(l.workflow ?? "unknown")}): step <code>${esc(l.looping_step)}</code> — ${l.actual} actual vs ${l.intended} intended</li>`)
    .join("");

  const driftRows = report.drift
    .map((d) => `<li>${esc(d.workflow)}: ${esc(d.baseline_version ?? "?")} → ${esc(d.current_version ?? "?")} score ${d.baseline_score.toFixed(3)}→${d.current_score.toFixed(3)} (Δ ${d.delta.toFixed(3)}) <b>${esc(d.verdict)}</b>; unversioned excluded: ${esc(d.unversioned_runs.join(", ") || "none")}</li>`)
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Agent Production Run Cockpit</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#111} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px} th{background:#f6f6f6;text-align:left} .investigate{color:#b45309;font-weight:600} .keep{color:#15803d;font-weight:600} pre{background:#f6f6f6;padding:12px;overflow:auto}</style>
</head><body>
<h1>Agent Production Run Cockpit</h1>
<p>Generated: ${esc(report.generated_at)} | Source: ${esc(report.source)}</p>
<h2>Totals</h2>
<ul>
  <li>Runs: ${report.totals.runs} (flagged: ${report.totals.flagged_runs}, unversioned: ${report.totals.unversioned_runs})</li>
  <li>Cost: $${report.totals.cost_usd.toFixed(4)} (attributed $${report.totals.attributed_cost_usd.toFixed(4)}, unattributed $${report.totals.unattributed_cost_usd.toFixed(4)})</li>
  <li>Latency: ${report.totals.latency_ms} ms | Tokens: ${report.totals.input_tokens} in / ${report.totals.output_tokens} out</li>
  <li>Verdicts: keep ${report.verdict_counts.keep}, investigate ${report.verdict_counts.investigate}</li>
</ul>
<h2>Retry loops (call inflation)</h2>
<ul>${loops || "<li>None detected</li>"}</ul>
<h2>Drift / model-version comparison</h2>
<ul>${driftRows || "<li>No drift comparison provided</li>"}</ul>
<h2>Findings</h2>
<ul>${report.findings.map((f) => `<li>${esc(f)}</li>`).join("") || "<li>None</li>"}</ul>
<h2>Runs</h2>
<table><thead><tr><th>Run</th><th>Customer/Workflow</th><th>Model version</th><th>Steps</th><th>Cost</th><th>Latency ms</th><th>Context growth</th><th>Verdict</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

export function writeReportFiles(report: Report, outDir: string): { json: string; html: string } {
  fs.mkdirSync(outDir, { recursive: true });
  const json = path.join(outDir, "report.json");
  const html = path.join(outDir, "report.html");
  fs.writeFileSync(json, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(html, renderHtml(report), "utf8");
  return { json, html };
}