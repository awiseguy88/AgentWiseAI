'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');

function run(args, cwd = root) {
  const res = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  if (res.error) throw res.error;
  return res;
}

(function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-escape-'));
  const out1 = path.join(tmp, 'out1');

  // 1) With CSVs + JSON notes
  const r1 = run([
    '--csv', path.join(root, 'samples', 'tasks.csv'),
    '--csv', path.join(root, 'samples', 'users.csv'),
    '--notes', path.join(root, 'samples', 'app-notes.json'),
    '--out', out1,
    '--name', 'Field Ops'
  ]);
  assert.strictEqual(r1.status, 0, `CLI failed: ${r1.stderr}\n${r1.stdout}`);

  for (const f of ['report.html', 'inventory.json', 'checklist.md', 'cost-worksheet.csv']) {
    assert.ok(fs.existsSync(path.join(out1, f)), `missing ${f}`);
  }

  const html = fs.readFileSync(path.join(out1, 'report.html'), 'utf8');
  assert.ok(html.includes('tasks'), 'report should include tasks table');
  assert.ok(html.includes('Assignee Id'), 'report should include column name');
  assert.ok(html.includes('Verified data findings'), 'report should label verified data findings');
  assert.ok(html.includes('User-supplied logic notes'), 'report should label user-supplied notes');
  assert.ok(/Relation hints/i.test(html), 'report should include relation hints section');
  assert.ok(/Mostly-empty columns/i.test(html) || /Missing \/ mostly-empty columns/i.test(html), 'report should include empty columns section');
  assert.ok(html.includes('Field Ops (Glide Classic)'), 'report should include app name from notes');
  assert.ok(html.includes('Dashboard'), 'report should include user-supplied screen');
  assert.ok(html.includes('Rough cost-comparison worksheet'), 'report should include cost worksheet');

  const checklist = fs.readFileSync(path.join(out1, 'checklist.md'), 'utf8');
  assert.ok(checklist.includes('Verified data findings'), 'checklist should separate verified findings');
  assert.ok(checklist.includes('user-supplied notes'), 'checklist should mention user-supplied notes');
  assert.ok(checklist.includes('Tasks list') || checklist.includes('Dashboard'), 'checklist should include screen/logic from notes');

  const cost = fs.readFileSync(path.join(out1, 'cost-worksheet.csv'), 'utf8');
  assert.ok(cost.includes('Glide Classic'), 'cost worksheet should include Glide Classic');
  assert.ok(cost.includes('GlideOS'), 'cost worksheet should include GlideOS');
  assert.ok(cost.includes('Generic rebuild'), 'cost worksheet should include Generic rebuild');

  const inv = JSON.parse(fs.readFileSync(path.join(out1, 'inventory.json'), 'utf8'));
  assert.ok(inv.analysis && inv.analysis.tables.length === 2, 'inventory should include analyzed tables');

  // 2) CSVs only (no notes) => templates still generated
  const out2 = path.join(tmp, 'out2');
  const r2 = run(['--csv', path.join(root, 'samples', 'tasks.csv'), '--out', out2]);
  assert.strictEqual(r2.status, 0, `CLI without notes failed: ${r2.stderr}\n${r2.stdout}`);
  const html2 = fs.readFileSync(path.join(out2, 'report.html'), 'utf8');
  assert.ok(html2.includes('Starter template') || html2.includes('template'), 'report should show templates when no notes');
  assert.ok(fs.existsSync(path.join(out2, 'checklist.md')) && fs.existsSync(path.join(out2, 'cost-worksheet.csv')), 'checklist and cost worksheet should be generated without notes');

  // 3) YAML notes parse
  const out3 = path.join(tmp, 'out3');
  const r3 = run(['--csv', path.join(root, 'samples', 'users.csv'), '--notes', path.join(root, 'samples', 'app-notes.yaml'), '--out', out3]);
  assert.strictEqual(r3.status, 0, `CLI with YAML notes failed: ${r3.stderr}\n${r3.stdout}`);
  const html3 = fs.readFileSync(path.join(out3, 'report.html'), 'utf8');
  assert.ok(html3.includes('Field Ops (Glide Classic)'), 'YAML notes app name should appear');

  console.log('smoke ok');
})();
