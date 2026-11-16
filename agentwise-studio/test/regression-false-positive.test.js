'use strict';

const assert = require('assert');
const path = require('path');

const { analyze } = require('../src/verifier');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

// Regression for the reported false positive: the only successful command is
// `git status`, but the assistant claims all tests passed. That claim must stay
// unverified; an unrelated nearby result is not test evidence.
function main() {
  const events = [
    { kind: 'assistant', role: 'assistant', text: 'Checking the repo state.' },
    { kind: 'command', command: 'git status' },
    { kind: 'result', command: 'git status', exitCode: 0, output: 'working tree clean' },
    { kind: 'assistant', role: 'assistant', text: 'All tests passed and the build succeeded.' },
  ].map((event, index) => ({ index, ...event }));

  const result = analyze(events);
  assert.strictEqual(result.claims.length, 1, 'expected one completion claim');
  const claim = result.claims[0];
  assert.strictEqual(claim.status, 'unverified', 'unrelated git status must not verify a test claim');
  assert(claim.reasons.some(reason => reason.startsWith('no_matching_command_result')), 'expected no matching command result reason');
  assert(!claim.reasons.some(reason => reason.startsWith('verified_by_exit_0')), 'should not be marked verified by unrelated result');
  console.log('False-positive regression passed.');

  // Fixture file also covers the same case
  const fixture = require(path.join(FIXTURES, 'false-positive.json'));
  assert(fixture && Array.isArray(fixture.events) && fixture.events.length === 4, 'fixture should contain the 4-event case');
}

main();