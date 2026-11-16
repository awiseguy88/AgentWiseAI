'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');

function loadMock(spec, taskId) {
  const file = spec.slice('mock:'.length);
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const entry = data[taskId] || data[taskId] || null;
  if (!entry) {
    return { output: '', tokens_in: 0, tokens_out: 0, latency_ms: 0, tool_call: null, error: 'no-mock-response' };
  }
  return {
    output: String(entry.output || ''),
    tokens_in: Number(entry.tokens_in || 0),
    tokens_out: Number(entry.tokens_out || 0),
    latency_ms: Number(entry.latency_ms || 0),
    tool_call: entry.tool_call || null,
  };
}

function runCmd(spec, prompt) {
  const cmd = spec.slice('cmd:'.length);
  const start = Date.now();
  const res = spawnSync('sh', ['-c', cmd], { input: prompt, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const latency_ms = Date.now() - start;
  if (res.error) return { output: '', tokens_in: 0, tokens_out: 0, latency_ms, tool_call: null, error: String(res.error.message || res.error) };
  const out = (res.stdout || '').trim();
  try {
    const j = JSON.parse(out);
    return {
      output: String(j.output || ''),
      tokens_in: Number(j.tokens_in || 0),
      tokens_out: Number(j.tokens_out || 0),
      latency_ms: Number(j.latency_ms || latency_ms),
      tool_call: j.tool_call || null,
    };
  } catch {
    const tokens_out = Math.ceil(out.length / 4);
    const tokens_in = Math.ceil(prompt.length / 4);
    return { output: out, tokens_in, tokens_out, latency_ms, tool_call: null };
  }
}

function postJson(urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runOllama(spec, prompt) {
  const rest = spec.slice('ollama:'.length);
  let model = rest; let base = 'http://localhost:11434';
  const at = rest.lastIndexOf('@');
  if (at !== -1) { model = rest.slice(0, at); base = rest.slice(at + 1); }
  const start = Date.now();
  try {
    const resp = await postJson(base.replace(/\/$/, '') + '/api/generate', { model, prompt, stream: false });
    const latency_ms = Date.now() - start;
    const j = JSON.parse(resp.body || '{}');
    return {
      output: String(j.response || ''),
      tokens_in: Number(j.prompt_eval_count || 0),
      tokens_out: Number(j.eval_count || 0),
      latency_ms,
      tool_call: null,
    };
  } catch (e) {
    return { output: '', tokens_in: 0, tokens_out: 0, latency_ms: Date.now() - start, tool_call: null, error: String(e.message || e) };
  }
}

async function runAdapter(spec, prompt, taskId) {
  if (spec.startsWith('mock:')) return loadMock(spec, taskId);
  if (spec.startsWith('cmd:')) return runCmd(spec, prompt);
  if (spec.startsWith('ollama:')) return runOllama(spec, prompt);
  throw new Error(`Unknown adapter spec: ${spec}`);
}

module.exports = { runAdapter };