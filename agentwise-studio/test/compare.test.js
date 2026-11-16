'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Point at a temp DB before requiring any studio modules
process.env.STUDIO_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-')), 'test.db');

const { saveRun, listRuns, getRun, deleteRun } = require('../src/db');
const { compareRuns } = require('../src/compare');

function main() {
  // Create two identical empty runs
  const runA = saveRun({
    name: 'run-a',
    sourcePath: 'x.jsonl',
    transcriptFormat: 'jsonl',
    summary: { claims: { total: 0, verified: 0, unverified: 0 } },
    claims: [],
    driftAlerts: [],
    driftSteps: []
  });
  const runB = saveRun({
    name: 'run-b',
    sourcePath: 'x.jsonl',
    transcriptFormat: 'jsonl',
    summary: { claims: { total: 0, verified: 0, unverified: 0 } },
    claims: [],
    driftAlerts: [],
    driftSteps: []
  });

  const identical = compareRuns(runA.runId, runB.runId);
  assert.strictEqual(identical.claims.removed.length, 0, 'identical runs should have no removed claims');
  assert.strictEqual(identical.claims.added.length, 0, 'identical runs should have no added claims');

  // A run with an unverified claim and an alert
  const runC = saveRun({
    name: 'run-c',
    sourcePath: 'x.jsonl',
    transcriptFormat: 'jsonl',
    summary: { claims: { total: 1, verified: 0, unverified: 1 } },
    claims: [
      { turnIndex: 0, claimText: 'Tests all passed.', claimType: 'tests_pass', status: 'unverified', reasons: ['no_matching_command_result: no result clearly matching the claimed check was found nearby'], evidence: { matchedCommand: null, matchedExitCode: null, nearbyCommandCount: 0, nearbyResultCount: 0 } }
    ],
    driftAlerts: [{ type: 'threshold_duration', severity: 'warning', steps: [0], message: 'Step "read_file" took 9000ms', metric: { duration_ms: 9000 } }],
    driftSteps: [{ index: 0, name: 'read_file', type: 'tool', span: null, duration_ms: 9000, prompt_tokens: 50, completion_tokens: 10, total_tokens: 60, quality: 1, input_preview: '{"path":"a.js"}', output_preview: '...', signature: 'read_file|a.js', output_signature: 'read_file|...' }]
  });

  const diff = compareRuns(runA.runId, runC.runId);
  assert.ok(diff.claims.added.length >= 1, 'expected added claim in diff');
  assert.ok(diff.alerts.added.length >= 1, 'expected added alert in diff');

  // Persistence: list shows runs
  const list = listRuns();
  assert.ok(list.length >= 3, 'expected at least 3 runs in list');

  // getRun returns full data
  const full = getRun(runC.runId);
  assert.strictEqual(full.name, 'run-c', 'getRun should return run with matching name');
  assert.strictEqual(full.claims.length, 1, 'getRun should return claims');
  assert.strictEqual(full.driftAlerts.length, 1, 'getRun should return drift alerts');

  // deleteRun removes a run
  deleteRun(runB.runId);
  const after = getRun(runB.runId);
  assert.strictEqual(after, null, 'deleted run should not be found');

  console.log('Compare smoke passed.');
  console.log(`Identical runs: no diffs. Different runs: ${diff.claims.added.length} added claims, ${diff.alerts.added.length} added alerts.`);
}

main();