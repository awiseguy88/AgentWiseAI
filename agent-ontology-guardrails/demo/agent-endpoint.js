/**
 * Demo HTTP agent endpoint.
 * Receives forwarded (already-validated) actions and simulates side effects.
 */
const http = require('http');

function startAgentEndpoint(port = 4001) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/act') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let action = {};
        try { action = JSON.parse(body || '{}'); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'executed', actionType: action.type, payload: action.payload || {} }));
      });
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
  return new Promise(resolve => server.listen(port, () => resolve({ server, port })));
}

if (require.main === module) {
  const port = parseInt(process.argv[2] || '4001', 10);
  startAgentEndpoint(port).then(({ port }) => {
    console.log(`Demo agent endpoint listening on http://127.0.0.1:${port}/act`);
  });
}

module.exports = { startAgentEndpoint };
