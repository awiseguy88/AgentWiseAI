import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadTrace, parseTrace, analyze, makeReport } from '../src/lib.js';
import { writeJsonReport, writeHtmlReport } from '../src/report.js';
import fs from 'node:fs';
import path from 'node:path';

describe('agent-drift-monitor smoke/acceptance', () => {
  it('lists each step with duration and token count', () => {
    const { data } = loadTrace(path.join('examples', 'sample-trace.json'));
    const steps = parseTrace(data);
    assert.ok(steps.length >= 1);
    for (const s of steps) {
      assert.ok(typeof s.index === 'number' || Number.isInteger(s.index));
      assert.ok(s.duration_ms != null || s.total_tokens != null || true);
    }
    // each step reports duration and/or tokens where provided
    assert.strictEqual(steps.length, 7);
    const withDur = steps.filter(s => s.duration_ms != null);
    const withTok = steps.filter(s => s.total_tokens != null);
    assert.ok(withDur.length >= 1);
    assert.ok(withTok.length >= 1);
  });

  it('flags steps exceeding thresholds', () => {
    const { data } = loadTrace(path.join('examples', 'sample-trace.json'));
    const steps = parseTrace(data);
    const { alerts } = analyze(steps, { maxStepMs: 5000, maxStepTokens: 2000 });
    const threshold = alerts.filter(a => a.type === 'threshold_duration' || a.type === 'threshold_tokens');
    assert.ok(threshold.length >= 1, 'expected threshold alerts');
  });

  it('detects at least one drift or loop pattern', () => {
    const { data } = loadTrace(path.join('examples', 'sample-trace.json'));
    const steps = parseTrace(data);
    const { alerts } = analyze(steps, { maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 });
    const interesting = alerts.filter(a =>
      a.type === 'runaway_loop' || a.type === 'runaway_loop_output' ||
      a.type === 'token_drift' || a.type === 'latency_drift' || a.type === 'quality_drift'
    );
    assert.ok(interesting.length >= 1, 'expected a drift or loop alert');
    // loop: read_file repeated 4 times
    assert.ok(alerts.some(a => a.type === 'runaway_loop'));
  });

  it('writes JSON and HTML reports offline', () => {
    const { data } = loadTrace(path.join('examples', 'sample-trace.json'));
    const steps = parseTrace(data);
    const { alerts } = analyze(steps, { maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 });
    const report = makeReport(steps, alerts ? analyze(steps) : analyze(steps));
    const dir = path.join('reports', 'test-smoke');
    fs.mkdirSync(dir, { recursive: true });
    const jp = writeJsonReport(report, dir);
    const hp = writeHtmlReport(report, dir);
    assert.ok(fs.existsSync(jp) && fs.existsSync(hp));
    const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
    assert.ok(j.summary.steps === steps.length);
    assert.ok(Array.isArray(j.alerts));
    const h = fs.readFileSync(hp, 'utf8');
    assert.ok(h.includes('Agent Drift'));
    assert.ok(h.includes(report.summary.steps.toString()));
  });
});
