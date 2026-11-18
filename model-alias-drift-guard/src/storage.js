'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getPaths(dataDir) {
  const base = path.resolve(dataDir || path.join(__dirname, '..', 'data'));
  return {
    base,
    runsDir: path.join(base, 'runs'),
    index: path.join(base, 'index.json'),
    alerts: path.join(base, 'alert-state.json'),
  };
}

function ensure(dataDir) {
  const p = getPaths(dataDir);
  fs.mkdirSync(p.runsDir, { recursive: true });
  if (!fs.existsSync(p.index)) fs.writeFileSync(p.index, JSON.stringify({ runs: [] }, null, 2));
  return p;
}

function newRunId() {
  const t = new Date().toISOString().replace(/[:.]/g, '-');
  const r = crypto.randomBytes(3).toString('hex');
  return `${t}-${r}`;
}

function appendRun(run, dataDir) {
  const p = ensure(dataDir);
  const id = run.id || newRunId();
  run.id = id;
  const file = path.join(p.runsDir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(run, null, 2));
  const idx = readJson(p.index, { runs: [] });
  const summary = {
    id,
    alias: run.alias || null,
    at: run.at || run.created_at || new Date().toISOString(),
    pass_count: run.summary ? run.summary.pass_count : 0,
    fail_count: run.summary ? run.summary.fail_count : 0,
    regressed_count: run.summary ? run.summary.regressed_count : 0,
    drift_score: run.summary ? run.summary.avg_drift_score : 0,
    latency_ms: run.summary ? run.summary.avg_latency_ms || 0 : 0,
    cost_usd: run.summary ? run.summary.total_cost_usd || 0 : 0,
    threshold_breached: !!run.threshold_breached,
    alerted: !!run.alerted,
    baseline_id: run.baseline_id || null,
  };
  idx.runs = [summary, ...(idx.runs || []).filter(r => r.id !== id)].slice(0, 5000);
  fs.writeFileSync(p.index, JSON.stringify(idx, null, 2));
  return { id, file, summary };
}

function listRuns(dataDir, limit) {
  const p = getPaths(dataDir);
  const idx = readJson(p.index, { runs: [] });
  const runs = idx.runs || [];
  return typeof limit === 'number' ? runs.slice(0, limit) : runs;
}

function getRun(id, dataDir) {
  const p = getPaths(dataDir);
  const file = path.join(p.runsDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return readJson(file, null);
}

function series(alias, limit, dataDir) {
  let runs = listRuns(dataDir, limit || 500);
  if (alias) runs = runs.filter(r => r.alias === alias);
  // oldest -> newest for chart
  const points = runs.slice().reverse().map(r => ({
    id: r.id,
    at: r.at,
    pass_rate: r.pass_count != null && (r.pass_count + r.fail_count) > 0 ? r.pass_count / (r.pass_count + r.fail_count) : 0,
    regressed_count: r.regressed_count || 0,
    drift_score: r.drift_score || 0,
    threshold_breached: !!r.threshold_breached,
  }));
  return points;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

module.exports = { getPaths, ensure, appendRun, listRuns, getRun, series, readJson, writeJson, newRunId };