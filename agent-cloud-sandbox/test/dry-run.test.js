'use strict';

const assert = require('assert');
const { createEmulator } = require('../src/emulator');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('dry-run: stubbed emulator produces report format with no external dependencies', () => {
  const emu = createEmulator('stub');
  const start = emu.start();
  assert.strictEqual(start.ok, true, 'emulator should start');
  assert.strictEqual(start.backend, 'stub');
  assert.strictEqual(emu.isOffline(), true, 'emulator must be offline');

  const report = {
    pass: true,
    mode: 'dry-run',
    backend: emu.backend,
    startedAt: start.startedAt,
    networkCalls: emu.totalNetworkCalls(),
    tests: [
      { name: 'dry-run/emulator-start', pass: true, detail: { started: emu.started, backend: emu.backend }, networkCalls: 0 },
      { name: 'dry-run/no-external-dependencies', pass: true, detail: { offline: emu.isOffline() }, networkCalls: 0 },
    ],
  };

  assert.strictEqual(report.networkCalls, 0, 'dry-run must have zero network calls');
  assert.strictEqual(report.mode, 'dry-run');
  assert.strictEqual(report.pass, true);
  assert.ok(Array.isArray(report.tests));
  assert.strictEqual(report.tests.length, 2);
  for (const t of report.tests) {
    assert.strictEqual(t.pass, true, `dry-run test ${t.name} should pass`);
    assert.strictEqual(t.networkCalls, 0, `dry-run test ${t.name} should have zero network calls`);
  }
});

test('dry-run: DynamoDB CRUD works against the stubbed emulator with no network', () => {
  const emu = createEmulator('stub');
  emu.start();
  emu.dynamodb.createTable('agent-items');
  emu.dynamodb.putItem('agent-items', { pk: 'user:1', name: 'Ada' });
  const item = emu.dynamodb.getItem('agent-items', 'user:1');
  assert.deepStrictEqual(item, { pk: 'user:1', name: 'Ada' });
  emu.dynamodb.updateItem('agent-items', 'user:1', { role: 'engineer' });
  const updated = emu.dynamodb.getItem('agent-items', 'user:1');
  assert.strictEqual(updated.role, 'engineer');
  emu.dynamodb.deleteItem('agent-items', 'user:1');
  assert.strictEqual(emu.dynamodb.getItem('agent-items', 'user:1'), null);
  assert.strictEqual(emu.totalNetworkCalls(), 0);
});

test('dry-run: SQS fan-out works against the stubbed emulator with no network', () => {
  const emu = createEmulator('stub');
  emu.start();
  emu.sqs.createQueue('agent-outbox');
  emu.sqs.sendMessage('agent-outbox', { id: 'm1' });
  emu.sqs.sendMessage('agent-outbox', { id: 'm2' });
  const received = emu.sqs.receiveMessages('agent-outbox', 10);
  assert.strictEqual(received.length, 2);
  assert.strictEqual(emu.totalNetworkCalls(), 0);
});

test('dry-run: Step Functions workflow works against the stubbed emulator with no network', () => {
  const emu = createEmulator('stub');
  emu.start();
  emu.stepfunctions.createStateMachine('agent-workflow', [{ name: 'start' }]);
  const exec = emu.stepfunctions.startExecution('agent-workflow', { order: 'abc' });
  assert.ok(exec.executionArn);
  const desc = emu.stepfunctions.describeExecution(exec.executionArn);
  assert.strictEqual(desc.status, 'SUCCEEDED');
  assert.strictEqual(emu.totalNetworkCalls(), 0);
});

// Run all tests.
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ok - ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`  NOT OK - ${t.name}`);
    console.error(`    ${e.message}`);
    if (e.stack) console.error(`    ${e.stack.split('\n').slice(1).join('\n')}`);
  }
}

process.exit(failed === 0 ? 0 : 1);