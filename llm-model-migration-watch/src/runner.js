'use strict';

const { runAdapter } = require('./adapters');

function normalizeOutput(s) { return String(s || '').toLowerCase(); }

function checkResult(task, output, toolCall) {
  const checker = task.checker || {};
  const out = normalizeOutput(output);
  const raw = String(output || '');
  const not = checker.notContains || [];
  for (const bad of not) {
    if (out.includes(String(bad).toLowerCase())) return { pass: false, reason: `contains forbidden "${bad}"` };
  }
  const contains = checker.contains || [];
  if (contains.length) {
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
  // tool-call accuracy check
  if (checker.tool) {
    const actual = toolCall || '';
    const expected = String(checker.tool);
    const ok = String(actual).toLowerCase().includes(expected.toLowerCase());
    if (!ok) return { pass: false, reason: `tool mismatch: expected "${expected}", got "${actual || '(none)'}"` };
  }
  if (checker.toolNot) {
    const actual = toolCall || '';
    if (String(actual).toLowerCase().includes(String(checker.toolNot).toLowerCase())) {
      return { pass: false, reason: `forbidden tool called: "${checker.toolNot}"` };
    }
  }
  if (!contains.length && !containsAll.length && !containsAny.length && !checker.tool && !checker.toolNot) {
    return { pass: raw.trim().length > 0, reason: raw.trim().length > 0 ? 'non-empty' : 'empty output' };
  }
  return { pass: true, reason: 'checks passed' };
}

async function runTask(task, adapterSpec) {
  const res = await runAdapter(adapterSpec, task.prompt, task.id);
  const verdict = res.error ? { pass: false, reason: 'adapter error: ' + res.error } : checkResult(task, res.output, res.tool_call);
  return {
    taskId: task.id,
    title: task.title,
    type: task.type,
    output: res.output,
    tokens_in: res.tokens_in,
    tokens_out: res.tokens_out,
    latency_ms: res.latency_ms,
    tool_call: res.tool_call || null,
    pass: verdict.pass,
    reason: verdict.reason,
    error: res.error || null,
  };
}

module.exports = { runTask, checkResult };