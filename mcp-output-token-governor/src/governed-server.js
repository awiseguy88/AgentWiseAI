'use strict';

const { McpStdioClient } = require('./mcp-client');
const { applyBudget, getToolBudget } = require('./budget');

/**
 * Wrapper around an MCP server that enforces a per-server/tool token budget on
 * tool results and records savings. Reuses a pooled MCP client when one is
 * provided; otherwise spawns (and owns) its own client.
 */
class GovernedServer {
  constructor(serverSpec, defaultBudget, reporter, pool) {
    this.spec = serverSpec;
    this.defaultBudget = defaultBudget;
    this.reporter = reporter;
    this.pool = pool || null;
    this.client = null;
    this.ownsClient = false;
  }

  async start() {
    if (this.client) return;
    if (this.pool) {
      this.client = await this.pool.client(this.spec);
    } else {
      this.client = new McpStdioClient(this.spec);
      await this.client.initialize();
      this.ownsClient = true;
    }
  }

  async callTool(name, args) {
    if (!this.client) await this.start();
    const result = await this.client.callTool(name, args);
    const text = extractText(result);
    const budget = getToolBudget(this.spec, name, this.defaultBudget);
    const marker = this.spec.marker || null;
    const budgeted = applyBudget(text, budget, marker);
    this.reporter.record({ server: this.spec.name, tool: name, result: budgeted });
    if (budgeted.budgeted) {
      return replaceText(result, budgeted.result);
    }
    return result;
  }

  close() {
    if (this.ownsClient && this.client) {
      try { this.client.close(); } catch (e) {}
    }
    this.client = null;
  }
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (result && Array.isArray(result.content)) {
    const parts = result.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') return item.text;
        return '';
      })
      .filter((p) => p != null && p.length > 0);
    return parts.join('\n');
  }
  return JSON.stringify(result);
}

function replaceText(result, text) {
  if (typeof result === 'string') return text;
  if (result && Array.isArray(result.content)) {
    return Object.assign({}, result, { content: [{ type: 'text', text }] });
  }
  return text;
}

module.exports = { GovernedServer, extractText, replaceText };