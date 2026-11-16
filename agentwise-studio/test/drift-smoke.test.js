'use strict';

const assert = require('assert');
const path = require('path');

const { loadTrace, parseTrace, analyze, makeReport } = require('../src/drift');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const TRACE = path.join(FIXTURES, 'sample-trace.json');

function main() {
  const { data } = loadTrace(TRACE);
  const steps = parseTrace(data);
  assert.ok(steps.length >= 1, 'expected at least one step');

  const analysis = analyze(steps, { maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 });
  assert.ok(analysis.alerts.length >= 1, 'expected at least one drift/threshold alert');
  const types = new Set(analysis.alerts.map(a => a.type));
  assert.ok(types.has('threshold_duration') || types.has('threshold_tokens') || types.has('runaway_loop') || types.has('token_drift') || types.has('latency_drift') || types.has('quality_drift'), 'expected a recognized drift alert type');

  const report = makeReport(steps, analysis, { source: TRACE });
  assert.strictEqual(report.summary.steps, steps.length, 'report summary steps mismatch');
  assert.ok(Array.isArray(report.alerts), 'report should include alerts array');

  // Repeatability: same input -> same result (deterministic)
  const again = analyze(steps, { maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 });
  assert.deepStrictEqual(again.alerts.map(a => a.type).sort(), analysis.alerts.map(a => a.type).sort(), 'analysis should be deterministic');

  console.log('Drift smoke passed.');
  console.log(`Steps: ${steps.length}, alerts: ${analysis.alerts.length} (${[...types].join(', ')})`);
}

main();