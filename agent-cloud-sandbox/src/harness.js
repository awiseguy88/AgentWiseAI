'use strict';

// Test harness: starts the emulator, deploys fixtures, runs deterministic smoke
// tests, and records pass/fail per test. Also handles the deliberate IAM
// permission-error fixture so agents get a structured, consumable error.

const { createEmulator } = require('./emulator');

// Run a single named test; on success record pass, on failure record structured error.
function runTest(name, fn, networkCallsBefore) {
  try {
    const detail = fn();
    return {
      name,
      pass: true,
      detail: detail || {},
      networkCalls: 0,
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const structured = structureError(message, err);
    return {
      name,
      pass: false,
      detail: {},
      error: structured,
      networkCalls: 0,
    };
  }
}

// Turn a raw error message into a structured, agent-consumable error.
function structureError(message, captured) {
  const out = { type: 'Unknown', message, permission: null, resourceArn: null };
  // If the caller already captured structured fields (e.g. iamDenied), honor them.
  if (captured && captured.permission) out.permission = captured.permission;
  if (captured && captured.resourceArn) out.resourceArn = captured.resourceArn;

  if (out.permission) out.type = 'PermissionDenied';

  if (!out.permission) {
    const permMatch = /(?:AccessDenied|AccessDeniedException|no permission|permission denied)[:\s]*(?:the\s*)?([A-Za-z0-9:_-]+)/i.exec(message);
    if (permMatch) {
      out.type = 'PermissionDenied';
      out.permission = permMatch[1];
    }
  }
  const arnMatch = /(arn:aws:[A-Za-z0-9:/-]+)/i.exec(message);
  if (arnMatch && !out.resourceArn) out.resourceArn = arnMatch[0];
  if (out.resourceArn && captured && captured.resourceArn) out.resourceArn = captured.resourceArn;

  if (!out.permission) {
    // derive a likely missing permission from the resource type named in the message
    const tableMatch = /Table\s+([A-Za-z0-9_.-]+)/i.exec(message);
    if (tableMatch && /Dynamo/i.test(message)) out.permission = `dynamodb:* on Table ${tableMatch[1]}`;
    const fnMatch = /Function\s+([A-Za-z0-9_.-]+)/i.exec(message);
    if (fnMatch && /Lambda/i.test(message)) out.permission = `lambda:InvokeFunction on ${fnMatch[1]}`;
  }
  if (out.permission && !out.resourceArn) {
    out.resourceArn = `arn:aws:${out.type === 'PermissionDenied' ? 'iam' : 'lambda'}:us-east-1:000000000000:${out.permission.split(':')[0]}`;
  }
  return out;
}

// Build the fixture deployment plan from a fixture catalog entry.
function buildPlan(fixture) {
  return fixture.steps.map(step => ({
    service: step.service,
    action: step.action,
    name: step.name,
    params: step.params,
  }));
}

/**
 * Run all fixtures against the emulator and return a structured report.
 * fixture can be:
 *   - { name, steps: [ { name, service, action, params } ] } (inline catalog entry)
 *   - array of such entries
 */
function runFixtures(fixture) {
  const emu = createEmulator('stub');
  const start = emu.start();
  const entries = Array.isArray(fixture) ? fixture : [fixture];
  const tests = [];
  let allPass = true;

  for (const entry of entries) {
    const ctx = {};
    for (const step of buildPlan(entry)) {
      const before = emu.totalNetworkCalls();
      const result = runTest(`${entry.name}/${step.name}`, () => runStep(emu, step, ctx), before);
      tests.push(result);
      if (!result.pass) allPass = false;
    }
  }

  return {
    pass: allPass,
    backend: emu.backend,
    startedAt: start.startedAt,
    networkCalls: emu.totalNetworkCalls(),
    tests,
  };
}

// Execute a single fixture step against the appropriate emulator service.
function runStep(emu, step, ctx = {}) {
  const { service, action, params } = step;

  // Deliberate IAM permission error in a fixture: throw a structured AccessDenied.
  if (params && params.iamDenied) {
    const permission = params.iamDenied;
    const arn = params.resourceArn || `arn:aws:${service}:us-east-1:000000000000:resource/unknown`;
    const err = new Error(`AccessDeniedException: User is not authorized to perform ${permission} on resource ${arn}`);
    err.permission = permission;
    err.resourceArn = arn;
    throw err;
  }

  switch (service) {
    case 'dynamodb':
      if (action === 'create-table') return emu.dynamodb.createTable(params.table);
      if (action === 'put') return emu.dynamodb.putItem(params.table, { pk: params.pk, ...params.item });
      if (action === 'get') {
        const item = emu.dynamodb.getItem(params.table, params.pk);
        if (!item) throw new Error(`ItemNotFound: Table ${params.table} pk ${params.pk}`);
        return item;
      }
      if (action === 'update') return emu.dynamodb.updateItem(params.table, params.pk, params.attrs);
      if (action === 'delete') return emu.dynamodb.deleteItem(params.table, params.pk);
      throw new Error(`Unsupported dynamodb action: ${action}`);
    case 'lambda': {
      if (!emu.lambda.functions.has(params.function)) {
        emu.lambda.createFunction(params.function, () => ({ status: 'ok' }));
      }
      return emu.lambda.invoke(params.function, params.payload || {});
    }
    case 'sqs':
      if (action === 'create-queue') return emu.sqs.createQueue(params.queue);
      if (action === 'send') return emu.sqs.sendMessage(params.queue, params.body);
      if (action === 'receive') return emu.sqs.receiveMessages(params.queue);
      if (action === 'fan-out') {
        // fan-out: send N messages then drain
        const q = emu.sqs.createQueue(params.queue).QueueUrl;
        const sent = [];
        for (const body of params.messages) sent.push(emu.sqs.sendMessage(params.queue, body));
        return { QueueUrl: q, sent, received: emu.sqs.receiveMessages(params.queue, params.messages.length) };
      }
      throw new Error(`Unsupported sqs action: ${action}`);
    case 'stepfunctions':
      if (action === 'create-machine') return emu.stepfunctions.createStateMachine(params.stateMachine, params.definition);
      if (action === 'start') {
        const res = emu.stepfunctions.startExecution(params.stateMachine, params.input || {});
        ctx.lastExecutionArn = res.executionArn;
        return res;
      }
      if (action === 'describe') {
        const arn = params.executionArn === '$last' && ctx.lastExecutionArn ? ctx.lastExecutionArn : params.executionArn;
        const desc = emu.stepfunctions.describeExecution(arn);
        if (params.expectSucceeded && desc.status !== 'SUCCEEDED') throw new Error(`Execution not succeeded: ${desc.status}`);
        return desc;
      }
      throw new Error(`Unsupported stepfunctions action: ${action}`);
    default:
      throw new Error(`Unsupported service: ${service}`);
  }
}

module.exports = { runFixtures, runStep, structureError };