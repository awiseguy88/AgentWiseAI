const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const toolDir = path.resolve(__dirname, '..');
const bin = path.join(toolDir, 'bin', 'agent-regression-suite.js');
const fixtures = path.join(toolDir, 'fixtures', 'scenarios.json');
const baselineAgent = path.join(toolDir, 'fixtures', 'mock-agent-baseline.json');
const regressedAgent = path.join(toolDir, 'fixtures', 'mock-agent-regressed.json');

function runCli(args, cwd = toolDir) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
}

test('acceptance (1): regressed fixture flags Fail with >=90% confidence and CI exits non-zero', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-fail-'));
  const r = runCli(['--fixtures', fixtures, '--agent', regressedAgent, '--baseline', baselineAgent, '--runs', '10', '--out', outDir]);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  assert.match(r.stdout, /FAIL/);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(summary.summary.overall, 'FAIL');
  assert.ok(summary.summary.failed > 0, 'expected at least one scenario to FAIL');
  for (const s of summary.scenarios) {
    if (s.sprt.verdict === 'FAIL') {
      assert.ok(s.sprt.confidence >= 0.90, `expected >=90% confidence, got ${s.sprt.confidence}`);
      assert.ok(s.trials.some((t) => !t.pass), 'expected at least one failed trial');
      const firstFail = s.trials.find((t) => !t.pass);
      assert.ok(firstFail.failures.length > 0, 'expected failure details');
    }
  }
});

test('acceptance (2): unchanged agent across 10 runs declares Pass with >=95% confidence and never flakes', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-pass-'));
  const r = runCli(['--fixtures', fixtures, '--agent', baselineAgent, '--baseline', baselineAgent, '--runs', '10', '--out', outDir]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  assert.match(r.stdout, /PASS/);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(summary.summary.overall, 'PASS');
  for (const s of summary.scenarios) {
    assert.equal(s.sprt.verdict, 'PASS', `scenario ${s.id} should PASS`);
    assert.ok(s.sprt.confidence >= 0.95, `expected >=95% confidence, got ${s.sprt.confidence}`);
    assert.ok(s.sprt.runsCompleted <= 10, `expected at most 10 runs completed for ${s.id}`);
    for (const t of s.trials) assert.ok(t.pass, `trial should pass for ${s.id}`);
  }
});

test('acceptance (3): first run produces readable HTML/JSON reports from bundled fixtures with no account or paid service', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-report-'));
  const r = runCli(['--fixtures', fixtures, '--agent', baselineAgent, '--out', outDir]);
  assert.equal(r.status, 0, `expected exit 0\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  const jsonPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'report.html');
  assert.ok(fs.existsSync(jsonPath), 'report.json should exist');
  assert.ok(fs.existsSync(htmlPath), 'report.html should exist');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /Agent Regression Suite Report/);
  assert.match(html, /booked_call/);
  assert.match(html, /refusal_call/);
  assert.match(html, /transfer_call/);
  assert.match(html, /PASS/);
});

test('acceptance (4): demo:pass exits 0 and demo:fail exits 1 from package scripts', () => {
  const { spawnSync: s } = require('node:child_process');
  const passR = s('npm', ['run', 'demo:pass'], { cwd: toolDir, encoding: 'utf8' });
  assert.equal(passR.status, 0, `demo:pass expected 0, got ${passR.status}\n${passR.stdout}\n${passR.stderr}`);
  assert.match(passR.stdout, /PASS/);
  const failR = s('npm', ['run', 'demo:fail'], { cwd: toolDir, encoding: 'utf8' });
  assert.equal(failR.status, 1, `demo:fail expected 1, got ${failR.status}\n${failR.stdout}\n${failR.stderr}`);
  assert.match(failR.stdout, /FAIL/);
});
