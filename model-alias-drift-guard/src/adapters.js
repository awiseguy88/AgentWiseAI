'use strict';

// Model invocation adapters. Each returns {output, tool_calls, tokens_in, tokens_out, latency_ms}.

const { execFile } = require('child_process');
const http = require('http');
const https = require('https');

function parse(spec) {
  // mock:<file> | cmd:<shell> | ollama:<model>@<base> | openai:<model>@<base> | anthropic:<model>
  if (spec.startsWith('mock:')) return { type: 'mock', file: spec.slice(5) };
  if (spec.startsWith('cmd:')) return { type: 'cmd', command: spec.slice(4) };
  const o = /^([a-z0-9_.:/-]+)@(https?:\/\/[^\s]+)$/i.exec(spec);
  if (o) return { type: 'openai', model: o[1], base: o[2], provider: 'openai' };
  if (spec.startsWith('anthropic:')) return { type: 'anthropic', model: spec.slice(10) };
  return { type: 'raw', value: spec };
}

async function invoke(spec, prompt, options) {
  const c = parse(spec);
  if (c.type === 'mock') return invokeMock(c, prompt, options);
  if (c.type === 'cmd') return invokeCmd(c, prompt);
  if (c.type === 'ollama') return invokeOllama(c, prompt);
  if (c.type === 'openai') return invokeOpenAi(c, prompt, options);
  if (c.type === 'anthropic') return invokeAnthropic(c, prompt, options);
  return { output: prompt, tokens_in: 0, tokens_out: 0, latency_ms: 0, tool_calls: [] };
}

function invokeMock(c, prompt, options) {
  const fs = require('fs');
  const path = require('path');
  const file = path.resolve(c.file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let entry = null;
  const id = (options && (options.taskId || (options.task && options.task.id))) || null;
  if (data.responses && typeof data.responses === 'object') {
    if (id && data.responses[id]) entry = data.responses[id];
    else if (!id) {
      const key = Object.keys(data.responses)[0];
      if (key) entry = data.responses[key];
    }
  } else if (Array.isArray(data)) {
    entry = data[0];
  }
  if (!entry) {
    // fall back to first response
    if (data.responses && typeof data.responses === 'object') {
      const keys = Object.keys(data.responses);
      if (keys.length) entry = data.responses[keys[0]];
    }
  }
  return {
    output: (entry && entry.output) || '',
    tool_calls: (entry && entry.tool_calls) || [],
    tokens_in: (entry && entry.tokens_in) || 0,
    tokens_out: (entry && entry.tokens_out) || 0,
    latency_ms: (entry && entry.latency_ms) || 0,
  };
}

function invokeCmd(c, prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile(c.command, [], {
      input: prompt,
      maxBuffer: 10 * 1024 * 1024,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`cmd adapter exited ${code}: ${stderr.trim()}`));
      try {
        const j = JSON.parse(stdout.trim());
        resolve({
          output: j.output != null ? String(j.output) : '',
          tool_calls: Array.isArray(j.tool_calls) ? j.tool_calls : [],
          tokens_in: j.tokens_in || 0,
          tokens_out: j.tokens_out || 0,
          latency_ms: j.latency_ms || 0,
        });
      } catch (e) {
        resolve({
          output: stdout.trim(),
          tool_calls: [],
          tokens_in: 0,
          tokens_out: 0,
          latency_ms: 0,
        });
      }
    });
  });
}

function invokeOllama(c, prompt) {
  const url = new URL(c.base + '/api/generate');
  const body = JSON.stringify({ model: c.model, prompt, stream: false, options: { temperature: 0 } });
  return requestJson(url, 'POST', body, { 'Content-Type': 'application/json' }).then(res => ({
    output: res.response || '',
    tool_calls: [],
    tokens_in: res.prompt_eval_count || 0,
    tokens_out: res.eval_count || 0,
    latency_ms: res.eval_duration ? Math.round(res.eval_duration / 1e6) : 0,
  }));
}

function invokeOpenAi(c, prompt, options) {
  const url = new URL(c.base + '/v1/chat/completions');
  const body = JSON.stringify({
    model: c.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options && options.temperature != null ? options.temperature : 0,
  });
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.OPENAI_API_KEY) headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
  return requestJson(url, 'POST', body, headers).then(res => {
    const msg = (res.choices && res.choices[0] && res.choices[0].message) || {};
    return {
      output: msg.content || '',
      tool_calls: msg.tool_calls || [],
      tokens_in: (res.usage && res.usage.prompt_tokens) || 0,
      tokens_out: (res.usage && res.usage.completion_tokens) || 0,
      latency_ms: 0,
    };
  });
}

function invokeAnthropic(c, prompt, options) {
  const url = new URL('https://api.anthropic.com/v1/messages');
  const body = JSON.stringify({
    model: c.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
    temperature: options && options.temperature != null ? options.temperature : 0,
  });
  const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (process.env.ANTHROPIC_API_KEY) headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
  return requestJson(url, 'POST', body, headers).then(res => {
    const text = (res.content || []).map(b => (b.type === 'text' ? b.text : '')).join('\n');
    return {
      output: text,
      tool_calls: [],
      tokens_in: (res.usage && res.usage.input_tokens) || 0,
      tokens_out: (res.usage && res.usage.output_tokens) || 0,
      latency_ms: 0,
    };
  });
}

function requestJson(url, method, body, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, { method, headers }, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('close', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url.href}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { invoke, parse };