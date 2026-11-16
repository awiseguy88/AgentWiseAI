#!/usr/bin/env node
'use strict';

// Offline smoke check for Model API Watch.
// Spawns the CLI on the bundled fixture and verifies the report covers the
// documented affected models with change date, replacement, and cost impact,
// and that unaffected models are not flagged. No network.

const { spawnSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-project');

function run(args) {
  const res = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

// 1) Text report on the fixture.
const text = run([FIXTURE]);
check(text.status === 0, `expected exit 0, got ${text.status} (stderr: ${text.stderr.trim()})`);

const out = text.stdout;
check(/Model API Watch/.test(out), 'text report missing title');

const affected = [
  'claude-sonnet-4-5',
  'gemini-4-carbon',
  'gemini-4-argon',
  'gpt-5',
  'o3-mini',
  'gpt-5.6-sol',
];
for (const id of affected) {
  check(out.includes(id), `report missing affected model ${id}`);
}

// Each affected model block must carry change date, replacement and cost note.
for (const needle of ['effective', 'Replace:', 'Cost:', 'Seen at:']) {
  check(out.includes(needle), `report missing field ${needle}`);
}

// Unaffected models must not be flagged.
for (const id of ['claude-3-5-sonnet-20241022', 'gemini-2.5-flash']) {
  check(!out.includes(id), `unaffected model ${id} was incorrectly flagged`);
}

// 2) JSON mode.
const json = run([FIXTURE, '--json']);
check(json.status === 0, `expected exit 0 for --json, got ${json.status}`);
let parsed = null;
try { parsed = JSON.parse(json.stdout); } catch (e) { /* handled below */ }
check(parsed !== null, '--json did not produce valid JSON');
if (parsed) {
  check(Array.isArray(parsed.findings), 'JSON findings is not an array');
  check(parsed.findings.length > 0, 'JSON findings is empty');
  const hasReplacement = parsed.findings.every(f => f.replacement && f.effectiveDate && f.costImpact);
  check(hasReplacement, 'JSON findings missing replacement/date/cost fields');
}

// 3) Error handling on a missing directory.
const missing = run(['/nonexistent/path/xyz']);
check(missing.status === 2, `expected exit 2 for missing dir, got ${missing.status}`);

// Report.
if (failures.length) {
  console.error('Smoke check FAILED:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log(`Smoke check passed: ${affected.length} affected models flagged, ${(parsed && parsed.findings.length) || 'n/a'} references reported.`);