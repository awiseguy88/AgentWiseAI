const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURES = path.join(__dirname, 'fixtures', 'sample-repo');
const Cli = require('../src/cli.js');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const full = path.join(src, name);
    const rel = path.join(dest, name);
    if (fs.statSync(full).isDirectory()) copyDir(full, rel);
    else fs.copyFileSync(full, rel);
  }
  return dest;
}

test('scan produces per-PR estimates for all 10 PRs', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  const capBefore = process.exitCode || 0;
  process.exitCode = 0;
  Cli.runScan({
    diffsDir: FIXTURES,
    outDir: out,
    monthlyCap: 50,
    stateDir: state,
  });
  process.exitCode = capBefore;

  const json = fs.readdirSync(out).filter((n) => n.endsWith('.json')).sort().pop();
  const report = JSON.parse(fs.readFileSync(path.join(out, json), 'utf8'));

  assert.equal(report.summary.pr_count, 10);
  assert.equal(report.summary.total_hunks, 20);
  assert.ok(report.prs.length === 10);
  const byPr = Object.fromEntries(report.prs.map((p) => [String(p.pr), p]));
  // no-change PR pr-10 has zero cost
  assert.equal(byPr['10'].total_hunks, 0);
  assert.equal(byPr['10'].flagged_hunks, 0);
  assert.equal(byPr['10'].total_usd, 0);
  // every PR has required fields
  for (const p of report.prs) {
    assert.ok(String(p.pr));
    assert.ok(typeof p.total_hunks === 'number');
    assert.ok(typeof p.flagged_hunks === 'number');
    assert.ok(typeof p.total_usd === 'number');
  }
});

test('scan flags security, infra, deps, and large hunks', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  process.exitCode = 0;
  Cli.runScan({ diffsDir: FIXTURES, outDir: out, monthlyCap: 50, stateDir: state });
  process.exitCode = 0;

  const json = fs.readdirSync(out).filter((n) => n.endsWith('.json')).sort().pop();
  const report = JSON.parse(fs.readFileSync(path.join(out, json), 'utf8'));
  const byPr = Object.fromEntries(report.prs.map((p) => [String(p.pr), p]));

  assert.ok(byPr['2'].flag_reasons.includes('security_sensitive'), 'pr-02 security');
  assert.ok(byPr['3'].flag_reasons.includes('config_or_infra'), 'pr-03 config/infra');
  assert.ok(byPr['5'].flag_reasons.includes('dependency_change'), 'pr-05 deps');
  assert.ok(byPr['4'].flag_reasons.includes('large_hunk'), 'pr-04 large hunk');
  assert.ok(report.summary.flagged_hunks > 0);
});

test('blocks runs over the monthly cap without network calls', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  process.exitCode = 0;
  Cli.runScan({ diffsDir: FIXTURES, outDir: out, monthlyCap: 0.01, stateDir: state });
  assert.equal(process.exitCode, 2);
  process.exitCode = 0;

  const json = fs.readdirSync(out).filter((n) => n.endsWith('.json')).sort().pop();
  const report = JSON.parse(fs.readFileSync(path.join(out, json), 'utf8'));
  assert.equal(report.summary.status, 'blocked');
  assert.ok(report.summary.cap_reason);
});

test('allows runs within the monthly cap', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  process.exitCode = 0;
  Cli.runScan({ diffsDir: FIXTURES, outDir: out, monthlyCap: 500, stateDir: state });
  assert.equal(process.exitCode, 0);

  const json = fs.readdirSync(out).filter((n) => n.endsWith('.json')).sort().pop();
  const report = JSON.parse(fs.readFileSync(path.join(out, json), 'utf8'));
  assert.equal(report.summary.status, 'allowed');
});

test('emits JSON and HTML reports per run', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  process.exitCode = 0;
  Cli.runScan({ diffsDir: FIXTURES, outDir: out, monthlyCap: 500, stateDir: state });

  const names = fs.readdirSync(out);
  assert.ok(names.some((n) => n.startsWith('cost-guard-report') && n.endsWith('.json')));
  assert.ok(names.some((n) => n.startsWith('cost-guard-report') && n.endsWith('.html')));
});

test('comment payload never auto-approves or merges', () => {
  const out = tmpDir('cost-guard-out-');
  const state = tmpDir('cost-guard-state-');
  process.exitCode = 0;
  Cli.runScan({ diffsDir: FIXTURES, outDir: out, monthlyCap: 500, stateDir: state });

  const md = fs.readdirSync(out).filter((n) => n.endsWith('.md')).sort().pop();
  const payload = fs.readFileSync(path.join(out, md), 'utf8');
  assert.ok(payload.includes('Estimated cost this run'));
  assert.ok(!/^\s*(?:merge|approve)\s/i.test(payload), 'no merge/approve command');
});
