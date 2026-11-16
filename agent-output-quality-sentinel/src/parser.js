'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse an agent transcript file into a normalized array of turns.
 * Each turn: { index, role, text, codeBlocks, raw, sourceStep? }
 * We treat assistant/agent/model messages and agent-inspect steps as turns.
 */
function parseTranscript(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();
  const trimmed = raw.trim();
  let records;
  let format = 'plain-text';

  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    format = 'json';
    records = Array.isArray(parsed) ? parsed : (parsed.messages || parsed.events || parsed.turns || parsed.steps || parsed.transcript || [parsed]);
  } else if (ext === '.jsonl' || looksLikeJsonl(trimmed)) {
    format = ext === '.jsonl' ? 'jsonl' : 'jsonl-like';
    records = trimmed.split('\n').filter(Boolean).map(l => JSON.parse(l));
  } else {
    format = 'plain-text';
    records = parsePlainText(raw);
  }

  const turns = [];
  for (const rec of records) {
    const t = turnFromRecord(rec);
    if (t) turns.push(t);
  }
  // If nothing was recognized as a turn, treat the whole file as one turn
  if (turns.length === 0 && trimmed) {
    turns.push(makeTurn(0, 'assistant', trimmed, null));
  }
  return turns.map((t, i) => ({ ...t, index: i }));
}

function looksLikeJsonl(s) {
  if (!s) return false;
  const lines = s.split('\n').filter(Boolean);
  if (lines.length === 0) return false;
  let ok = 0;
  for (const l of lines.slice(0, 20)) {
    try { JSON.parse(l); ok++; } catch { /* */ }
  }
  return ok >= Math.max(1, Math.floor(lines.length * 0.6));
}

function parsePlainText(raw) {
  // Split on assistant/agent markers or blank-line blocks
  const blocks = raw.split(/\n{2,}/).filter(b => b.trim());
  return blocks.map(b => ({ role: 'assistant', content: b.trim() }));
}

function turnFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  // agent-inspect style step
  if (rec.name && (rec.input !== undefined || rec.output !== undefined || rec.tool_calls)) {
    const text = [rec.input, rec.output, rec.message, rec.content].filter(v => typeof v === 'string').join('\n\n');
    const name = String(rec.name);
    const stepSig = rec.step_signature || `${name}|${sigFromText(text)}`;
    if (!text.trim() && !name) return null;
    return makeTurn(null, 'assistant', text || name, { name, step_signature: stepSig, type: rec.type || 'step' });
  }
  const role = String(rec.role || rec.type || rec.speaker || '');
  const text = extractText(rec);
  if (!text) return null;
  // Only count assistant/agent/model turns for quality scoring
  if (/assistant|agent|model|bot/i.test(role)) {
    return makeTurn(null, 'assistant', text, { name: rec.name || rec.tool || null });
  }
  // Heuristic: if role is unknown but content looks like agent output with tool_use, treat as turn
  if (!/user|human|system/i.test(role) && (rec.tool_calls || (Array.isArray(rec.content) && rec.content.some(b => b && b.type === 'tool_use')))) {
    return makeTurn(null, 'assistant', text, { name: rec.name || null });
  }
  return null;
}

function extractText(rec) {
  if (typeof rec.text === 'string') return rec.text;
  if (typeof rec.message === 'string') return rec.message;
  if (typeof rec.output_text === 'string') return rec.output_text;
  if (typeof rec.content === 'string') return rec.content;
  if (Array.isArray(rec.content)) {
    return rec.content.map(b => {
      if (typeof b === 'string') return b;
      if (!b || typeof b !== 'object') return '';
      if (b.type === 'text') return b.text || '';
      if (b.type === 'tool_use') return `[tool:${b.name || 'call'}] ${truncate(JSON.stringify(b.input || {}), 200)}`;
      if (b.type === 'tool_result') return `[tool_result] ${truncate(stringify(b.content || b.output || ''), 300)}`;
      return b.text || b.content || '';
    }).filter(Boolean).join('\n');
  }
  if (rec.message && typeof rec.message.content === 'string') return rec.message.content;
  if (rec.message && Array.isArray(rec.message.content)) {
    return rec.message.content.map(b => b.text || b.content || '').filter(Boolean).join('\n');
  }
  if (typeof rec.output === 'string') return rec.output;
  return '';
}

function stringify(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function extractCodeBlocks(text) {
  const blocks = [];
  const re = /```[\w-]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[1]);
  // also count inline code spans as minor code chars? keep simple: fenced blocks only
  return blocks;
}

function makeTurn(index, role, text, extra) {
  const codeBlocks = extractCodeBlocks(text || '');
  return {
    index,
    role: role || 'assistant',
    text: text || '',
    codeBlocks,
    step_signature: extra && extra.step_signature ? extra.step_signature : (extra && extra.name ? `${extra.name}|${sigFromText(text || '')}` : sigFromText(text || '')),
    meta: extra || null
  };
}

function sigFromText(text) {
  // normalized short signature: first 80 chars of alnum+space, lowercased
  const norm = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return norm.slice(0, 80);
}

module.exports = { parseTranscript, extractText, extractCodeBlocks, sigFromText };
