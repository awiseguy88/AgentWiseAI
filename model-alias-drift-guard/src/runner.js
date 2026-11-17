'use strict';

const { invoke } = require('./adapters');
const crypto = require('crypto');

// Per-task checker. expect fields:
//   tool_sequence: string[]          expected tool names in order
//   tool_args: { name: { k: v } }    expected arg values per tool (partial match)
//   enums: { field: string }         expected enum value checks on args
//   output_format: string            'json'|'markdown'|'plain'|null
//   forbid_tools: string[]           tools that must NOT appear
//   contains_all: string[]           substrings all required in output
//   not_contains: string[]           substrings that must NOT appear
//   refusal_expected: boolean        task expected refusal

const TOOL_RE = /"tool"\s*:\s*"([^"]+)"|"name"\s*:\s*"([^"]+)"|"tool_call"\s*:\s*"([^"]+)"|tool:?\s*["']([^"']+)["']/gi;

function runTask(task, adapterSpec, options) {
  const opts = options || {};
  const started = Date.now();
  const expected = task.expect || {};
  return invoke(adapterSpec, task.prompt, { ...opts, taskId: task.id, task }).then(resp => {
    const latency_ms = resp.latency_ms || Date.now() - started;
    const toolCalls = normalizeToolCalls(resp.tool_calls, resp.output);
    const checks = runChecks(expected, toolCalls, resp.output, latency_ms, resp.tokens_in, resp.tokens_out);
    return {
      task_id: task.id,
      title: task.title,
      source: task.source || 'bundled',
      status: checks.all ? 'pass' : 'fail',
      passed: checks.all,
      drift_score: checks.drift_score,
      checks,
      current: {
        output: resp.output,
        tool_calls: toolCalls,
        tokens_in: resp.tokens_in || 0,
        tokens_out: resp.tokens_out || 0,
        latency_ms,
      },
      cost_usd: estimateCost(resp.tokens_in || 0, resp.tokens_out || 0),
      error: null,
    };
  }).catch(err => ({
    task_id: task.id,
    title: task.title,
    source: task.source || 'bundled',
    status: 'error',
    passed: false,
    drift_score: 0,
    checks: { all: false, details: { error: err && err.message } },
    current: { output: '', tool_calls: [], tokens_in: 0, tokens_out: 0, latency_ms: 0 },
    cost_usd: 0,
    error: err && err.message,
  }));
}

function normalizeToolCalls(arr, output) {
  const calls = [];
  if (Array.isArray(arr)) {
    for (const c of arr) {
      if (typeof c === 'string') calls.push({ name: c, args: {} });
      else if (c && typeof c === 'object') {
        calls.push({ name: c.name || c.tool || c.function && c.function.name || '', args: c.args || c.arguments || c.parameters || {} });
      }
    }
    return calls;
  }
  // parse "tool": "name" hints from output text
  const re = TOOL_RE;
  let m;
  TOOL_RE.lastIndex = 0;
  while ((m = re.exec(output))) {
    const name = m[1] || m[2] || m[3] || m[4];
    if (name) calls.push({ name, args: {} });
  }
  return calls;
}

function runChecks(expected, toolCalls, output, latency_ms, tokens_in, tokens_out) {
  const details = {};
  let score = 0;
  let all = true;

  // 1. tool sequence / presence
  const names = toolCalls.map(c => c.name).filter(Boolean);
  if (expected.tool_sequence) {
    const ok = expected.tool_sequence.join(';') === names.join(';');
    details.tool_sequence = { expected: expected.tool_sequence, actual: names, pass: ok };
    if (!ok) { all = false; score += 0.25; }
  } else if (Array.isArray(expected.tools)) {
    const missing = expected.tools.filter(t => !names.includes(t));
    details.tools_missing = { expected: expected.tools, actual: names, missing, pass: missing.length === 0 };
    if (missing.length) { all = false; score += 0.15; }
  }

  // 2. tool args partial match
  if (expected.tool_args) {
    const argProblems = [];
    for (const [tool, want] of Object.entries(expected.tool_args)) {
      const found = toolCalls.find(c => c.name === tool);
      if (!found) {
        argProblems.push({ tool, missing_tool: true });
        all = false; score += 0.2; continue;
      }
      for (const [k, v] of Object.entries(want)) {
        if (found.args[k] === undefined) {
          argProblems.push({ tool, arg: k, missing: true });
          all = false; score += 0.1; continue;
        }
        if (JSON.stringify(found.args[k]) !== JSON.stringify(v)) {
          argProblems.push({ tool, arg: k, expected: v, actual: found.args[k] });
          all = false; score += 0.1;
        }
      }
    }
    details.tool_args = argProblems.length ? { problems: argProblems, pass: false } : { pass: true };
  }

  // 3. enum values
  if (expected.enums) {
    const enumProblems = [];
    for (const [field, want] of Object.entries(expected.enums)) {
      const actual = toolCalls.flatMap(c => c.args[field] !== undefined ? [c.args[field]] : []).join(',') || '';
      if (String(actual) !== String(want)) {
        enumProblems.push({ field, expected: want, actual });
        all = false; score += 0.1;
      }
    }
    details.enums = enumProblems.length ? { problems: enumProblems, pass: false } : { pass: true };
  }

  // 4. forbid tools
  if (expected.forbid_tools) {
    const used = toolCalls.filter(c => expected.forbid_tools.includes(c.name)).map(c => c.name);
    details.forbid_tools = { expected: expected.forbid_tools, used, pass: used.length === 0 };
    if (used.length) { all = false; score += 0.15; }
  }

  // 5. contains_all / not_contains on output
  if (expected.contains_all) {
    const missing = expected.contains_all.filter(s => !output.includes(s));
    details.contains_all = { missing, pass: missing.length === 0 };
    if (missing.length) { all = false; score += missing.length * 0.05; }
  }
  if (expected.not_contains) {
    const present = expected.not_contains.filter(s => output.includes(s));
    details.not_contains = { present, pass: present.length === 0 };
    if (present.length) { all = false; score += present.length * 0.05; }
  }

  // 6. refusal expected
  if (expected.refusal_expected) {
    const refused = /(refus|cannot|couldn|unable|sorry)/i.test(output) && !/tool|call/i.test(output.slice(0, 200));
    details.refusal_expected = { pass: refused };
    if (!refused) { all = false; score += 0.25; }
  }

  // 7. output format
  if (expected.output_format === 'json') {
    const fmtOk = isJson(output);
    details.output_format = { expected: 'json', pass: fmtOk };
    if (!fmtOk) { all = false; score += 0.1; }
  }

  // clamp score
  if (score > 1) score = 1;
  return { all, score: Math.round(score * 1000) / 1000, drift_score: score, details };
}

function isJson(s) { try { JSON.parse(s); return true; } catch { return false; } }

function estimateCost(tokens_in, tokens_out) {
  // default flat cheap estimate; override via adapter/pricing
  return Math.round(((tokens_in / 1e6) * 3 + (tokens_out / 1e6) * 15) * 1e8) / 1e8;
}

module.exports = { runTask, normalizeToolCalls, runChecks, estimateCost };