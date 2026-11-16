'use strict';

const fs = require('fs');
const path = require('path');
const { countTokens } = require('./tokenizer');

function makeEmptyReport() {
  return {
    generatedAt: null,
    summary: {
      calls: 0,
      budgetedCalls: 0,
      bytesSaved: 0,
      tokensSaved: 0,
      tokenCountBefore: 0,
      tokenCountAfter: 0,
      byteLengthBefore: 0,
      byteLengthAfter: 0,
    },
    byServer: {},
    byTool: {},
    calls: [],
  };
}

class Reporter {
  constructor() {
    this.report = makeEmptyReport();
  }

  record({ server, tool, result }) {
    const r = result;
    const entry = {
      server: server || 'default',
      tool: tool || 'unknown',
      budgeted: !!r.budgeted,
      tokenCountBefore: r.tokenCount,
      tokenBudget: r.tokenBudget,
      tokensSaved: r.tokensSaved,
      bytesSaved: r.bytesSaved,
      byteLengthBefore: r.byteLengthBefore,
      byteLengthAfter: r.byteLengthAfter,
    };
    this.report.calls.push(entry);

    const s = this.report.summary;
    s.calls += 1;
    if (r.budgeted) s.budgetedCalls += 1;
    s.bytesSaved += r.bytesSaved || 0;
    s.tokensSaved += r.tokensSaved || 0;
    s.tokenCountBefore += r.tokenCount || 0;
    s.tokenCountAfter += (r.tokenCount || 0) - (r.tokensSaved || 0);
    s.byteLengthBefore += r.byteLengthBefore || 0;
    s.byteLengthAfter += r.byteLengthAfter || 0;

    const key = entry.server;
    if (!this.report.byServer[key]) {
      this.report.byServer[key] = { calls: 0, budgetedCalls: 0, bytesSaved: 0, tokensSaved: 0 };
    }
    const bs = this.report.byServer[key];
    bs.calls += 1;
    if (r.budgeted) bs.budgetedCalls += 1;
    bs.bytesSaved += r.bytesSaved || 0;
    bs.tokensSaved += r.tokensSaved || 0;

    const tkey = `${entry.server}::${entry.tool}`;
    if (!this.report.byTool[tkey]) {
      this.report.byTool[tkey] = { server: entry.server, tool: entry.tool, calls: 0, budgetedCalls: 0, bytesSaved: 0, tokensSaved: 0 };
    }
    const bt = this.report.byTool[tkey];
    bt.calls += 1;
    if (r.budgeted) bt.budgetedCalls += 1;
    bt.bytesSaved += r.bytesSaved || 0;
    bt.tokensSaved += r.tokensSaved || 0;
  }

  toJSON() {
    this.report.generatedAt = new Date().toISOString();
    return JSON.parse(JSON.stringify(this.report));
  }

  writeFiles(outDir) {
    if (!outDir) outDir = process.cwd();
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'report.json');
    const htmlPath = path.join(outDir, 'report.html');
    const data = this.toJSON();
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.writeFileSync(htmlPath, this.renderHtml(data), 'utf8');
    return { jsonPath, htmlPath };
  }

  renderHtml(data) {
    const s = data.summary;
    const rows = Object.values(data.byTool)
      .sort((a, b) => b.bytesSaved - a.bytesSaved)
      .map((t) => `<tr><td>${escapeHtml(t.server)}</td><td>${escapeHtml(t.tool)}</td><td>${t.calls}</td><td>${t.budgetedCalls}</td><td>${t.bytesSaved}</td><td>${t.tokensSaved}</td></tr>`)
      .join('\n');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MCP Output Token Governor Report</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.4}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.5rem;text-align:left}th{background:#f5f5f5}.summary{margin-bottom:1.5rem}</style>
</head><body>
<h1>MCP Output Token Governor Report</h1>
<p>Generated: ${escapeHtml(data.generatedAt || '')}</p>
<div class="summary">
<p><strong>Calls:</strong> ${s.calls} (budgeted: ${s.budgetedCalls})</p>
<p><strong>Bytes saved:</strong> ${s.bytesSaved} (before ${s.byteLengthBefore} → after ${s.byteLengthAfter})</p>
<p><strong>Tokens saved (approx):</strong> ${s.tokensSaved} (before ${s.tokenCountBefore} → after ${s.tokenCountAfter})</p>
</div>
<h2>By tool</h2>
<table><thead><tr><th>Server</th><th>Tool</th><th>Calls</th><th>Budgeted</th><th>Bytes saved</th><th>Tokens saved</th></tr></thead><tbody>
${rows || '<tr><td colspan="6">No data</td></tr>'}
</tbody></table>
</body></html>\n`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { Reporter, makeEmptyReport, escapeHtml };