'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const { applyBudget } = require('../src/budget');
const { Reporter } = require('../src/reporter');

test('AC1/AC2: budget truncates oversized results with marker and passes through small results byte-identical', () => {
  // AC2: under-budget result passes through byte-identical
  const small = 'hello world';
  const r2 = applyBudget(small, 2000, '[TRUNC]');
  assert.equal(r2.budgeted, false);
  assert.equal(r2.result, small);

  // AC1: over-budget recorded large result returns truncated with marker and runs offline
  const largeParts = [];
  for (let i = 0; i < 120; i++) {
    largeParts.push({ id: i, text: `log line ${i}: error details payload chunk with id ${i} and extra context words to inflate token count` });
  }
  const large = JSON.stringify({ ok: true, items: largeParts, note: 'recorded large output' });
  const r1 = applyBudget(large, 2000, '[TRUNC] — original result was longer than the budget.');
  assert.equal(r1.budgeted, true);
  assert.ok(r1.result.includes('[TRUNC] — original result was longer than the budget.'));
  assert.ok(r1.result.length < large.length);
});

test('AC3: verify reports post-token total lower than baseline on sample five-tool config', () => {
  const { execFileSync } = require('child_process');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-verify-'));
  const fake = path.join(__dirname, 'fake-mcp-server.js');
  const configPath = path.join(outDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    servers: {
      fake: {
        name: 'fake',
        transport: 'stdio',
        budget: 2000,
        command: process.execPath,
        args: [fake],
      }
    },
    defaultBudget: 2000,
  }), 'utf8');
  const cli = path.join(__dirname, '..', 'src', 'cli.js');
  const out = execFileSync(process.execPath, [cli, 'verify', '--config', configPath, '--out', outDir], { encoding: 'utf8' });
  const summary = JSON.parse(out);
  assert.equal(summary.pass, true);
  assert.ok(summary.postTokenTotal < summary.baselineTokenTotal, `expected post ${summary.postTokenTotal} < baseline ${summary.baselineTokenTotal}`);
  assert.ok(summary.budgetedCalls > 0, 'expected at least one tool call to be budgeted');
  assert.ok(fs.existsSync(summary.reportJson));
  assert.ok(fs.existsSync(summary.reportHtml));
});

test('Reporter emits JSON and HTML reports', () => {
  const rep = new Reporter();
  rep.record({ server: 's1', tool: 't1', result: applyBudget('a'.repeat(2000), 50, '[MARK]') });
  rep.record({ server: 's1', tool: 't2', result: applyBudget('short', 50, '[MARK]') });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-report-'));
  const paths = rep.writeFiles(outDir);
  assert.ok(fs.existsSync(paths.jsonPath));
  assert.ok(fs.existsSync(paths.htmlPath));
  const j = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
  assert.ok(j.summary.calls >= 2);
});