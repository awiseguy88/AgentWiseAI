'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Incident fixture: executor can reach Slack/Gmail/Drive connectors -> must flag violations
const incidentOut = path.join(root, 'tmp', 'incident-report');
fs.rmSync(incidentOut, { recursive: true, force: true });
const incident = run([path.join(root, 'test', 'fixtures', 'incident'), '--role', 'executor', '--out-dir', incidentOut]);
assert.strictEqual(incident.status, 1, `incident should exit 1, got ${incident.status}\nstdout:${incident.stdout}\nstderr:${incident.stderr}`);

const incidentJson = readJson(path.join(incidentOut, 'report.json'));
assert.ok(incidentJson.summary.violations > 0, 'incident should have violations');
const connectors = incidentJson.violations.map(v => v.connector);
assert.ok(connectors.includes('slack'), 'slack violation expected');
assert.ok(connectors.includes('gmail'), 'gmail violation expected');
assert.ok(connectors.includes('drive'), 'drive violation expected');
const allRisks = new Set(incidentJson.violations.flatMap(v => v.risks || []));
assert.ok(allRisks.has('impersonate-user'), 'impersonate-user risk expected');
assert.ok(allRisks.has('external-post'), 'external-post risk expected');
assert.ok(incidentJson.violations.some(v => (v.fixSnippets || []).length > 0), 'fix snippets expected');

const incidentHtml = fs.readFileSync(path.join(incidentOut, 'report.html'), 'utf8');
assert.ok(incidentHtml.includes('slack'), 'HTML should mention slack');
assert.ok(incidentHtml.includes('impersonate-user'), 'HTML should mention impersonate-user');
assert.ok(incidentHtml.includes('external-post'), 'HTML should mention external-post');
assert.ok(incidentHtml.toLowerCase().includes('fix') || incidentHtml.includes('Least-privilege'), 'HTML should include fix snippets');

// Disabled fixture: connectors disabled -> should pass
const disabledOut = path.join(root, 'tmp', 'disabled-report');
fs.rmSync(disabledOut, { recursive: true, force: true });
const disabled = run([path.join(root, 'test', 'fixtures', 'disabled'), '--role', 'executor', '--out-dir', disabledOut]);
assert.strictEqual(disabled.status, 0, `disabled should exit 0, got ${disabled.status}\nstdout:${disabled.stdout}\nstderr:${disabled.stderr}`);
const disabledJson = readJson(path.join(disabledOut, 'report.json'));
assert.strictEqual(disabledJson.summary.violations, 0, 'disabled should have zero violations');
assert.strictEqual(disabledJson.summary.status, 'pass', 'disabled status should be pass');

// --json stdout mode
const jsonOut = run([path.join(root, 'test', 'fixtures', 'incident'), '--role', 'executor', '--json']);
assert.strictEqual(jsonOut.status, 1, 'json mode should still exit 1 on violations');
const parsed = JSON.parse(jsonOut.stdout);
assert.ok(parsed.summary && parsed.summary.violations > 0, 'json stdout should contain report');

console.log('SMOKE OK: agent-cap-audit fixtures verified (incident fails with fix snippets, disabled passes).');
