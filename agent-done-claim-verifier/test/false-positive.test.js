'use strict';

const assert = require('assert');
const { analyze } = require('../src/verifier');

// Regression for the reported false positive: the only successful command is
// `git status`, but the assistant claims all tests passed. That claim must stay
// unverified; an unrelated nearby result is not test evidence.
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
console.log('False-positive regression passed.');
