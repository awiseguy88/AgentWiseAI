/**
 * HTTP validator proxy.
 * Receives proposed actions, validates them against a rule pack, forwards valid
 * actions to a target agent endpoint, and blocks invalid ones with structured
 * violation reports.
 */

const http = require('http');
const { validateAction } = require('./validator');

function newProxy(opts = {}) {
  const {
    rulePack,
    targetHost = '127.0.0.1',
    targetPort = 4000,
    targetPath = '/act',
    runtimeContext = {}
  } = opts;

  if (!rulePack) throw new Error('Proxy requires a rulePack option.');

  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', target: `${targetHost}:${targetPort}` }));
      return;
    }

    if (req.method !== 'POST' && req.method !== 'PUT') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed; POST proposed actions.' }));
      return;
    }

    let body = '';
    req.on('data', c => { body += c.toString(); });
    req.on('end', () => {
      let action;
      try {
        action = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON body.', details: e.message }));
        return;
      }

      const result = validateAction(rulePack, action, runtimeContext);
      if (!result.valid) {
        res.writeHead(422);
        res.end(JSON.stringify({
          decision: 'blocked',
          actionType: result.actionType,
          violations: result.violations
        }));
        return;
      }

      // Forward valid action to target agent endpoint
      const payload = JSON.stringify(action);
      const reqOptions = {
        host: targetHost,
        port: targetPort,
        path: targetPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 5000
      };
      const fwd = http.request(reqOptions, fwdRes => {
        let fwdBody = '';
        fwdRes.on('data', c => { fwdBody += c.toString(); });
        fwdRes.on('end', () => {
          res.writeHead(fwdRes.statusCode || 200);
          res.end(JSON.stringify({
            decision: 'forwarded',
            actionType: result.actionType,
            targetStatus: fwdRes.statusCode,
            targetResponse: fwdBody ? JSON.parse(fwdBody || '{}') : {}
          }));
        });
      });
      fwd.on('error', e => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Target agent endpoint unavailable.', details: e.message }));
      });
      fwd.on('timeout', () => { fwd.destroy(); res.writeHead(504); res.end(JSON.stringify({ error: 'Target agent endpoint timed out.' })); });
      fwd.write(payload);
      fwd.end();
    });
  });

  return {
    server,
    start(port) {
      return new Promise(resolve => server.listen(port, () => resolve(port)));
    },
    stop() {
      return new Promise(resolve => server.close(() => resolve()));
    }
  };
}

module.exports = { newProxy };
