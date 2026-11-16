'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');
const outDir = path.join(root, 'tmp', 'smoke-report');
fs.rmSync(outDir, { recursive: true, force: true });

const fixtures = path.join(root, 'tests', 'fixtures');

// Run: current vs cheaper-but-regressing candidate vs cheaper-clean candidate,
// over bundled tasks + repo-extracted tasks from sample-repo fixture.
const res = spawnSync(process.execPath, [
  cli,
  '--suite', path.join(fixtures, 'sample-repo'),
  '--current', 'mock:' + path.join(fixtures, 'current.mock.json'),
  '--candidate', 'mock:' + path.join(fixtures, 'candidate.mock.json'),
  '--candidate', 'mock:' + path.join(fixtures, 'candidate2.mock.json'),
  '--out-dir', outDir,
], { encoding: 'utf8' });

assert.strictEqual(res.status, 0, `expected exit 0, got ${res.status}\nstdout:${res.stdout}\nstderr:${res.stderr}`);

const reportPath = path.join(outDir, 'report.json');
const htmlPath = path.join(outDir, 'report.html');
assert.ok(fs.existsSync(reportPath), 'report.json should exist');
assert.ok(fs.existsSync(htmlPath), 'report.html should exist');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert.strictEqual(report.tasks_total, 11, `expected 11 tasks (10 bundled + 1 repo), got ${report.tasks_total}`);
assert.ok(report.current.model.endsWith('current.mock.json'));
assert.strictEqual(report.candidates.length, 2);
assert.strictEqual(report.current.total_tasks, 11);

// acceptance 1: per-model pass rate, avg cost, latency present
for (const m of [report.current, ...report.candidates]) {
  assert.ok(typeof m.pass_rate === 'number', 'pass_rate present');
  assert.ok(typeof m.average_cost_usd === 'number', 'average_cost_usd present');
  assert.ok(typeof m.average_latency_ms === 'number', 'average_latency_ms present');
  assert.strictEqual(m.total_tasks, 11);
}

// current passes all tasks
assert.strictEqual(report.current.pass_rate, 1, 'current passes all tasks');
assert.strictEqual(report.current.fail_count, 0);

// acceptance 2: candidate with wrong tool call fails call-tool and is do_not_migrate
const cand1 = report.candidates.find(c => c.model.endsWith('candidate.mock.json'));
assert.ok(cand1, 'candidate 1 found');
const callToolResult = cand1.tasks.find(t => t.task_id === 'call-tool');
assert.ok(callToolResult, 'call-tool task result present');
assert.strictEqual(callToolResult.pass, false, 'candidate fails call-tool');
assert.ok(callToolResult.reason.includes('tool mismatch') || callToolResult.reason.includes('forbidden'), 'failure evidence mentions tool issue');
assert.ok(cand1.failures.length > 0, 'candidate has failure evidence');
assert.strictEqual(cand1.recommendation.verdict, 'do_not_migrate', 'regressing candidate marked do_not_migrate');
assert.ok(cand1.recommendation.failure_evidence.length > 0, 'specific failure evidence present');

// acceptance 3: candidate2 is cheaper, clean -> go / consider with cost-vs-quality
const cand2 = report.candidates.find(c => c.model.endsWith('candidate2.mock.json'));
assert.ok(cand2, 'candidate 2 found');
assert.strictEqual(cand2.failures.length, 0, 'clean candidate has no failures');
assert.ok(['go', 'consider'].includes(cand2.recommendation.verdict), `clean candidate verdict acceptable, got ${cand2.recommendation.verdict}`);
assert.ok(typeof cand2.recommendation.projected_monthly_savings_usd === 'number', 'projected monthly savings present');
assert.ok(typeof cand2.recommendation.quality_delta_percentage_points === 'number', 'quality delta present');

// tool-call accuracy captured for call-tool task (has tool checker)
assert.ok(report.current.tool_call_accuracy !== null, 'current tool-call accuracy recorded');

// acceptance: HTML readable report
const html = fs.readFileSync(htmlPath, 'utf8');
assert.ok(html.includes('LLM Model Migration Watch'), 'HTML title/heading present');
assert.ok(html.includes('PASS') || html.includes('FAIL'), 'HTML per-task results present');
assert.ok(html.includes('do_not_migrate') || html.includes('DO NOT MIGRATE'), 'HTML shows do not migrate verdict');

// console stdout not JSON when --json not used
assert.ok(res.stdout.includes('report written to'), 'CLI prints output location');

console.log('SMOKE OK: migration report generated with bundled+repo tasks, per-model pass/cost/latency/tool-accuracy, regression flagged do_not_migrate, and cost-vs-quality tradeoff.');