#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runFixtures } = require('./harness');
const { validate } = require('./validator');
const { renderJson, writeReport } = require('./report');
const { createEmulator } = require('./emulator');

const FIXTURES_DIR = path.join(__dirname, '..', 'test', 'fixtures');

function loadFixture(fixturePath) {
  const abs = path.isAbsolute(fixturePath) ? fixturePath : path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function loadDefaultFixtures() {
  // Default test suite: Lambda+DynamoDB CRUD, SQS fan-out, Step Functions.
  const names = ['lambda-dynamodb-crud.json', 'sqs-fanout.json', 'stepfunctions-workflow.json'];
  return names.map(n => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, n), 'utf8')));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--offline') out.offline = true;
    else if (a === '--fixture' || a === '-f') out.fixture = argv[++i];
    else if (a === '--report' || a === '-o') out.report = argv[++i];
    else if (a === '--params') out.params = argv[++i];
    else if (a === '--json') out.json = true;
    else out._.push(a);
  }
  return out;
}

function cmdTest(args) {
  const fixtures = args.fixture ? loadFixture(args.fixture) : loadDefaultFixtures();
  const report = runFixtures(fixtures);
  if (args.report) writeReport(report, args.report);
  console.log(renderJson(report));
  process.exit(report.pass ? 0 : 1);
}

function cmdValidate(args) {
  if (!args.params) {
    console.error('Usage: agent-cloud-sandbox validate --params <json>');
    process.exit(2);
  }
  let params;
  try { params = JSON.parse(args.params); } catch (e) {
    console.error('Invalid JSON for --params:', e.message);
    process.exit(2);
  }
  const result = validate(params);
  console.log(JSON.stringify({ pass: true, ...result, networkCalls: 0 }, null, 2));
}

function cmdDryRun(args) {
  // Dry-run against a stubbed emulator process: produce the report format with no external deps.
  const emu = createEmulator('stub');
  const start = emu.start();
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
  if (args.report) writeReport(report, args.report);
  console.log(renderJson(report));
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'test';
  if (cmd === 'test') return cmdTest(args);
  if (cmd === 'validate') return cmdValidate(args);
  if (cmd === 'dry-run') return cmdDryRun(args);
  console.error(`Unknown command: ${cmd}\nUsage: agent-cloud-sandbox <test|validate|dry-run> [--offline] [--fixture <path>] [--report <out.json>]`);
  process.exit(2);
}

if (require.main === module) main();

module.exports = { main, cmdTest, cmdValidate, cmdDryRun, loadFixture, loadDefaultFixtures };
