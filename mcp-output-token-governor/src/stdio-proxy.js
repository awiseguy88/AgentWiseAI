'use strict';

const readline = require('readline');
const { loadConfig } = require('./config');
const { Reporter } = require('./reporter');
const { GovernedServer } = require('./governed-server');

/**
 * stdio JSON-RPC relay: agent <-> proxy <-> real MCP server.
 *
 * Reads newline-delimited JSON-RPC messages from stdin, forwards initialize,
 * tools/list, and notifications to the real server, and intercepts
 * tools/call responses to apply the per-server/tool token budget before
 * writing the governed result to stdout.
 */
class StdioProxy {
  constructor(serverSpec, defaultBudget, reporter) {
    this.spec = serverSpec;
    this.defaultBudget = defaultBudget;
    this.reporter = reporter;
    this.governed = null;
    this.in = readline.createInterface({ input: process.stdin });
    this.out = process.stdout;
  }

  async start() {
    this.governed = new GovernedServer(this.spec, this.defaultBudget, this.reporter);
    await this.governed.start();
    this.in.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try { msg = JSON.parse(trimmed); } catch (e) { return; }
      if (!msg || msg.jsonrpc !== '2.0') return;
      this.handle(msg).catch((err) => {
        if (msg.id != null) {
          this.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: err.message || 'internal error' } });
        }
      });
    });
    this.in.on('close', () => {
      if (this.governed) this.governed.close();
      process.exit(0);
    });
  }

  async handle(msg) {
    const { id, method, params } = msg;
    if (method === 'initialize') {
      const result = await this.governed.client.request('initialize', params);
      this.governed.client.notify('notifications/initialized', {});
      this.governed.client.initialized = true;
      this.send({ jsonrpc: '2.0', id, result });
      return;
    }
    if (method === 'tools/list') {
      const result = await this.governed.client.request('tools/list', params);
      this.send({ jsonrpc: '2.0', id, result });
      return;
    }
    if (method === 'tools/call') {
      const tool = (params && params.name) || 'unknown';
      const result = await this.governed.callTool(tool, params && params.arguments ? params.arguments : {});
      this.send({ jsonrpc: '2.0', id, result });
      return;
    }
    // Forward everything else to the real server.
    const result = await this.governed.client.request(method, params);
    this.send({ jsonrpc: '2.0', id, result });
  }

  send(obj) {
    this.out.write(JSON.stringify(obj) + '\n');
  }
}

async function runStdio(configPath) {
  const config = configPath ? loadConfig(configPath) : { servers: {}, defaultBudget: 2000, defaultMarker: null, reportDir: null };
  const serverName = Object.keys(config.servers)[0] || 'default';
  const spec = config.servers[serverName] || { name: 'default', transport: 'stdio', budget: config.defaultBudget, toolBudgets: {}, args: [], env: null, url: null };
  const reporter = new Reporter();
  const proxy = new StdioProxy(spec, config.defaultBudget, reporter);
  await proxy.start();
  process.on('SIGINT', () => {
    const outDir = config.reportDir || process.cwd();
    try { reporter.writeFiles(outDir); } catch (e) {}
    process.exit(0);
  });
}

module.exports = { StdioProxy, runStdio };