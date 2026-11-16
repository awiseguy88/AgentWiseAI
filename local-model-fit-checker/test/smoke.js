'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');
const outDir = path.join(root, 'tmp', 'smoke-report');
fs.rmSync(outDir, { recursive: true, force: true });

const res = spawnSync(process.execPath, [
  cli,
  '--repo', path.join(root, 'test', 'fixtures', 'sample-repo'),
  '--local', 'mock:' + path.join(root, 'test', 'fixtures', 'local.mock.json'),
  '--cloud', 'mock:' + path.join(root, 'test', 'fixtures', 'cloud.mock.json'),
  '--tasks', 'all',
  '--out-dir', outDir,
  '--electricity-rate', '0.20',
  '--local-watts', '200',
], { encoding: 'utf8' });

assert.strictEqual(res.status, 0, `expected exit 0, got ${res.status}\nstdout:${res.stdout}\nstderr:${res.stderr}`);

const reportPath = path.join(outDir, 'report.json');
const htmlPath = path.join(outDir, 'report.html');
assert.ok(fs.existsSync(reportPath), 'report.json should exist');
assert.ok(fs.existsSync(htmlPath), 'report.html should exist');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert.ok(report.summary && report.summary.total_tasks >= 4, 'should include bundled + extracted tasks');
const types = new Set(report.tasks.map(t => t.type));
assert.ok(types.has('bundled'), 'should include bundled tasks');
assert.ok(types.has('repo'), 'should include repo-extracted tasks');

for (const t of report.tasks) {
  assert.ok(typeof t.local.pass === 'boolean', 'local pass/fail recorded');
  assert.ok(typeof t.cloud.pass === 'boolean', 'cloud pass/fail recorded');
  assert.ok(typeof t.local.tokens_in === 'number', 'local tokens_in recorded');
  assert.ok(typeof t.cloud.tokens_in === 'number', 'cloud tokens_in recorded');
  assert.ok(typeof t.local.estimated_electricity_usd === 'number', 'local electricity cost recorded');
  assert.ok(typeof t.cloud.token_cost_usd === 'number', 'cloud token cost recorded');
  assert.ok(t.recommendation === 'local' || t.recommendation === 'api', 'routing recommendation present');
}

// fixture is designed so local and cloud differ on some tasks -> mixed recommendations
const recs = new Set(report.tasks.map(t => t.recommendation));
assert.ok(recs.has('local'), 'expected at least one local recommendation');
assert.ok(recs.has('api'), 'expected at least one api recommendation');

const html = fs.readFileSync(htmlPath, 'utf8');
assert.ok(html.includes('Local Model Coding Fit Checker'), 'HTML should be readable report');
assert.ok(html.includes('Overall routing'), 'HTML should include routing summary');
assert.ok(html.includes('calculator.test.js') || html.includes('Repo test'), 'HTML should include extracted task reference');

console.log('SMOKE OK: local-model-fit-checker report generated with bundled+repo tasks, pass/fail, costs, and routing recommendations.');
