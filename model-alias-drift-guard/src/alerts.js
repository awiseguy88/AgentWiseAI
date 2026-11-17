'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const { getPaths, readJson, writeJson } = require('./storage');

function evaluateAlerts(run, config, dataDir) {
  const channels = (config && config.alerts) || [];
  if (!channels.length) return { alerted: false, results: [], reason: 'no alert channels configured' };
  if (!run.threshold_breached) return { alerted: false, results: [], reason: 'no threshold breach' };
  const state = loadState(dataDir);
  const cooldownMs = (config && config.alert_cooldown_ms) || 0;
  const key = `${run.alias || 'default'}:${run.threshold_reasons ? run.threshold_reasons.join('|') : 'breach'}`;
  const now = Date.now();
  if (cooldownMs > 0 && state[key] && now - state[key] < cooldownMs) {
    return { alerted: false, results: [], reason: 'cooldown' };
  }
  const message = formatMessage(run);
  const results = channels.map(ch => dispatch(ch, message, run));
  state[key] = now;
  saveState(state, dataDir);
  return { alerted: results.some(r => r.ok), results };
}

function formatMessage(run) {
  const reasons = (run.threshold_reasons || []).join('; ') || 'threshold breached';
  return {
    text: `[drift-guard] alias=${run.alias || 'unknown'} breached: ${reasons} (run ${run.id}, regressed=${run.summary && run.summary.regressed_count}, pass_rate=${run.summary ? (run.summary.pass_rate*100).toFixed(1) : 'n/a'}%)`,
    alias: run.alias,
    run_id: run.id,
    at: run.at,
    breached: true,
    reasons: run.threshold_reasons || [],
    summary: run.summary || {},
  };
}

function dispatch(channel, message, run) {
  try {
    if (channel.type === 'webhook' || channel.type === 'slack') {
      return sendWebhook(channel.target || channel.url, message);
    }
    if (channel.type === 'email') {
      return sendEmail(channel.target, message);
    }
    if (channel.type === 'cmd' || channel.type === 'command') {
      return sendCmd(channel.target || channel.command, message);
    }
    if (channel.type === 'file') {
      // for tests: append JSON line
      const p = path.resolve(channel.target);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.appendFileSync(p, JSON.stringify({ at: new Date().toISOString(), message }) + '\n');
      return { ok: true, type: 'file', target: p };
    }
    return { ok: false, type: channel.type, error: 'unknown channel type' };
  } catch (e) {
    return { ok: false, type: channel.type, error: e && e.message };
  }
}

function sendWebhook(url, message) {
  const u = new URL(url);
  const body = JSON.stringify(message);
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, type: 'webhook' }));
    });
    req.on('error', err => resolve({ ok: false, error: err.message, type: 'webhook' }));
    req.write(body); req.end();
  });
}

function sendEmail(target, message) {
  const r = spawnSync('sendmail', [target], { input: `Subject: Drift alert ${message.alias}\n\n${message.text}\n`, encoding: 'utf8' });
  return { ok: r.status === 0, type: 'email', target, error: r.error && r.error.message };
}

function sendCmd(cmd, message) {
  const r = spawnSync('sh', ['-c', cmd], { input: JSON.stringify(message), encoding: 'utf8' });
  return { ok: r.status === 0, type: 'cmd', target: cmd, error: r.error && r.error.message };
}

function loadState(dataDir) {
  const p = getPaths(dataDir);
  return readJson(p.alerts, {});
}
function saveState(state, dataDir) {
  const p = getPaths(dataDir);
  writeJson(p.alerts, state);
}

async function dispatchResults(results) {
  // normalize promises
  return Promise.all(results.map(r => Promise.resolve(r)));
}

module.exports = { evaluateAlerts, formatMessage, dispatch, dispatchResults };