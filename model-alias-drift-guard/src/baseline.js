'use strict';

const fs = require('fs');
const path = require('path');

function freezeBaseline(run) {
  // run.results: array of per-task results
  const tasks = {};
  for (const r of run.results || []) {
    tasks[r.task_id] = {
      task_id: r.task_id,
      title: r.title,
      passed: r.passed,
      drift_score: r.drift_score || 0,
      tool_calls: r.current && r.current.tool_calls || [],
      output: r.current && r.current.output || '',
      latency_ms: r.current && r.current.latency_ms || 0,
      tokens_in: r.current && r.current.tokens_in || 0,
      tokens_out: r.current && r.current.tokens_out || 0,
      cost_usd: r.cost_usd || 0,
      checks: r.checks || {},
    };
  }
  return {
    frozen_at: new Date().toISOString(),
    alias: run.alias || null,
    run_id: run.id || null,
    task_count: Object.keys(tasks).length,
    tasks,
  };
}

function saveBaseline(baseline, filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));
  return filePath;
}

function loadBaseline(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function diffTask(baselineTask, current) {
  if (!baselineTask) {
    return { status: 'new', regressed: false, drift_score: 0, changes: [], summary: 'new task (no baseline)' };
  }
  const changes = [];
  const bTools = (baselineTask.tool_calls || []).map(t => t.name).join('>');
  const cTools = ((current.current && current.current.tool_calls) || []).map(t => t.name).join('>');
  if (bTools !== cTools) {
    changes.push({ kind: 'tool_sequence', baseline: bTools, current: cTools });
  }
  // arg diffs
  const bArgs = collectArgs(baselineTask.tool_calls || []);
  const cArgs = collectArgs((current.current && current.current.tool_calls) || []);
  for (const key of Object.keys({ ...bArgs, ...cArgs })) {
    if (JSON.stringify(bArgs[key]) !== JSON.stringify(cArgs[key])) {
      changes.push({ kind: 'tool_arg', arg: key, baseline: bArgs[key], current: cArgs[key] });
    }
  }
  // output diff (short)
  const bOut = (baselineTask.output || '').trim();
  const cOut = ((current.current && current.current.output) || '').trim();
  if (bOut !== cOut && (current.checks && current.checks.details)) {
    // only flag if check-related changes; keep signal useful
  }
  // pass/fail regression
  const regressed = !!(baselineTask.passed && !current.passed);
  const drift_score = current.drift_score || (regressed ? 1 : 0);
  const status = regressed ? 'regressed' : (current.passed ? 'pass' : (baselineTask.passed ? 'fail' : 'still-fail'));
  return {
    status,
    regressed,
    drift_score,
    changes,
    summary: changes.length ? changes.map(c => formatChange(c)).join('; ') : (regressed ? 'task regressed' : 'ok'),
  };
}

function collectArgs(calls) {
  const out = {};
  for (const c of calls || []) {
    for (const [k, v] of Object.entries(c.args || {})) {
      out[`${c.name}.${k}`] = v;
    }
  }
  return out;
}

function formatChange(c) {
  if (c.kind === 'tool_sequence') return `tool sequence: "${c.baseline}" -> "${c.current}"`;
  if (c.kind === 'tool_arg') return `arg ${c.arg}: ${JSON.stringify(c.baseline)} -> ${JSON.stringify(c.current)}`;
  return `${c.kind} changed`;
}

function compareRunToBaseline(run, baseline, thresholds) {
  const thr = thresholds || {};
  const perTask = [];
  let regressed_count = 0;
  let pass_count = 0;
  let fail_count = 0;
  let drift_score_total = 0;
  for (const r of run.results || []) {
    const b = baseline && baseline.tasks && baseline.tasks[r.task_id];
    const d = diffTask(b, r);
    r.diff = d;
    r.baseline = b ? { passed: b.passed, tool_calls: b.tool_calls, output: b.output, latency_ms: b.latency_ms, cost_usd: b.cost_usd } : null;
    r.status = d.status;
    r.regressed = d.regressed;
    if (d.regressed) regressed_count++;
    if (r.passed) pass_count++; else fail_count++;
    drift_score_total += (d.drift_score || 0);
    perTask.push(r);
  }
  const n = perTask.length || 1;
  const pass_rate = pass_count / n;
  const avg_drift = drift_score_total / n;
  const breached = evaluateThresholds({ pass_rate, regressed_count, avg_drift }, thr, baseline);
  return {
    results: perTask,
    summary: { total: perTask.length, pass_count, fail_count, regressed_count, pass_rate, avg_drift_score: avg_drift },
    threshold_breached: breached.breached,
    threshold_reasons: breached.reasons,
  };
}

function evaluateThresholds(summary, thr, baseline) {
  const reasons = [];
  const minPassRate = thr.min_pass_rate != null ? thr.min_pass_rate : 1.0;
  if (summary.pass_rate < minPassRate) reasons.push(`pass rate ${(summary.pass_rate*100).toFixed(1)}% < ${(minPassRate*100).toFixed(1)}%`);
  if (summary.regressed_count > (thr.max_regressed || 0)) reasons.push(`${summary.regressed_count} regressed tasks (max ${thr.max_regressed || 0})`);
  if (thr.max_drift_score != null && summary.avg_drift_score > thr.max_drift_score) reasons.push(`avg drift ${summary.avg_drift_score.toFixed(3)} > ${thr.max_drift_score}`);
  return { breached: reasons.length > 0, reasons };
}

module.exports = { freezeBaseline, saveBaseline, loadBaseline, diffTask, compareRunToBaseline, evaluateThresholds };