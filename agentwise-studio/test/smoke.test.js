'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { readTranscript } = require('../src/parser');
const { analyze: analyzeClaims } = require('../src/verifier');
const { importTranscript } = require('../src/import');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

function main() {
  const transcriptPath = path.join(FIXTURES, 'sample-transcript.jsonl');
  const { events, format } = readTranscript(transcriptPath);
  assert(events.length > 0, 'expected parsed events');
  assert(format === 'jsonl', `expected jsonl format, got ${format}`);

  const result = analyzeClaims(events);
  const { claims, summary } = result;
  assert(claims.length >= 4, `expected >=4 claims, got ${claims.length}`);
  assert(summary.total === claims.length, 'summary total mismatch');
  for (const c of claims) {
    assert(c.status === 'verified' || c.status === 'unverified', `invalid status: ${c.status}`);
    assert(Array.isArray(c.reasons) && c.reasons.length > 0, 'each claim should have reasons');
  }

  const verified = claims.filter(c => c.status === 'verified');
  const unverified = claims.filter(c => c.status === 'unverified');
  assert(verified.length >= 1, 'expected at least one verified claim');
  assert(unverified.length >= 3, 'expected multiple unverified claims');

  const reasonsText = unverified.flatMap(c => c.reasons).join('\n');
  assert(/failing_exit_before_claim/.test(reasonsText), 'expected failing_exit_before_claim reason');
  assert(/stale_green/.test(reasonsText), 'expected stale_green reason');
  assert(/no_rebuild|no_matching_command_result/.test(reasonsText), 'expected no_rebuild or no matching command result reason');

  // Import persists to SQLite and returns a run id
  const saved = importTranscript(transcriptPath);
  assert(saved.runId > 0, `expected run id > 0, got ${saved.runId}`);
  assert(saved.name, 'expected a run name');
  assert(saved.claimAnalysis.summary.total === claims.length, 'import summary mismatch');
  assert(saved.driftAnalysis.totals.steps >= 0, 'expected drift totals');

  console.log('Smoke check passed.');
  console.log(`Claims: ${summary.total}, verified: ${summary.verified}, unverified: ${summary.unverified}`);
}

main();