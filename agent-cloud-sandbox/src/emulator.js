'use strict';

// Bundled local AWS Emulator stub. Offline by design: no network calls, no external
// dependencies. Provides deterministic, in-memory implementations of the service
// surfaces exercised by the fixture catalog so agents can run smoke tests locally.
//
// Backend selection:
//   'stub' (default, offline) — uses these in-memory implementations.
//   'aws-emulator' / 'localstack' — hooks exist for future multi-emulator support;
//   in this milestone they fall back to the stub so dry-runs/tests stay deterministic.

const SERVICES = ['dynamodb', 'lambda', 'sqs', 'stepfunctions'];

function now() { return new Date().toISOString(); }

class DynamoDB {
  constructor() { this.tables = new Map(); this.networkCalls = 0; }
  createTable(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return { TableDescription: { TableName: name, TableStatus: 'ACTIVE' } };
  }
  putItem(table, item) {
    const t = this.tables.get(table); if (!t) throw new Error(`ResourceNotFoundException: Table ${table} not found`);
    t.set(item.pk, { ...item }); return {};
  }
  getItem(table, pk) {
    const t = this.tables.get(table); if (!t) throw new Error(`ResourceNotFoundException: Table ${table} not found`);
    return t.get(pk) || null;
  }
  updateItem(table, pk, attrs) {
    const t = this.tables.get(table); if (!t) throw new Error(`ResourceNotFoundException: Table ${table} not found`);
    const cur = t.get(pk); if (!cur) throw new Error(`ConditionalCheckFailedException: item ${pk} not found`);
    Object.assign(cur, attrs); t.set(pk, cur); return cur;
  }
  deleteItem(table, pk) {
    const t = this.tables.get(table); if (!t) throw new Error(`ResourceNotFoundException: Table ${table} not found`);
    t.delete(pk); return {};
  }
  listTables() { return Array.from(this.tables.keys()); }
}

class Lambda {
  constructor(dynamo) { this.dynamo = dynamo; this.functions = new Map(); this.networkCalls = 0; }
  createFunction(name, handler) { this.functions.set(name, handler); return { FunctionName: name, State: 'Active' }; }
  invoke(name, payload) {
    const h = this.functions.get(name);
    if (!h) throw new Error(`ResourceNotFoundException: Function ${name} not found`);
    return h(payload, this.dynamo);
  }
}

class SQS {
  constructor() { this.queues = new Map(); this.networkCalls = 0; }
  createQueue(name) {
    if (!this.queues.has(name)) this.queues.set(name, []);
    return { QueueUrl: `http://localhost:4566/000000000000/${name}` };
  }
  sendMessage(queue, body) {
    const q = this.queues.get(queue); if (!q) throw new Error(`AWS.SimpleQueueService.NonExistentQueue: ${queue}`);
    q.push({ body, id: `m-${q.length + 1}`, sentAt: now() }); return { MessageId: `m-${q.length}` };
  }
  receiveMessages(queue, max = 10) {
    const q = this.queues.get(queue); if (!q) throw new Error(`AWS.SimpleQueueService.NonExistentQueue: ${queue}`);
    return q.splice(0, max);
  }
  getQueueUrl(name) { return this.queues.has(name) ? `http://localhost:4566/000000000000/${name}` : null; }
}

class StepFunctions {
  constructor() { this.machines = new Map(); this.executions = new Map(); this.networkCalls = 0; }
  createStateMachine(name, definition) { this.machines.set(name, definition); return { stateMachineArn: `arn:aws:states:us-east-1:000000000000:stateMachine:${name}` }; }
  startExecution(machine, input) {
    const def = this.machines.get(machine); if (!def) throw new Error(`StateMachineDoesNotExist: ${machine}`);
    const arn = `arn:aws:states:us-east-1:000000000000:execution:${machine}:${Date.now()}`;
    // Run the state machine steps sequentially: each step transforms the accumulator.
    let acc = { ...input };
    for (const step of def) {
      if (step && typeof step.input === 'object') acc = { ...acc, ...step.input };
    }
    const out = { ...acc, status: 'SUCCEEDED' };
    this.executions.set(arn, { status: 'SUCCEEDED', output: out, startedAt: now() });
    return { executionArn: arn };
  }
  describeExecution(arn) { return this.executions.get(arn) || { status: 'FAILED' }; }
}

class Emulator {
  constructor(backend = 'stub') {
    this.backend = backend;
    this.networkCalls = 0;
    this.started = false;
    this.startedAt = null;
    this.dynamodb = new DynamoDB();
    this.lambda = new Lambda(this.dynamodb);
    this.sqs = new SQS();
    this.stepfunctions = new StepFunctions();
  }
  start() {
    // Managed local process wrapper: in stub mode this is synchronous and offline.
    this.started = true;
    this.startedAt = now();
    return { ok: true, backend: this.backend, startedAt: this.startedAt, networkCalls: this.networkCalls };
  }
  stop() { this.started = false; return { ok: true }; }
  isOffline() { return true; }
  totalNetworkCalls() {
    return this.networkCalls + this.dynamodb.networkCalls + this.lambda.networkCalls + this.sqs.networkCalls + this.stepfunctions.networkCalls;
  }
}

function createEmulator(backend = 'stub') {
  // Future multi-emulator support: real 'aws-emulator'/'localstack' would spawn a process here.
  return new Emulator(backend === 'stub' ? 'stub' : backend);
}

module.exports = { Emulator, createEmulator, SERVICES };
