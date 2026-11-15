'use strict';

// --- state.js: local monthly budget state store (offline, no network) ---

const fs = require('node:fs');
const path = require('node:path');

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function statePath(dir) {
  return path.join(dir, 'state', 'budget.json');
}

function loadState(dir) {
  const p = statePath(dir);
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    // reset month if rolled over
    if (data.month !== currentMonth()) {
      return { month: currentMonth(), spent_usd: 0, cap_usd: null, runs: [] };
    }
    return data;
  } catch (err) {
    return { month: currentMonth(), spent_usd: 0, cap_usd: null, runs: [] };
  }
}

function saveState(dir, state) {
  const p = statePath(dir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}

function setCap(dir, capUsd) {
  const state = loadState(dir);
  state.cap_usd = Number(capUsd);
  return saveState(dir, state);
}

function recordRun(dir, run) {
  const state = loadState(dir);
  state.runs.push(run);
  if (run.committed) {
    state.spent_usd = Number((state.spent_usd || 0) + run.estimated_usd).toFixed(4);
  }
  return saveState(dir, state);
}

module.exports = { loadState, saveState, setCap, recordRun, currentMonth };
