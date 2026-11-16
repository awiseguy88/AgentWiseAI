/**
 * Demo: run refund/order rule pack through validator proxy against demo endpoint.
 * Accepts a valid refund fixture, rejects invalid refunds with structured violations,
 * and emits an HTML/JSON audit log.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { startAgentEndpoint } = require('./agent-endpoint');
const { newProxy } = require('../src/proxy');
const { newAuditLog } = require('../src/audit');
const { validateAction } = require('../src/validator');

const root = path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/rules/refund-order.json'), 'utf8'));
const validAction = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/actions/valid-refund.json'), 'utf8'));
const invalidUndelivered = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/actions/invalid-undelivered.json'), 'utf8'));
const invalidAmount = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/actions/invalid-amount.json'), 'utf8'));

function postJson(port, action) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(action);
    const req = http.request({ hostname: '127.0.0.1', port, path: '/act', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const outDir = path.join(root, 'demo', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const audit = newAuditLog({ outDir });

  const agent = await startAgentEndpoint(4101);
  const proxy = newProxy({ rulePack: rules, targetHost: '127.0.0.1', targetPort: 4101, targetPath: '/act' });
  await proxy.start(4100);

  console.log('--- Valid refund (should be forwarded/executable) ---');
  const v = await postJson(4100, validAction);
  console.log(JSON.stringify(v, null, 2));
  audit.entry(validAction, validateAction(rules, validAction));

  console.log('\n--- Invalid refund: undelivered order (should be blocked) ---');
  const u = await postJson(4100, invalidUndelivered);
  console.log(JSON.stringify(u, null, 2));
  audit.entry(invalidUndelivered, validateAction(rules, invalidUndelivered));

  console.log('\n--- Invalid refund: amount above total (should be blocked) ---');
  const a = await postJson(4100, invalidAmount);
  console.log(JSON.stringify(a, null, 2));
  audit.entry(invalidAmount, validateAction(rules, invalidAmount));

  const jsonPath = path.join(outDir, 'audit.json');
  const htmlPath = path.join(outDir, 'audit.html');
  audit.writeJson(jsonPath);
  audit.writeHtml(htmlPath);
  console.log(`\nAudit written: ${jsonPath}\n${htmlPath}`);

  await proxy.stop();
  agent.server.close();
}

main().catch(e => { console.error(e); process.exit(1); });
