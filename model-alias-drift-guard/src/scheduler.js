'use strict';

// Minimal 5-field cron parser: minute hour dom month dow
// Supports: * , - / and lists.

function parseField(field, min, max) {
  const out = new Set();
  for (const part of String(field).split(',')) {
    const stepMatch = part.split('/');
    const base = stepMatch[0];
    const step = stepMatch[1] ? parseInt(stepMatch[1], 10) : 1;
    let start, end;
    if (base === '*') { start = min; end = max; }
    else if (base.includes('-')) {
      const [a,b] = base.split('-').map(x=>parseInt(x,10));
      start = a; end = b;
    } else {
      start = parseInt(base, 10); end = start;
    }
    if (isNaN(start) || isNaN(end)) throw new Error(`invalid cron field: ${field}`);
    for (let v = start; v <= end; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

function parseCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron must have 5 fields: ${expr}`);
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dow: parseField(parts[4], 0, 6), // 0=Sun
  };
}

function matches(cron, date) {
  const d = date instanceof Date ? date : new Date(date);
  return cron.minute.has(d.getUTCMinutes())
    && cron.hour.has(d.getUTCHours())
    && cron.dom.has(d.getUTCDate())
    && cron.month.has(d.getUTCMonth() + 1)
    && cron.dow.has(d.getUTCDay());
}

function nextRun(expr, after) {
  const cron = parseCron(expr);
  let t = new Date(after || Date.now());
  t.setUTCSeconds(0, 0);
  t = new Date(t.getTime() + 60000); // next minute boundary
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matches(cron, t)) return t;
    t = new Date(t.getTime() + 60000);
  }
  throw new Error('no next run found within a year');
}

async function runOnce(runFn, options) {
  // runFn returns a run result/promise
  const started = new Date();
  const result = await runFn();
  return { started_at: started.toISOString(), finished_at: new Date().toISOString(), result };
}

function startSchedule(expr, runFn, opts) {
  const options = opts || {};
  let timer = null;
  let running = false;
  let stopped = false;
  const log = options.log || (() => {});
  async function tick() {
    if (stopped) return;
    const now = new Date();
    if (matches(parseCron(expr), now)) {
      if (running) { log('skip: previous run still active'); }
      else {
        running = true;
        try { await runFn({ trigger: 'schedule', at: now.toISOString() }); }
        catch (e) { log(`scheduled run error: ${e && e.message}`); }
        finally { running = false; }
      }
    }
    // align to next minute
    if (!stopped) {
      const ms = 60000 - (Date.now() % 60000) + 50;
      timer = setTimeout(tick, Math.min(ms, 60000));
    }
  }
  // start aligned to minute
  const initial = 60000 - (Date.now() % 60000) + 50;
  timer = setTimeout(tick, Math.min(initial, 60000));
  log(`scheduler started: ${expr}, next ${nextRun(expr).toISOString()}`);
  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    next() { return nextRun(expr).toISOString(); },
  };
}

module.exports = { parseCron, matches, nextRun, runOnce, startSchedule };