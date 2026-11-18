'use strict';

const { McpStdioClient } = require('./mcp-client');

/**
 * Server pool: one initialized MCP client per server spec, reused across
 * calls and HTTP requests. Avoids spawning a fresh subprocess per tool call.
 */
class ServerPool {
  constructor() {
    this.clients = new Map();
  }

  async client(spec) {
    const key = spec.name || (spec.command + ':' + (spec.args || []).join(' '));
    if (this.clients.has(key)) {
      return this.clients.get(key);
    }
    const client = new McpStdioClient(spec);
    await client.initialize();
    this.clients.set(key, client);
    return client;
  }

  async closeAll() {
    const clients = Array.from(this.clients.values());
    for (const c of clients) {
      try { c.close(); } catch (e) {}
    }
    this.clients.clear();
  }
}

module.exports = { ServerPool };