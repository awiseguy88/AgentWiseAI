'use strict';

const { runAdapter } = require('./adapters');

function normalizeOutput(s) {
  return String(s || '').toLowerCase();
}

function checkResult(task, output) {
  const checker = task.checker || {};
  const out = normalizeOutput(output);
  const raw = String(output || '');
  const not = checker.notContains || [];
  for (const bad of not) {
    if (out.includes(String(bad).toLowerCase())) return { pass: false, reason: `contains forbidden "${bad}"` };
  }
  const contains = checker.contains || [];
  if (contains.length) {
    // pass if contains ANY of the acceptable alternatives (each element is a string)
    const ok = contains.some(alt => out.includes(String(alt).toLowerCase()));
    if (!ok) return { pass: false, reason: `missing any of: ${contains.join(', ')}` };
  }
  const containsAll = checker.containsAll || [];
  for (const need of containsAll) {
    if (!out.includes(String(need).toLowerCase())) return { pass: false, reason: `missing "${need}"` };
  }
  const containsAny = checker.containsAny || [];
  if (containsAny.length) {
    const ok = containsAny.some(kw => out.includes(String(kw).toLowerCase()));
    if (!ok) return { pass: false, reason: `missing any keyword: ${containsAny.join(', ')}` };
  }
  // if no positive checks defined, require non-empty output
  if (!contains.length && !containsAll.length && !containsAny.length) {
    return { pass: raw.trim().length > 0, reason: raw.trim().length > 0 ? 'non-empty' : 'empty output' };
  }
  return { pass: true, reason: 'checks passed' };
}

async function runTask(task, adapterSpec) {
  const res = await runAdapter(adapterSpec, task.prompt, task.id);
  const verdict = res.error ? { pass: false, reason: 'adapter error: ' + res.error } : checkResult(task, res.output);
  return Object.assign({ taskId: task.id, title: task.title, type: task.type }, res, { pass: verdict.pass, reason: verdict.reason });
}

module.exports = { runTask, checkResult };
