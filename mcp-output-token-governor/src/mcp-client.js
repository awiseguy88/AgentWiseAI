'use strict';

const { spawn } = require('child_process');
const readline = require('readline');

/**
 * Minimal JSON-RPC client over a child process (newline-delimited JSON).
 */
class McpStdioClient {
  constructor(serverSpec) {
    this.serverSpec = serverSpec;
    this.child = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.initialized = false;
  }

  start() {
    if (this.child) return;
    const spec = this.serverSpec;
    const env = Object.assign({}, process.env, spec.env || {});
    this.child = spawn(spec.command, spec.args || [], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env,
    });
    this.rl = readline.createInterface({ input: this.child.stdout });
    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch (e) {
        return;
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
    this.child.on('exit', (code) => {
      for (const [, { reject }] of this.pending) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  async request(method, params) {
    if (!this.child) this.start();
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method, params: params || {} };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.child.stdin.write(JSON.stringify(msg) + '\n');
      } catch (err) {
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async notify(method, params) {
    if (!this.child) this.start();
    const msg = { jsonrpc: '2.0', method, params: params || {} };
    this.child.stdin.write(JSON.stringify(msg) + '\n');
  }

  async initialize() {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-output-token-governor', version: '1.0.0' },
    });
    await this.notify('notifications/initialized', {});
    this.initialized = true;
    return result;
  }

  async listTools() {
    return this.request('tools/list', {});
  }

  async callTool(name, args) {
    return this.request('tools/call', { name, arguments: args || {} });
  }

  close() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.child) {
      try { this.child.stdin.end(); } catch (e) {}
      try { this.child.kill(); } catch (e) {}
      this.child = null;
    }
    this.pending.clear();
  }
}

module.exports = { McpStdioClient };