'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use temp DB path
process.env.SENTINEL_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-fixtures-')), 'test.db');

const { importTranscript } = require('../src/import');
const { gateResult } = require('../src/metrics');

const FIX = path.join(__dirname, '..', 'fixtures');

function main() {
  // Good transcript -> gate pass (exit 0 equivalent)
  const good = importTranscript(path.join(FIX, 'good-transcript.jsonl'), { gateThreshold: 60 });
  assert.ok(good.turns.length >= 3, 'good fixture should have turns');
  const goodGate = gateResult(good.aggregate, good.turns, 60);
  assert.ok(goodGate.pass, `good transcript should pass gate, mean slop=${good.aggregate.mean_slop}`);

  // Slop transcript -> gate fail (exit non-zero equivalent)
  const slop = importTranscript(path.join(FIX, 'slop-transcript.jsonl'), { gateThreshold: 60 });
  assert.ok(slop.turns.length >= 3, 'slop fixture should have turns');
  const slopGate = gateResult(slop.aggregate, slop.turns, 60);
  assert.ok(!slopGate.pass, `slop transcript should fail gate, mean slop=${slop.aggregate.mean_slop}`);
  assert.ok(slopGate.breaches.length >= 1, 'should record at least one breach');

  // Per-turn breakdown present
  for (const t of slop.turns) {
    assert.ok(typeof t.metrics.slop_score === 'number', 'each turn should have slop_score');
    assert.ok(typeof t.metrics.verbosity_ratio === 'number', 'each turn should have verbosity_ratio');
  }

  console.log(`fixture acceptance tests passed. good mean slop=${good.aggregate.mean_slop}, slop mean slop=${slop.aggregate.mean_slop}`);
}

main();