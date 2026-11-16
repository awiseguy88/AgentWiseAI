'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseTranscript, extractText } = require('../src/parser');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-parse-'));
try {
  // JSONL
  const jsonl = path.join(tmp, 'a.jsonl');
  fs.writeFileSync(jsonl, JSON.stringify({ role: 'assistant', text: 'hello world' }) + '\n' + JSON.stringify({ role: 'assistant', text: 'second turn' }) + '\n');
  let turns = parseTranscript(jsonl);
  assert.strictEqual(turns.length, 2, 'jsonl should yield 2 turns');
  assert.strictEqual(turns[0].role, 'assistant');

  // JSON array
  const j = path.join(tmp, 'b.json');
  fs.writeFileSync(j, JSON.stringify([{ role: 'assistant', text: 'turn one' }, { role: 'user', text: 'hi' }]));
  turns = parseTranscript(j);
  assert.ok(turns.length >= 1, 'json array should yield at least one turn');

  // agent-inspect style step
  const step = path.join(tmp, 'c.jsonl');
  fs.writeFileSync(step, JSON.stringify({ name: 'read_file', input: 'src/a.js', output: 'print(1)', type: 'tool' }) + '\n');
  turns = parseTranscript(step);
  assert.ok(turns.length >= 1, 'agent-inspect step should yield a turn');

  // plain text
  const pt = path.join(tmp, 'd.txt');
  fs.writeFileSync(pt, 'first block.\n\nsecond block.');
  turns = parseTranscript(pt);
  assert.ok(turns.length >= 1, 'plain text should yield a turn');

  console.log('parser tests passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}