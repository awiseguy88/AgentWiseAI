const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateAction, loadAndValidatePack } = require('../src/validator');

const root = path.resolve(__dirname, '..');
const rulesPath = path.join(root, 'fixtures/rules/refund-order.json');
const validPath = path.join(root, 'fixtures/actions/valid-refund.json');
const undeliveredPath = path.join(root, 'fixtures/actions/invalid-undelivered.json');
const amountPath = path.join(root, 'fixtures/actions/invalid-amount.json');
const tracePath = path.join(root, 'fixtures/traces/recorded-5-actions.json');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

test('valid refund fixture passes and is executable', () => {
  const rules = loadJson(rulesPath);
  const action = loadJson(validPath);
  const result = validateAction(rules, action);
  assert.equal(result.valid, true, JSON.stringify(result.violations));
  assert.equal(result.actionType, 'refund');
});

test('invalid refund: undelivered order is blocked with rule/field/message violations', () => {
  const rules = loadJson(rulesPath);
  const action = loadJson(undeliveredPath);
  const result = validateAction(rules, action);
  assert.equal(result.valid, false);
  assert.ok(result.violations.length >= 1);
  for (const v of result.violations) {
    assert.ok(v.rule, 'violation has rule');
    assert.ok(v.field, 'violation has field');
    assert.ok(v.message, 'violation has message');
  }
  assert.ok(result.violations.some(v => v.rule === 'entityFieldEquals' && v.field === 'orderId'));
});

test('invalid refund: amount above total is blocked with rule/field/message violations', () => {
  const rules = loadJson(rulesPath);
  const action = loadJson(amountPath);
  const result = validateAction(rules, action);
  assert.equal(result.valid, false);
  assert.ok(result.violations.length >= 1);
  assert.ok(result.violations.some(v => v.rule === 'entityFieldMax' && v.field === 'amount'));
});

test('malformed rule file fails fast with actionable diagnostics and non-zero CLI exit, leaving packs unchanged', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aog-'));
  const badRulesPath = path.join(tmpDir, 'bad-rules.json');
  fs.writeFileSync(badRulesPath, JSON.stringify({ version: 1, entities: { Order: { fields: {} } }, actions: { refund: { constraints: [{ rule: 'entityExists', entity: 'Missing', field: 'orderId', message: 'x' }] } } }));
  const before = fs.readFileSync(rulesPath, 'utf8');
  const res = spawnSync('node', [path.join(root, 'src/cli.js'), 'validate', validPath, '--rules', badRulesPath], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'expected non-zero exit for malformed rules');
  assert.ok(res.stderr.includes('unknown entity'), res.stderr);
  const after = fs.readFileSync(rulesPath, 'utf8');
  assert.equal(before, after, 'existing rule packs unchanged');
});

test('replay recorded 5-action trace produces audit report with pass/fail, violated rules, corrective fields', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aog-replay-'));
  const res = spawnSync('node', [path.join(root, 'src/cli.js'), 'replay', tracePath, '--rules', rulesPath, '--data', rulesPath, '--out-dir', tmpDir], { encoding: 'utf8' });
  // replay always exit 1 if any blocked, so don't require zero
  assert.ok(res.stdout.includes('Audit'), res.stderr);
  const auditJsonPath = path.join(tmpDir, 'audit.json');
  const auditHtmlPath = path.join(tmpDir, 'audit.html');
  assert.ok(fs.existsSync(auditJsonPath), 'audit.json exists');
  assert.ok(fs.existsSync(auditHtmlPath), 'audit.html exists');
  const entries = JSON.parse(fs.readFileSync(auditJsonPath, 'utf8'));
  assert.equal(entries.length, 5);
  const blocked = entries.filter(e => !e.valid);
  assert.ok(blocked.length >= 2, 'trace has blocked actions');
  for (const b of blocked) {
    assert.ok(b.violations.length >= 1);
    for (const v of b.violations) {
      assert.ok(v.rule && v.field && v.message, 'trace violations name rule, field, message');
    }
  }
});

test('loadAndValidatePack throws on unknown entity reference', () => {
  assert.throws(() => loadAndValidatePack({ version: 1, entities: { Order: { fields: {} } }, actions: { refund: { constraints: [{ rule: 'entityExists', entity: 'Missing', field: 'x', message: 'y' }] } } }), /unknown entity/);
});

test('violations carry machine-readable suggested corrective fields', () => {
  const rules = loadJson(rulesPath);
  const action = loadJson(amountPath);
  const result = validateAction(rules, action);
  assert.equal(result.valid, false);
  const v = result.violations.find(x => x.rule === 'entityFieldMax');
  assert.ok(v, 'entityFieldMax violation present');
  assert.ok(v.suggested && typeof v.suggested === 'object', 'violation has suggested corrective fields');
  assert.ok(Object.keys(v.suggested).length >= 1, 'suggested has at least one corrective key');
});
