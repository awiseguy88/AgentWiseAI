'use strict';

const http = require('http');
const { GovernedServer } = require('./governed-server');
const { Reporter } = require('./reporter');
const { ServerPool } = require('./server-pool');

function createApp({ servers, defaultBudget, reporter, getSpec, pool }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname === '/report') {
        return json(res, 200, reporter.toJSON());
      }
      if (req.method === 'GET' && url.pathname === '/report.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(reporter.renderHtml(reporter.toJSON()));
      }
      if (req.method === 'POST' && url.pathname === '/call') {
        const body = await readBody(req);
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch (e) { return json(res, 400, { error: 'invalid JSON body' }); }
        const name = parsed.server || 'default';
        const tool = parsed.tool;
        if (!tool) return json(res, 400, { error: 'missing "tool"' });
        const spec = getSpec(name);
        if (!spec) return json(res, 404, { error: `server "${name}" not found` });
        const governed = new GovernedServer(spec, defaultBudget, reporter, pool);
        await governed.start();
        const result = await governed.callTool(tool, parsed.args || {});
        governed.close();
        return json(res, 200, { server: name, tool, result });
      }
      return json(res, 404, { error: 'not found' });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(text);
}

function startHttpServer({ config, port }) {
  const reporter = new Reporter();
  const pool = new ServerPool();
  const getSpec = (name) => {
    if (name === 'default') return { name: 'default', transport: 'stdio', budget: config.defaultBudget, toolBudgets: {}, args: [], env: null, url: null };
    return config.servers[name];
  };
  const app = createApp({ servers: config.servers, defaultBudget: config.defaultBudget, reporter, getSpec, pool });
  app.listen(port || 0, () => {
    const addr = app.address();
    process.stdout.write(JSON.stringify({ url: `http://127.0.0.1:${addr.port}`, port: addr.port }) + '\n');
  });
  // Attach pool for graceful shutdown if needed
  app.pool = pool;
  return { app, reporter, pool };
}

module.exports = { createApp, startHttpServer };