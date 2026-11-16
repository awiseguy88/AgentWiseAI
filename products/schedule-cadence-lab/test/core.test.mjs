import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCron,
  describeCron,
  nextRuns,
  isEvery,
  EXAMPLES,
  REFERENCE,
  TIPS,
} from '../dist-core/index.js';

function runTests() {
  // --- Parser tests ---

  // A1: * * * * * → description contains "every minute"
  {
    const r = parseCron('* * * * *');
    assert.equal(r.ok, true);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.includes('every minute'), `A1: ${d.description}`);
  }

  // A2: 0 2 * * * → description conveys "at 02:00 every day"
  {
    const r = parseCron('0 2 * * *');
    assert.equal(r.ok, true);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.toLowerCase().includes('02:00') && d.description.toLowerCase().includes('day'), `A2: ${d.description}`);
  }

  // A3: */15 * * * * → description conveys "every 15 minutes"
  {
    const r = parseCron('*/15 * * * *');
    assert.equal(r.ok, true);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.toLowerCase().includes('15 minutes'), `A3: ${d.description}`);
  }

  // A4: 0 9 * * 1-5 → description conveys weekdays at 09:00
  {
    const r = parseCron('0 9 * * 1-5');
    assert.equal(r.ok, true);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.toLowerCase().includes('weekday') && d.description.includes('09:00'), `A4: ${d.description}`);
  }

  // A5: bogus → error shown and no run times rendered
  {
    const r = parseCron('bogus');
    assert.equal(r.ok, false);
    assert.ok(r.error.field === 'expression');
  }

  // B1: * * * * *, now=2026-11-16T12:00:30 → first next run = 2026-11-16T12:01:00
  {
    const r = parseCron('* * * * *');
    assert.equal(r.ok, true);
    const now = new Date('2026-11-16T12:00:30');
    const runs = nextRuns(r.parsed, now, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].datetime.getFullYear(), 2026);
    assert.equal(runs[0].datetime.getMonth(), 10); // November
    assert.equal(runs[0].datetime.getDate(), 16);
    assert.equal(runs[0].datetime.getHours(), 12);
    assert.equal(runs[0].datetime.getMinutes(), 1);
  }

  // B2: 0 2 * * *, now=2026-11-16T01:00:00 → first next run = 2026-11-16T02:00:00
  {
    const r = parseCron('0 2 * * *');
    assert.equal(r.ok, true);
    const now = new Date('2026-11-16T01:00:00');
    const runs = nextRuns(r.parsed, now, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].datetime.getFullYear(), 2026);
    assert.equal(runs[0].datetime.getMonth(), 10);
    assert.equal(runs[0].datetime.getDate(), 16);
    assert.equal(runs[0].datetime.getHours(), 2);
    assert.equal(runs[0].datetime.getMinutes(), 0);
  }

  // B3: 0 0 1 * *, now=2026-11-16 → first next run = 2026-12-01T00:00:00
  {
    const r = parseCron('0 0 1 * *');
    assert.equal(r.ok, true);
    const now = new Date('2026-11-16');
    const runs = nextRuns(r.parsed, now, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].datetime.getFullYear(), 2026);
    assert.equal(runs[0].datetime.getMonth(), 11); // December
    assert.equal(runs[0].datetime.getDate(), 1);
    assert.equal(runs[0].datetime.getHours(), 0);
    assert.equal(runs[0].datetime.getMinutes(), 0);
  }

  // B4: 0 0 29 2 *, now=2026-03-01 → first next run = 2028-02-29T00:00:00
  {
    const r = parseCron('0 0 29 2 *');
    assert.equal(r.ok, true);
    const now = new Date('2026-03-01');
    const runs = nextRuns(r.parsed, now, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].datetime.getFullYear(), 2028);
    assert.equal(runs[0].datetime.getMonth(), 1); // February
    assert.equal(runs[0].datetime.getDate(), 29);
    assert.equal(runs[0].datetime.getHours(), 0);
    assert.equal(runs[0].datetime.getMinutes(), 0);
  }

  // B5: Changing N from 5 to 3 yields exactly 3 timestamps in ascending order
  {
    const r = parseCron('0 0 * * *');
    assert.equal(r.ok, true);
    const now = new Date('2026-11-16T00:00:00');
    const runs3 = nextRuns(r.parsed, now, 3);
    assert.equal(runs3.length, 3);
    for (let i = 1; i < runs3.length; i++) {
      assert.ok(runs3[i].datetime > runs3[i - 1].datetime, 'runs not ascending');
    }
  }

  // D1: 60 * * * * → error naming the minute field (out of range)
  {
    const r = parseCron('60 * * * *');
    assert.equal(r.ok, false);
    assert.equal(r.error.field, 'minute');
    assert.ok(r.error.message.toLowerCase().includes('out of range'));
  }

  // D2: 5-1 * * * * → error naming the minute field (reversed range)
  {
    const r = parseCron('5-1 * * * *');
    assert.equal(r.ok, false);
    assert.equal(r.error.field, 'minute');
    assert.ok(r.error.message.toLowerCase().includes('reversed'));
  }

  // D3: */0 * * * * → error naming the minute field (invalid step)
  {
    const r = parseCron('*/0 * * * *');
    assert.equal(r.ok, false);
    assert.equal(r.error.field, 'minute');
    assert.ok(r.error.message.toLowerCase().includes('step'));
  }

  // D4: After fixing the input to a valid expression, the error clears and run times reappear
  {
    const r1 = parseCron('60 * * * *');
    assert.equal(r1.ok, false);
    const r2 = parseCron('0 * * * *');
    assert.equal(r2.ok, true);
    const now = new Date('2026-11-16T00:00:00');
    const runs = nextRuns(r2.parsed, now, 1);
    assert.equal(runs.length, 1);
  }

  // Fixture valid expressions
  const fixtures = [
    '* * * * *',
    '*/5 * * * *',
    '0 * * * *',
    '0 2 * * *',
    '0 9 * * 1-5',
    '0 0 1 * *',
    '0 0 29 2 *',
    '30 4 1,15 * *',
    '0 0 * * 7',
    '15 10 * JAN MON',
  ];
  for (const expr of fixtures) {
    const r = parseCron(expr);
    assert.equal(r.ok, true, `fixture valid: ${expr}`);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.length > 0, `fixture description: ${expr}`);
  }

  // Fixture invalid expressions
  const invalidFixtures = [
    { expr: '60 * * * *', field: 'minute' },
    { expr: '5-1 * * * *', field: 'minute' },
    { expr: '*/0 * * * *', field: 'minute' },
    { expr: '* * * *', field: 'expression' },
    { expr: '* * * * FUNDAY', field: 'dayOfWeek' },
  ];
  for (const f of invalidFixtures) {
    const r = parseCron(f.expr);
    assert.equal(r.ok, false, `fixture invalid should fail: ${f.expr}`);
    assert.equal(r.error.field, f.field, `fixture field: ${f.expr}`);
  }

  // C1: Gallery lists >=12 examples, each with a description
  assert.ok(EXAMPLES.length >= 12, `C1: expected >=12 examples, got ${EXAMPLES.length}`);
  for (const ex of EXAMPLES) {
    assert.ok(ex.expression.length > 0 && ex.title.length > 0 && ex.description.length > 0, `C1 example ${ex.key} has content`);
    const r = parseCron(ex.expression);
    assert.equal(r.ok, true, `C3 example loads valid: ${ex.expression}`);
    const d = describeCron(r.parsed);
    assert.ok(d.ok && d.description.length > 0, `C3 example description: ${ex.expression}`);
  }

  // C2: Clicking "every 5 minutes" populates */5 * * * * and refreshes
  // (data-level test: example exists with correct expression)
  const ex5 = EXAMPLES.find(e => e.key === 'every-5-minutes');
  assert.ok(ex5, 'C2: every-5-minutes example exists');
  assert.equal(ex5.expression, '*/5 * * * *', 'C2: every-5-minutes expression');

  // Reference and tips present
  assert.ok(REFERENCE.title && REFERENCE.fields.length === 5, 'Reference structure');
  assert.ok(TIPS.length >= 4, `TIPS length >=4, got ${TIPS.length}`);

  console.log('All acceptance tests passed.');
}

runTests();