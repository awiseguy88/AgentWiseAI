'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { runFixtures } = require('../src/harness');
const { validate } = require('../src/validator');
const { renderJson, renderHtml } = require('../src/report');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('smoke: Lambda+DynamoDB CRUD fixture passes with pass=true and zero network calls', () => {
  const report = runFixtures(load('lambda-dynamodb-crud.json'));
  assert.strictEqual(report.pass, true, `expected pass=true, got ${report.pass}`);
  assert.strictEqual(report.networkCalls, 0, `expected zero network calls, got ${report.networkCalls}`);
  assert.ok(report.tests.length >= 6, `expected >=6 tests, got ${report.tests.length}`);
  for (const t of report.tests) {
    assert.strictEqual(t.pass, true, `test ${t.name} should pass`);
  }
});

test('smoke: SQS+Lambda fan-out fixture passes', () => {
  const report = runFixtures(load('sqs-fanout.json'));
  assert.strictEqual(report.pass, true);
  assert.strictEqual(report.networkCalls, 0);
  const fanout = report.tests.find(t => t.name.endsWith('/fan-out'));
  assert.ok(fanout, 'fan-out test should exist');
  assert.strictEqual(fanout.pass, true);
});

test('smoke: Step Functions workflow fixture passes', () => {
  const report = runFixtures(load('stepfunctions-workflow.json'));
  assert.strictEqual(report.pass, true);
  assert.strictEqual(report.networkCalls, 0);
  const describe = report.tests.find(t => t.name.endsWith('/describe-execution'));
  assert.ok(describe, 'describe-execution test should exist');
  assert.strictEqual(describe.pass, true);
});

test('smoke: IAM permission-error fixture reports pass=false with structured error', () => {
  const report = runFixtures(load('iam-permission-error.json'));
  assert.strictEqual(report.pass, false, 'fixture with deliberate IAM error must report pass=false');
  const failed = report.tests.filter(t => !t.pass);
  assert.ok(failed.length >= 1, 'at least one failing test expected');
  const put = failed.find(t => t.name.endsWith('/put-item-denied'));
  assert.ok(put, 'put-item-denied test should fail');
  const err = put.error;
  assert.ok(err, 'structured error should be present');
  assert.strictEqual(err.type, 'PermissionDenied', `expected PermissionDenied, got ${err.type}`);
  assert.ok(err.permission, 'permission should be named');
  assert.ok(/dynamodb:PutItem/.test(err.permission), `expected dynamodb:PutItem permission, got ${err.permission}`);
  assert.ok(err.resourceArn, 'resource ARN should be present');
  assert.ok(/table\/agent-secret/.test(err.resourceArn), `expected table/agent-secret ARN, got ${err.resourceArn}`);
});

test('validator corrects hallucinated parameters to emulator-supported values', () => {
  const result = validate({
    service: 'dynamo',
    region: 'us-west-99',
    endpoint: 'https://api.aws.example.com',
    table: 'my-table!!',
    pk: 'user:1',
  });
  assert.strictEqual(result.corrected.service, 'dynamodb', `service corrected to dynamodb, got ${result.corrected.service}`);
  assert.ok(result.corrections.some(c => /service/.test(c)), 'service correction recorded');
  assert.ok(result.corrections.some(c => /region/.test(c)), 'region correction recorded');
  assert.ok(result.corrections.some(c => /endpoint/.test(c)), 'endpoint correction recorded');
  assert.strictEqual(result.corrected.endpoint, 'http://localhost:4566');
  assert.strictEqual(result.corrected.region, 'us-east-1');
});

test('validator passes through supported parameters unchanged', () => {
  const result = validate({ service: 'sqs', region: 'eu-west-1', queue: 'agent-outbox', body: 'hello' });
  assert.strictEqual(result.corrected.service, 'sqs');
  assert.strictEqual(result.corrected.region, 'eu-west-1');
  assert.strictEqual(result.corrected.queue, 'agent-outbox');
  assert.strictEqual(result.corrected.body, 'hello');
  assert.strictEqual(result.corrections.length, 0);
});

test('report JSON is valid and contains required fields', () => {
  const report = runFixtures(load('lambda-dynamodb-crud.json'));
  const json = renderJson(report);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.pass, true);
  assert.ok(Array.isArray(parsed.tests));
  assert.ok(Array.isArray(parsed.errors));
  assert.strictEqual(parsed.networkCalls, 0);
});

test('report HTML is generated and contains test names', () => {
  const report = runFixtures(load('lambda-dynamodb-crud.json'));
  const html = renderHtml(report);
  assert.ok(/<!doctype html>/i.test(html), 'HTML should start with doctype');
  assert.ok(/Agent Cloud Sandbox Report/.test(html), 'HTML should contain report title');
  assert.ok(/create-table/.test(html), 'HTML should contain a test name');
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