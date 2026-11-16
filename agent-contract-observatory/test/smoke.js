'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync, spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');
const contractsDir = path.join(root, 'contracts');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// --- Acceptance #1: createOrder missing sku is rejected before any side effect ---
const tmpDir = path.join(root, 'tmp');
fs.rmSync(tmpDir, { recursive: true, force: true });
const out1 = path.join(tmpDir, 'preflight');
const r1 = run([
  'validate-input',
  '--contract', path.join(contractsDir, 'create-order.json'),
  '--payload', path.join(root, 'fixtures', 'create-order-missing-sku.json'),
  '--out-dir', out1,
]);
assert.strictEqual(r1.status, 1, `preflight missing-sku should exit 1, got ${r1.status}\nstdout:${r1.stdout}\nstderr:${r1.stderr}`);
const r1json = readJson(path.join(out1, 'report.json'));
const skuViolation = r1json.violations.find((v) => v.field === 'items.0.sku' && v.keyword === 'required');
assert.ok(skuViolation, `expected items.0.sku required violation, got: ${JSON.stringify(r1json.violations)}`);
assert.strictEqual(r1json.executed, false, 'preflight failure must not execute');

// --- Acceptance #2: amount-as-string + renamed currency_code triggers violation and exits non-zero ---
const out2 = path.join(tmpDir, 'postflight');
const r2 = run([
  'validate-output',
  '--contract', path.join(contractsDir, 'execute-payment.json'),
  '--payload', path.join(root, 'fixtures', 'execute-payment-bad-output.json'),
  '--out-dir', out2,
]);
assert.strictEqual(r2.status, 1, `postflight bad-output should exit 1, got ${r2.status}\nstdout:${r2.stdout}\nstderr:${r2.stderr}`);
const r2json = readJson(path.join(out2, 'report.json'));
const amountViolation = r2json.violations.find((v) => v.field === 'amount' && v.keyword === 'type');
assert.ok(amountViolation, `expected amount type violation, got: ${JSON.stringify(r2json.violations)}`);
const currencyViolation = r2json.violations.find((v) => v.field === 'currency' && v.keyword === 'required');
assert.ok(currencyViolation, `expected currency required violation, got: ${JSON.stringify(r2json.violations)}`);
assert.strictEqual(r2json.executed, true, 'postflight runs after execution');

