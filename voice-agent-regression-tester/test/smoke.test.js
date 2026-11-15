const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const toolDir = path.resolve(__dirname, '..');
const bin = path.join(toolDir, 'bin', 'voice-agent-regression-tester.js');
const fixtures = path.join(toolDir, 'fixtures', 'scenarios.json');
const okAgent = path.join(toolDir, 'fixtures', 'stub-agent-ok.json');
const brokenAgent = path.join(toolDir, 'fixtures', 'stub-agent-broken.json');

function runCli(args, cwd = toolDir) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
}

test('acceptance (1): all bundled scenarios pass with unchanged stub agent', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vart-ok-'));
  const r = runCli(['--fixtures', fixtures, '--agent', okAgent, '--out', outDir]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  assert.match(r.stdout, /3\/3 scenarios passed \(PASS\)/);
  assert.match(r.stdout, /PASS booked_call/);
  assert.match(r.stdout, /PASS refusal_call/);
  assert.match(r.stdout, /PASS transfer_call/);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(summary.status, 'PASS');
  assert.equal(summary.failed, 0);
  assert.equal(summary.total, 3);
});

test('acceptance (2): changed stub fails refusal scenario, prints failed assertion, exits non-zero without network', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vart-bad-'));
  const r = runCli(['--fixtures', fixtures, '--agent', brokenAgent, '--out', outDir]);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  assert.match(r.stdout, /FAIL refusal_call/);
  assert.match(r.stdout, /confirm_email/);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(summary.status, 'FAIL');
  const refusal = summary.scenarios.find((s) => s.scenario.id === 'refusal_call');
  assert.ok(refusal && refusal.pass === false, 'refusal_call should fail');
  assert.ok(refusal.failures.some((f) => f.message.includes('confirm_email')), 'should report missing confirm_email assertion');
});

test('acceptance (3): first run produces readable HTML/JSON reports from bundled fixtures with no account or paid service', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vart-report-'));
  const r = runCli(['--fixtures', fixtures, '--agent', okAgent, '--out', outDir]);
  assert.equal(r.status, 0, `expected exit 0\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  assert.ok(fs.existsSync(jsonPath), 'report.json should exist');
  assert.ok(fs.existsSync(htmlPath), 'report.html should exist');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /Voice Agent Regression Report/);
  assert.match(html, /booked_call/);
  assert.match(html, /refusal_call/);
  assert.match(html, /transfer_call/);
  assert.match(html, /PASS/);
});
