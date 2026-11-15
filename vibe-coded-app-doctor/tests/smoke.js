#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) { console.error('SMOKE FAIL:', msg); process.exit(1); }
}

const root = path.resolve(__dirname, '..');
const fixture = path.join(__dirname, 'fixtures', 'sample-app');
const out = path.join(__dirname, 'out-report.html');
try { fs.unlinkSync(out); } catch {}

const cli = path.join(root, 'src', 'cli.js');
const res = spawnSync(process.execPath, [cli, fixture, '--out', out], { encoding: 'utf8' });
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
assert(res.status === 0, `CLI exited with ${res.status}`);

assert(fs.existsSync(out), 'report file was not created');
const html = fs.readFileSync(out, 'utf8');
assert(html.includes('Vibe-Coded App Doctor'), 'report missing title');
assert(html.includes('hardcoded-secrets'), 'missing hardcoded-secrets category');
assert(html.includes('missing-env-validation'), 'missing missing-env-validation category');
assert(html.includes('unhandled-errors'), 'missing unhandled-errors category');
assert(html.includes('dependency-issues'), 'missing dependency-issues category');
assert(html.includes('exposed-endpoints'), 'missing exposed-endpoints category');
assert(html.includes('missing-tests'), 'missing missing-tests category');
assert(html.includes('src/server.js'), 'missing file/line reference context'); assert(html.includes(':4') || html.includes(':5') || html.includes(':9'), 'missing line number reference');
assert(html.includes('Suggested Fix'), 'missing fix suggestions');

const cats = ['hardcoded-secrets','missing-env-validation','unhandled-errors','dependency-issues','exposed-endpoints','missing-tests'];
const found = cats.filter(c => html.includes(c));
assert(found.length >= 5, `expected >=5 categories, got ${found.length}: ${found.join(',')}`);

console.log('SMOKE PASS: report generated with', found.length, 'categories');
