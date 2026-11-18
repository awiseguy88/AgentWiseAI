'use strict';

const fs = require('fs');
const path = require('path');

const SUCCESS_CLAIM_PATTERNS = [
  /\b(done|fixed|resolved|completed|finished|working now|should work now)\b/i,
  /\btests?\s+(are\s+)?(pass(ed|ing)?|green|succeed(ed)?)\b/i,
  /\b(build|compiled|bundle|built)\s+(pass(ed|ing)?|succeed(ed)?|successful(ly)?)\b/i,
  /\b(successfully\s+)?(built|compiled|deployed|shipped)\b/i,
  /\b(successfully|success|succeeded|succeeds|worked|works|correct|confirmed)\b/i,
];

function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function _first(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function _extractText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(_extractText).join('\n');
  if (_isPlainObject(value)) {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.content)) return value.content.map(_extractText).join('\n');
    return JSON.stringify(value);
  }
  return String(value);
}

function _ts(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return new Date(value).toISOString();
  return String(value);
}

function _safeJSON(line, source, lineNo) {
  try {
    const o = JSON.parse(line);
    if (_isPlainObject(o)) return { ok: true, obj: o };
    return { ok: false, reason: 'not an object' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function _classifyResult(result) {
  if (result == null) return { type: 'empty', summary: 'empty/null result' };
  if (result.isError === true || result.error) {
    const detail = result.error && (result.error.message || String(result.error));
    return {
      type: 'isError',
      summary: `isError: true — ${detail || 'tool reported an error'}`,
      detail,
    };
  }
  const content = result.content;
  const text = _extractText(content);
  if (text === '' && (!Array.isArray(content) || content.length === 0)) {
    return { type: 'empty', summary: 'empty result (no content)' };
  }
  const str = JSON.stringify(result);
  if (/timeout|timed.?out|abort|no response|cancel/i.test(str)) {
    return { type: 'timeout', summary: 'timeout / no response captured' };
  }
  return { type: 'ok', summary: 'ok' };
}

/**
 * Parse a single line. Supports:
 * - plain JSON event object
 * - JSONL wrapper `{"events":[...]}` on one line (rare)
 * - MCP JSON-RPC line with `id`/`method`/`params`/`result`/`error`
 */
function parseLine(line, source, lineNo) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const p = _safeJSON(trimmed, source, lineNo);
  if (!p.ok) return null;
  const o = p.obj;

  // MCP JSON-RPC line: detect by presence of jsonrpc/id/method or direction.
  if (o.jsonrpc || o.method || o.direction === 'request' || o.direction === 'response' || o.request || o.response) {
    if (o.direction === 'request' || (o.method && !o.result && !o.error)) {
      return {
        kind: 'tool_call',
        id: o.id !== undefined ? String(o.id) : undefined,
        toolCallId: o.id !== undefined ? String(o.id) : undefined,
        toolName: _first(o.params, ['name', 'tool', 'tool_name', 'function']) || o.method,
        args: _first(o.params, ['arguments', 'args', 'input']) || o.params || {},
        timestamp: _ts(o.timestamp || o.time),
        raw: o,
        source,
        line: lineNo,
      };
    }
    if (o.direction === 'response' || o.result !== undefined || o.error !== undefined) {
      const result = o.result !== undefined ? o.result : o.error;
      const isError = o.error !== undefined || (o.result && o.result.isError === true);
      return {
        kind: 'tool_result',
        id: o.id !== undefined ? String(o.id) : undefined,
        toolCallId: o.id !== undefined ? String(o.id) : undefined,
        toolName: (o.params && _first(o.params, ['name', 'tool', 'tool_name'])) || undefined,
        result,
        isError,
        error: o.error || (o.result && o.result.error),
        timestamp: _ts(o.timestamp || o.time),
        raw: o,
        source,
        line: lineNo,
        classified: _classifyResult(result),
      };
    }
  }

  const type = o.type || o.event || o.kind;

  // MCP assistant/user message lines (direction-based, no type field).
  if (o.direction === 'assistant' || o.direction === 'user') {
    const content = _extractText(_first(o, ['content', 'text', 'message', 'body']) || '');
    return {
      kind: 'message',
      role: o.direction,
      text: content,
      timestamp: _ts(o.timestamp || o.time),
      source,
      line: lineNo,
      raw: o,
    };
  }

  // Generic message / assistant content line.
  if (type === 'message' || type === 'assistant_message' || type === 'user_message' || o.role === 'assistant' || o.role === 'user') {
    const content = _extractText(_first(o, ['content', 'text', 'message', 'body']) || '');
    return {
      kind: 'message',
      role: o.role || type === 'user_message' ? 'user' : type === 'assistant_message' ? 'assistant' : undefined,
      text: content,
      timestamp: _ts(o.timestamp || o.time),
      source,
      line: lineNo,
      raw: o,
    };
  }

  // Explicit tool result lines first (agent-inspect style), so a line carrying
  // isError/error is classified as a result even if it also carries a tool name.
  if (type === 'tool_result' || type === 'tool-result' || o.tool_result || o.result !== undefined || o.isError === true || o.error !== undefined) {
    const result = o.result !== undefined ? o.result : o;
    const isError = o.isError === true || o.error !== undefined || (result && result.isError === true);
    return {
      kind: 'tool_result',
      id: _first(o, ['tool_call_id', 'toolCallId', 'call_id', 'id']) || undefined,
      toolCallId: _first(o, ['tool_call_id', 'toolCallId', 'call_id', 'id']) || undefined,
      toolName: _first(o, ['name', 'tool_name', 'toolName', 'tool']) || undefined,
      result,
      isError,
      error: o.error || result.error,
      timestamp: _ts(o.timestamp || o.time),
      source,
      line: lineNo,
      raw: o,
      classified: _classifyResult(result),
    };
  }

  // Explicit tool call lines.
  if (type === 'tool_call' || type === 'tool-call' || o.tool_name || o.name || o.toolCallId || o.tool_call_id) {
    const name = _first(o, ['name', 'tool_name', 'toolName', 'tool']) || undefined;
    return {
      kind: 'tool_call',
      id: _first(o, ['tool_call_id', 'toolCallId', 'call_id', 'id']) || undefined,
      toolCallId: _first(o, ['tool_call_id', 'toolCallId', 'call_id', 'id']) || undefined,
      toolName: name,
      args: _first(o, ['arguments', 'args', 'input', 'parameters']) || {},
      timestamp: _ts(o.timestamp || o.time),
      source,
      line: lineNo,
      raw: o,
    };
  }

  // Unknown object: keep as generic event so nothing is silently dropped.
  return {
    kind: 'event',
    type,
    text: _extractText(_first(o, ['content', 'text', 'message']) || ''),
    timestamp: _ts(o.timestamp || o.time),
    source,
    line: lineNo,
    raw: o,
  };
}

/**
 * Parse agent-inspect JSONL. Returns normalized events array.
 */
function parseJSONL(text, source) {
  const events = [];
  const lines = text.split(/\r?\n/);
  let lineNo = 0;
  for (const line of lines) {
    lineNo++;
    const ev = parseLine(line, source, lineNo);
    if (ev) events.push(ev);
  }
  return events;
}

/**
 * Parse MCP capture JSON (array of request/response pairs, or object with `events`/`calls`).
 */
function parseMCPJSON(obj, source) {
  const events = [];
  const arr = Array.isArray(obj) ? obj : obj.events || obj.calls || obj.entries || [];
  let lineNo = 0;
  for (const item of arr) {
    lineNo++;
    const ev = parseLine(JSON.stringify(item), source, lineNo);
    if (ev) events.push(ev);
  }
  return events;
}

/**
 * Detect format and parse.
 * Supported: agent-inspect JSONL, MCP capture JSON, already-normalized trace JSON.
 */
function parseTrace(inputPath) {
  const source = path.resolve(inputPath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Trace file not found: ${source}`);
  }
  const text = fs.readFileSync(source, 'utf8');

  const trimmed = text.trim();
  let events = [];

  // Try whole-file JSON first (MCP capture / normalized trace).
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (Array.isArray(obj)) {
        events = parseMCPJSON(obj, source);
        if (events.length > 0) return { events, source, format: 'mcp-capture-json' };
      }
      if (_isPlainObject(obj)) {
        if (obj.events || obj.calls || obj.entries) {
          events = parseMCPJSON(obj.events || obj.calls || obj.entries, source);
          if (events.length > 0) return { events, source, format: 'mcp-capture-json' };
        }
        // Single event object
        const ev = parseLine(JSON.stringify(obj), source, 1);
        if (ev) return { events: [ev], source, format: 'normalized-json' };
      }
    } catch (_) { /* not whole-file JSON; fall through to JSONL */ }
  }

  // Try JSONL (agent-inspect traces are line-oriented).
  const lines = trimmed.split(/\r?\n/);
  let nonBlank = 0;
  let parsedAny = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    nonBlank++;
    try {
      const o = JSON.parse(line.trim());
      if (_isPlainObject(o)) parsedAny = true;
    } catch (_) { /* not JSONL */ }
  }
  if (nonBlank > 0 && parsedAny) {
    events = parseJSONL(text, source);
    if (events.length > 0) return { events, source, format: 'agent-inspect-jsonl' };
  }

  // Fallback: whole-file JSON (already attempted above, retry for safety).
  try {
    const obj = JSON.parse(trimmed);
    if (Array.isArray(obj)) {
      events = parseMCPJSON(obj, source);
      return { events, source, format: 'mcp-capture-json' };
    }
    if (_isPlainObject(obj)) {
      if (obj.events || obj.calls || obj.entries || obj.requests || obj.responses) {
        events = parseMCPJSON(obj, source);
        return { events, source, format: 'mcp-capture-json' };
      }
      if (obj.trace || obj.normalized || obj.events === undefined && obj.calls === undefined) {
        // Assume already-normalized trace with `events` key or generic object.
        if (Array.isArray(obj.events)) {
          return { events: obj.events.map((e, i) => ({ ...e, line: i + 1, source })), source, format: 'normalized-json' };
        }
        events = parseMCPJSON([obj], source);
        return { events, source, format: 'normalized-json' };
      }
    }
  } catch (_) { /* not JSON */ }

  return { events, source, format: 'unknown' };
}

module.exports = {
  parseTrace,
  parseJSONL,
  parseLine,
  parseMCPJSON,
  _classifyResult,
  SUCCESS_CLAIM_PATTERNS,
  _extractText,
};