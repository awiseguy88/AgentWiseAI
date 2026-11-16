/**
 * Audit log for agent-ontology-guardrails.
 * Records validation decisions and renders HTML/JSON audit reports.
 */

const fs = require('fs');
const path = require('path');

function newAuditLog(opts = {}) {
  const log = [];
  const outDir = opts.outDir || '.audit';

  function entry(action, result, extra = {}) {
    const e = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      timestamp: new Date().toISOString(),
      actionType: result.actionType || action?.type || null,
      valid: !!result.valid,
      violations: result.violations || [],
      action: action,
      ...extra
    };
    log.push(e);
    return e;
  }

  function all() {
    return log.slice();
  }

  function writeJson(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
    return filePath;
  }

  function writeHtml(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const rows = log.map(e => {
      const status = e.valid ? 'PASS' : 'BLOCK';
      const v = e.violations.map(v => `<li><strong>${escapeHtml(v.rule)}</strong> on <code>${escapeHtml(v.field)}</code>: ${escapeHtml(v.message)}</li>`).join('') || '<li>none</li>';
      return `<tr>
        <td>${escapeHtml(e.timestamp)}</td>
        <td>${escapeHtml(e.actionType)}</td>
        <td>${status}</td>
        <td><ul>${v}</ul></td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>agent-ontology-guardrails audit log</title>
<style>
body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
h1 { font-size: 1.4rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: left; }
th { background: #f4f4f4; }
tr.pass { background: #e8f5e9; }
tr.block { background: #ffebee; }
code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>agent-ontology-guardrails audit log</h1>
<p>${log.length} decisions recorded.</p>
<table>
<thead><tr><th>Timestamp</th><th>Action</th><th>Status</th><th>Violations</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
    fs.writeFileSync(filePath, html);
    return filePath;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { entry, all, writeJson, writeHtml };
}

module.exports = { newAuditLog };