// --- Acceptance #3: HTML and JSON reports are viewable offline, naming exact fields ---
const html1 = fs.readFileSync(path.join(out1, 'report.html'), 'utf8');
assert.ok(html1.includes('items.0.sku'), 'preflight HTML should name items.0.sku');
const html2 = fs.readFileSync(path.join(out2, 'report.html'), 'utf8');
assert.ok(html2.includes('amount'), 'postflight HTML should name amount');
assert.ok(html2.includes('currency'), 'postflight HTML should name currency');
assert.ok(!/https?:\/\//i.test(html1.replace(/https:\/\/aaronwiseai\.com\//g, '')), 'HTML should be self-contained (offline)');

// --- Happy path: valid payloads exit 0 ---
const out3 = path.join(tmpDir, 'valid-input');
const r3 = run([
  'validate-input',
  '--contract', path.join(contractsDir, 'create-order.json'),
  '--payload', path.join(root, 'fixtures', 'create-order-valid.json'),
  '--out-dir', out3,
]);
assert.strictEqual(r3.status, 0, `valid create-order input should exit 0, got ${r3.status}\nstdout:${r3.stdout}\nstderr:${r3.stderr}`);
const r3json = readJson(path.join(out3, 'report.json'));
assert.strictEqual(r3json.summary.violations, 0, 'valid payload should have zero violations');

const out4 = path.join(tmpDir, 'valid-output');
const r4 = run([
  'validate-output',
  '--contract', path.join(contractsDir, 'execute-payment.json'),
  '--payload', path.join(root, 'fixtures', 'execute-payment-good-output.json'),
  '--out-dir', out4,
]);
assert.strictEqual(r4.status, 0, `valid execute-payment output should exit 0, got ${r4.status}\nstdout:${r4.stdout}\nstderr:${r4.stderr}`);

const out5 = path.join(tmpDir, 'list-users');
const r5 = run([
  'validate-input',
  '--contract', path.join(contractsDir, 'list-users.json'),
  '--payload', path.join(root, 'fixtures', 'list-users-valid.json'),
  '--out-dir', out5,
]);
assert.strictEqual(r5.status, 0, `valid list-users input should exit 0, got ${r5.status}\nstdout:${r5.stdout}\nstderr:${r5.stderr}`);

// --- --json stdout mode ---
const rJson = run([
  'validate-input',
  '--contract', path.join(contractsDir, 'create-order.json'),
  '--payload', path.join(root, 'fixtures', 'create-order-missing-sku.json'),
  '--json',
]);
assert.strictEqual(rJson.status, 1, '--json mode should exit 1 on violations');
const parsed = JSON.parse(rJson.stdout);
assert.ok(parsed.summary && parsed.summary.violations > 0, '--json stdout should contain report');
assert.ok(parsed.violations.some((v) => v.field === 'items.0.sku'), '--json report should name items.0.sku');

// --- report subcommand writes both files ---
const outRep = path.join(tmpDir, 'combined');
const rRep = run([
  'report',
  '--contract', path.join(contractsDir, 'execute-payment.json'),
  '--input', path.join(root, 'fixtures', 'execute-payment-bad-output.json'),
  '--output', path.join(root, 'fixtures', 'execute-payment-bad-output.json'),
  '--out-dir', outRep,
]);
assert.strictEqual(rRep.status, 1, 'report subcommand should exit 1 on violations');
const repJson = readJson(path.join(outRep, 'report.json'));
assert.ok(repJson.input && repJson.output, 'report JSON should include input and output sections');
const repHtml = fs.readFileSync(path.join(outRep, 'report.html'), 'utf8');
assert.ok(repHtml.includes('executePayment'), 'report HTML should include contract name');
assert.ok(repHtml.includes('amount'), 'report HTML should include amount field');

// --- list command ---
const rList = run(['list', '--contracts-dir', contractsDir, '--json']);
assert.strictEqual(rList.status, 0, `list should exit 0, got ${rList.status}`);
const listJson = JSON.parse(rList.stdout);
assert.ok(listJson.length >= 3, `expected at least 3 contracts, got ${listJson.length}`);

// --- server smoke ---
function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
function httpPost(port, path, obj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(obj);
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const port = 8911 + Math.floor(Math.random() * 100);
  const srv = spawn(process.execPath, [cli, 'serve', '--contracts-dir', contractsDir, '--port', String(port), '--host', '127.0.0.1'], { stdio: 'ignore' });
  try {
    // wait for server to come up
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const root = await httpGet(port, '/');
        if (root.status === 200) { ready = true; break; }
      } catch (e) { /* retry */ }
    }
    assert.ok(ready, 'server should become ready within timeout');

    const root = await httpGet(port, '/');
    assert.strictEqual(root.status, 200, 'GET / should return 200');
    assert.ok(root.body.includes('Agent Contract Observatory'), 'root page should mention the tool name');

    const api = await httpGet(port, '/api/contracts');
    assert.strictEqual(api.status, 200, 'GET /api/contracts should return 200');
    const contracts = JSON.parse(api.body);
    assert.ok(contracts.length >= 3, `expected at least 3 contracts from API, got ${contracts.length}`);

    const validated = await httpPost(port, '/api/validate', {
      server: 'orders', tool: 'createOrder', phase: 'input',
      payload: JSON.stringify({ customerId: 'c1', items: [{ quantity: 1, price: 9.99 }] }),
    });
    assert.strictEqual(validated.status, 200, `POST /api/validate should return 200, got ${validated.status}`);
    const rep = JSON.parse(validated.body);
    assert.strictEqual(rep.status, 'fail', 'missing-sku payload should fail via API');
    assert.ok(rep.violations.some((v) => v.field === 'items.0.sku'), 'API response should name items.0.sku');

    console.log('SMOKE OK: agent-contract-observatory acceptance verified.');
  } finally {
    srv.kill('SIGTERM');
  }
})().catch((e) => {
  console.error('SMOKE FAIL:', e && e.stack ? e.stack : e);
  process.exit(1);
});