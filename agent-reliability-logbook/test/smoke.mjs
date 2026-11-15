import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSummary, weeklyTrends, parseCSV, toCSV, normalizeRun } from '../metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sample = JSON.parse(fs.readFileSync(path.join(root, 'sample-runs.json'), 'utf8')).map(normalizeRun);
const summary = computeSummary(sample);

assert.equal(summary.total, 8, 'total runs');
assert.ok(Math.abs(summary.completionRate - 0.5) < 1e-9, 'completion rate should be 4/8');
assert.ok(Math.abs(summary.interventionRate - 0.5) < 1e-9, 'intervention rate should be 4/8');
assert.ok(summary.recurring.some((r) => r.category === 'parse_error' && r.count === 2), 'parse_error recurring');
assert.ok(summary.avgDuration > 0, 'avg duration');

const trends = weeklyTrends(sample);
assert.ok(trends.length >= 2, 'should produce weekly buckets');
assert.ok(trends.every((t) => t.week && t.total > 0), 'trend entries valid');
assert.ok(trends.every((t) => t.completionRate >= 0 && t.completionRate <= 1), 'trend completion rates');

const csv = fs.readFileSync(path.join(root, 'sample-runs.csv'), 'utf8');
const parsed = parseCSV(csv);
assert.equal(parsed.length, 4, 'csv rows parsed');
assert.equal(parsed[0].task, 'Classify support ticket');
assert.equal(parsed[2].humanOverride, true);
assert.equal(parsed[3].errorType, 'timeout');

const roundTrip = parseCSV(toCSV(parsed));
assert.equal(roundTrip.length, parsed.length, 'csv round trip count');
assert.equal(roundTrip[1].notes, 'Needed one retry for tone');

console.log('Smoke check passed:', {
  total: summary.total,
  completionRate: summary.completionRate,
  interventionRate: summary.interventionRate,
  trendWeeks: trends.length,
});
