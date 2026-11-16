'use strict';

const fs = require('fs');
const path = require('path');

function readTranscript(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();
  let events;
  let format = 'plain-text';
  const trimmed = raw.trim();
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    format = 'json';
    events = normalizeStructured(parsed);
  } else if (ext === '.jsonl' || (trimmed && trimmed.split('\n').every(isJsonLine))) {
    format = ext === '.jsonl' ? 'jsonl' : 'jsonl-like';
    events = normalizeStructured(trimmed.split('\n').filter(Boolean).map(l => JSON.parse(l)));
  } else {
    events = parsePlainText(raw);
  }
  return { events: events.map((e, i) => ({ index: i, ...e })), format, source: abs };
}

function isJsonLine(line) {
  const t = line.trim();
  if (!t) return true;
  try { JSON.parse(t); return true; } catch { return false; }
}

function normalizeStructured(data) {
  const records = Array.isArray(data) ? data : (data.messages || data.events || data.turns || data.transcript || [data]);
  const events = [];
  for (const rec of records) {
    events.push(...eventsFromRecord(rec));
  }
  return events;
}

function eventsFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return [];
  const out = [];
  const role = rec.role || rec.type || rec.speaker || '';
  const text = extractText(rec);
  if (text && (/assistant|agent|model/i.test(String(role)) || rec.role === 'assistant' || (!/user|system|tool/i.test(String(role)) && rec.content && /done|pass|built|fix|succeed/i.test(text)))) {
    out.push({ kind: 'assistant', role: String(role || 'assistant'), text });
  }
  const cmd = extractCommand(rec);
  if (cmd) out.push({ kind: 'command', command: cmd, sourceRole: String(role || '') });
  const res = extractResult(rec);
  if (res) out.push({ kind: 'result', command: res.command || cmd || '', exitCode: res.exitCode, output: res.output || '', status: res.status || '' });
  if (Array.isArray(rec.tool_calls)) {
    for (const tc of rec.tool_calls) {
      const c = tc.function?.arguments || tc.arguments || tc.input || {};
      const cmdStr = typeof c === 'string' ? maybeJsonCmd(c) : (c.command || c.cmd || '');
      if (cmdStr) out.push({ kind: 'command', command: String(cmdStr), sourceRole: 'tool_call' });
    }
  }
  if (Array.isArray(rec.content)) {
    for (const block of rec.content) {
      if (!block || typeof block !== 'object') continue;
      if ((block.type === 'tool_use' || block.type === 'command') && (block.input?.command || block.command)) {
        out.push({ kind: 'command', command: String(block.input?.command || block.command), sourceRole: block.type });
      }
      if (block.type === 'tool_result' || block.type === 'command_result') {
        const ec = parseExitCode(block.content ?? block.output ?? block.text ?? block);
        out.push({ kind: 'result', command: '', exitCode: ec, output: stringifyContent(block.content ?? block.output ?? block.text), status: block.status || '' });
      }
    }
  }
  return dedupeEvents(out);
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter(e => {
    const k = JSON.stringify([e.kind, e.text || '', e.command || '', e.exitCode, e.output || '']);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractText(rec) {
  if (typeof rec.text === 'string') return rec.text;
  if (typeof rec.message === 'string') return rec.message;
  if (typeof rec.output_text === 'string') return rec.output_text;
  if (typeof rec.content === 'string') return rec.content;
  if (Array.isArray(rec.content)) {
    return rec.content.map(b => (typeof b === 'string' ? b : (b && (b.text || b.content || b.output_text)) || '')).filter(Boolean).join('\n');
  }
  if (rec.message && typeof rec.message.content === 'string') return rec.message.content;
  if (rec.message && Array.isArray(rec.message.content)) {
    return rec.message.content.map(b => b.text || b.content || '').filter(Boolean).join('\n');
  }
  return '';
}

function extractCommand(rec) {
  const role = String(rec.role || rec.type || '');
  if (/command|tool_use|function_call|bash|shell/i.test(role)) {
    if (rec.command) return String(rec.command);
    if (rec.input && rec.input.command) return String(rec.input.command);
    if (rec.arguments && rec.arguments.command) return String(rec.arguments.command);
  }
  if (rec.name === 'bash' || rec.tool === 'bash' || rec.tool_name === 'bash') {
    const cmd = rec.input?.command || rec.arguments?.command || rec.command;
    if (cmd) return String(cmd);
  }
  return '';
}

function extractResult(rec) {
  const role = String(rec.role || rec.type || '');
  const blob = stringifyContent(rec);
  const hasExit = rec.exit_code !== undefined || rec.exitCode !== undefined || rec.code !== undefined || /exit code|exit_code|exited with/i.test(blob);
  const isResult = /tool_result|command_result|result|observation|exec/i.test(role) || hasExit;
  if (!isResult) return null;
  let exitCode = rec.exit_code !== undefined ? rec.exit_code : (rec.exitCode !== undefined ? rec.exitCode : (rec.code !== undefined ? rec.code : undefined));
  const output = stringifyContent(rec.output ?? rec.content ?? rec.stdout ?? rec.text ?? rec.result ?? '');
  if (exitCode === undefined) exitCode = parseExitCode(output);
  if (exitCode === undefined && /success|passed|ok/i.test(String(rec.status || ''))) exitCode = 0;
  if (exitCode === undefined && /fail|error/i.test(String(rec.status || ''))) exitCode = 1;
  return { command: rec.command || rec.name || '', exitCode, output, status: rec.status || '' };
}

function parseExitCode(value) {
  const s = stringifyContent(value);
  const patterns = [
    /exit code[:\s]+(-?\d+)/i,
    /exit_code[:\s]+(-?\d+)/i,
    /exited with(?: code)?[:\s]+(-?\d+)/i,
    /\[exit[:\s]+(-?\d+)\]/i,
    /return code[:\s]+(-?\d+)/i
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return Number(m[1]);
  }
  if (/command failed|failed with exit|non-zero/i.test(s)) return 1;
  return undefined;
}

function stringifyContent(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function maybeJsonCmd(s) {
  try { const o = JSON.parse(s); return o.command || o.cmd || ''; } catch { return ''; }
}

function parsePlainText(raw) {
  const lines = raw.split(/\r?\n/);
  const events = [];
  let buf = [];
  const flushAssistant = () => {
    const text = buf.join('\n').trim();
    if (text) events.push({ kind: 'assistant', role: 'assistant', text });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cmdM = line.match(/^(?:\$|>|(?:command|run|shell)\s*[:>])\s*(.+)$/i);
    if (cmdM) { flushAssistant(); events.push({ kind: 'command', command: cmdM[1].trim(), sourceRole: 'plain' }); continue; }
    const exitM = line.match(/(?:exit code|exit_code|exited with(?: code)?|return code)[:\s]+(-?\d+)/i) || line.match(/^\[exit[:\s]+(-?\d+)\]$/i);
    if (exitM) { flushAssistant(); events.push({ kind: 'result', command: '', exitCode: Number(exitM[1]), output: line, status: '' }); continue; }
    const promptRole = line.match(/^(assistant|agent|user|system)\s*:\s*(.*)$/i);
    if (promptRole) {
      flushAssistant();
      if (/assistant|agent/i.test(promptRole[1]) && promptRole[2]) buf.push(promptRole[2]);
      continue;
    }
    buf.push(line);
  }
  flushAssistant();
  return events;
}

module.exports = { readTranscript, normalizeStructured, parsePlainText, parseExitCode };
