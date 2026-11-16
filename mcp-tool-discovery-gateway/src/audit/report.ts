import { writeFileSync, mkdirSync } from "node:fs";
import type { AuditEvent, AuditReport, IndexedTool } from "../types.js";
import { estimateTokensFromBytes } from "../utils/hash.js";

export function createAuditReport(startedAt: string): AuditReport {
  return {
    startedAt,
    events: [],
    totals: {
      indexedTools: 0,
      indexedSchemaBytes: 0,
      indexedSchemaTokensEstimate: 0,
      requestedSchemaCount: 0,
      requestedSchemaBytes: 0,
      requestedSchemaTokensEstimate: 0,
      searches: 0,
      invocations: 0,
      errors: 0,
      policyDenials: 0,
    },
  };
}

export function record(report: AuditReport, event: AuditEvent): void {
  report.events.push(event);
  switch (event.type) {
    case "index":
      report.totals.indexedTools += 1;
      report.totals.indexedSchemaBytes += event.schemaBytes ?? 0;
      report.totals.indexedSchemaTokensEstimate += event.estimatedTokens ?? 0;
      break;
    case "search":
      report.totals.searches += 1;
      break;
    case "schema":
      report.totals.requestedSchemaCount += 1;
      report.totals.requestedSchemaBytes += event.schemaBytes ?? 0;
      report.totals.requestedSchemaTokensEstimate += event.estimatedTokens ?? 0;
      break;
    case "invoke":
      report.totals.invocations += 1;
      break;
    case "error":
      report.totals.errors += 1;
      break;
    case "policy_deny":
      report.totals.policyDenials += 1;
      break;
  }
}

export function finalizeReport(report: AuditReport): AuditReport {
  report.finishedAt = new Date().toISOString();
  return report;
}

export function writeReport(dir: string, report: AuditReport): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/audit.json`, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(`${dir}/audit.html`, htmlReport(report), "utf8");
}

export function seedIndexTotals(report: AuditReport, tools: IndexedTool[]): void {
  report.totals.indexedTools = tools.length;
  report.totals.indexedSchemaBytes = tools.reduce((a, t) => a + t.schemaBytes, 0);
  report.totals.indexedSchemaTokensEstimate = tools.reduce((a, t) => a + estimateTokensFromBytes(t.schemaBytes), 0);
}

function htmlReport(report: AuditReport): string {
  const t = report.totals;
  const rows = report.events
    .map(
      (e) => `    <tr><td>${e.ts}</td><td>${e.type}</td><td>${e.toolId ?? ""}</td><td>${e.ok ? "ok" : "fail"}</td><td>${e.detail ?? ""}</td></tr>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MCP Tool Discovery Gateway Audit</title>
<style>
body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2937; }
h1 { font-size: 1.4rem; }
table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
th, td { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }
th { background: #f3f4f6; }
.summary { background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
</style>
</head>
<body>
<h1>MCP Tool Discovery Gateway Audit</h1>
<div class="summary">
<p><strong>Started:</strong> ${report.startedAt}</p>
<p><strong>Finished:</strong> ${report.finishedAt ?? ""}</p>
<p><strong>Indexed tools:</strong> ${t.indexedTools} (${t.indexedSchemaTokensEstimate} estimated tokens)</p>
<p><strong>Requested schemas:</strong> ${t.requestedSchemaCount} (${t.requestedSchemaTokensEstimate} estimated tokens)</p>
<p><strong>Searches:</strong> ${t.searches} &middot; <strong>Invocations:</strong> ${t.invocations} &middot; <strong>Errors:</strong> ${t.errors} &middot; <strong>Policy denials:</strong> ${t.policyDenials}</p>
<p><strong>Tokens avoided (estimate):</strong> ${t.indexedSchemaTokensEstimate - t.requestedSchemaTokensEstimate}</p>
</div>
<h2>Events</h2>
<table>
<thead><tr><th>Time</th><th>Type</th><th>Tool</th><th>Result</th><th>Detail</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}