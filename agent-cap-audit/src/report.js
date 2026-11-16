'use strict';

const fs = require('fs');
const path = require('path');

function fixSnippetsFor(violation) {
  const snippets = [];
  const connector = violation.connector || violation.name || 'connector';
  const risks = violation.risks || [];
  if (risks.includes('impersonate-user') || risks.includes('external-post')) {
    snippets.push({
      title: `Disable ${connector} connector feature`,
      description: 'Remove the connector from agent config or disable the feature flag so the role cannot post or act as you.',
      code: `# Codex/features example (remove or set to false)\n[features]\n${connector} = false\n\n# Claude/Cursor mcp.json: remove the "${connector}" server entry from mcpServers.`
    });
  }
  snippets.push({
    title: 'Strict MCP config (least privilege)',
    description: 'Expose only explicitly approved servers and avoid broad account-level connectors for executor roles.',
    code: JSON.stringify({
      mcpServers: {
        // Keep only approved, read-only servers for this role
        // "approved-readonly-server": { "command": "...", "args": ["..."] }
      }
    }, null, 2)
  });
  snippets.push({
    title: 'Least-privilege role policy (agent-cap-audit-policy.json)',
    description: 'Deny impersonation/external posting for executor roles and allow only required read capabilities.',
    code: JSON.stringify({
      version: 1,
      roles: {
        executor: { deny: ['impersonate-user', 'external-post'], allow: ['read'] }
      }
    }, null, 2)
  });
  return snippets;
}

function renderJsonReport(scanRoot, role, policyInfo, evaluation, capabilities) {
  const violations = evaluation.violations.map(v => ({
    ...v,
    fixSnippets: fixSnippetsFor(v),
  }));
  return {
    tool: 'agent-cap-audit',
    version: '0.1.0',
    scanRoot,
    role,
    policy: { source: policyInfo.source, path: policyInfo.path, rolePolicy: evaluation.rolePolicy },
    summary: {
      totalCapabilities: capabilities.length,
      violations: violations.length,
      passed: evaluation.passed.length,
      status: violations.length > 0 ? 'fail' : 'pass',
    },
    capabilities,
    violations,
    passed: evaluation.passed,
    generatedAt: new Date().toISOString(),
  };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHtmlReport(jsonReport) {
  const vRows = jsonReport.violations.map(v => `
    <tr>
      <td>${escapeHtml(v.connector || v.name)}</td>
      <td>${escapeHtml(v.name)}</td>
      <td><code>${escapeHtml(v.source)}</code></td>
      <td>${escapeHtml((v.risks||[]).join(', '))}</td>
      <td>${escapeHtml(v.violation)}</td>
      <td>${escapeHtml(v.reason || '')}</td>
    </tr>`).join('') || '<tr><td colspan="6">No violations</td></tr>';

  const snippetBlocks = jsonReport.violations.flatMap(v => fixSnippetsFor(v)).slice(0, 12).map(s => `
    <div class="snippet">
      <h4>${escapeHtml(s.title)}</h4>
      <p>${escapeHtml(s.description)}</p>
      <pre>${escapeHtml(s.code)}</pre>
    </div>`).join('') || '<p>No fix snippets needed.</p>';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Capability Audit Report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111}
h1{margin-bottom:4px}.meta{color:#555;margin-bottom:16px}
.summary{display:flex;gap:16px;margin:16px 0}.card{border:1px solid #ddd;border-radius:8px;padding:12px 16px;min-width:140px}
.pass{color:#0a7a2f}.fail{color:#b00020;font-weight:600}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;font-size:14px}
th{background:#f6f6f6}pre{background:#0b1020;color:#e6edf3;padding:12px;border-radius:6px;overflow:auto}
.snippet{margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px}
code{font-size:12px}
</style></head><body>
<h1>Agent Capability Audit Report</h1>
<div class="meta">Role: <strong>${escapeHtml(jsonReport.role)}</strong> &middot; Scan root: <code>${escapeHtml(jsonReport.scanRoot)}</code> &middot; Policy: ${escapeHtml(jsonReport.policy.source)} ${jsonReport.policy.path ? `(<code>${escapeHtml(jsonReport.policy.path)}</code>)` : ''}</div>
<div class="summary">
  <div class="card"><div>Status</div><div class="${jsonReport.summary.status}">${escapeHtml(jsonReport.summary.status.toUpperCase())}</div></div>
  <div class="card"><div>Capabilities</div><div>${jsonReport.summary.totalCapabilities}</div></div>
  <div class="card"><div>Violations</div><div class="${jsonReport.summary.violations>0?'fail':'pass'}">${jsonReport.summary.violations}</div></div>
  <div class="card"><div>Passed</div><div>${jsonReport.summary.passed}</div></div>
</div>
<h2>Policy Violations</h2>
<table><thead><tr><th>Connector</th><th>Capability</th><th>Source</th><th>Risks</th><th>Violation</th><th>Reason</th></tr></thead><tbody>${vRows}</tbody></table>
<h2>Fix Snippets</h2>
${snippetBlocks}
<p class="meta">Generated ${escapeHtml(jsonReport.generatedAt)} by agent-cap-audit (offline).</p>
</body></html>`;
}

function writeReport(outDir, jsonReport) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2) + '\n', 'utf8');
  fs.writeFileSync(htmlPath, renderHtmlReport(jsonReport), 'utf8');
  return { jsonPath, htmlPath };
}

module.exports = { renderJsonReport, renderHtmlReport, writeReport, fixSnippetsFor };
