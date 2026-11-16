'use strict';

const fs = require('fs');
const path = require('path');

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseTime(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    if (v > 1e12) return v; // ms epoch
    if (v > 1e9) return v * 1000; // s epoch
    return v; // relative ms-ish
  }
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return parseTime(n);
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function durationMs(obj) {
  for (const k of ['duration_ms', 'durationMs', 'latency_ms', 'latencyMs', 'elapsed_ms', 'elapsedMs', 'duration']) {
    const n = toNum(obj[k]);
    if (n != null) {
      if (k === 'duration' && n > 0 && n < 10000 && !('duration_ms' in obj)) return n * 1000; // ambiguous seconds
      return n;
    }
  }
  const start = parseTime(obj.start_time ?? obj.startTime ?? obj.start ?? obj.timestamp ?? obj.ts ?? obj.created_at ?? obj.begin);
  const end = parseTime(obj.end_time ?? obj.endTime ?? obj.end ?? obj.finished_at ?? obj.completed_at);
  if (start != null && end != null && end >= start) return end - start;
  return null;
}

function extractTokens(obj) {
  let prompt = null, completion = null, total = null;
  const u = obj.usage || obj.token_usage || obj.tokens || obj.metrics?.tokens || obj.llm?.usage;
  if (u && typeof u === 'object' && !Array.isArray(u)) {
    prompt = toNum(u.prompt_tokens ?? u.input_tokens ?? u.prompt ?? u.input);
    completion = toNum(u.completion_tokens ?? u.output_tokens ?? u.completion ?? u.output);
    total = toNum(u.total_tokens ?? u.total);
  } else {
    total = toNum(obj.total_tokens ?? obj.token_count ?? obj.tokens ?? obj.tokens_used);
  }
  if (total == null && prompt != null && completion != null) total = prompt + completion;
  if (total == null && (prompt != null || completion != null)) total = (prompt || 0) + (completion || 0);
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

function textOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function stableSig(parts) {
  return parts.map(p => textOf(p).replace(/\s+/g, ' ').trim().slice(0, 200)).join('|');
}

function pickName(obj, idx) {
  return obj.name || obj.tool || obj.tool_name || obj.operation || obj.span_name || obj.type || obj.event || obj.role || `step-${idx + 1}`;
}

function normalizeStep(raw, idx, spanHint) {
  const toolCall = raw.tool_call || raw.function_call;
  const fn = raw.function || toolCall?.function || (raw.tool ? { name: raw.tool, arguments: raw.arguments ?? raw.input } : null);
  const name = pickName({ ...raw, tool: fn?.name, tool_name: fn?.name }, idx);
  const input = raw.input ?? raw.arguments ?? fn?.arguments ?? raw.args ?? raw.prompt ?? raw.request;
  const output = raw.output ?? raw.result ?? raw.response ?? raw.content ?? raw.error;
  const tok = extractTokens(raw);
  const span = raw.span_id ?? raw.spanId ?? raw.span ?? spanHint ?? raw.parent_id ?? raw.trace_id ?? raw.run_id ?? null;
  const quality = toNum(raw.quality ?? raw.score ?? raw.eval_score ?? raw.accuracy ?? (raw.success === true ? 1 : raw.success === false ? 0 : null));
  return {
    index: idx,
    name: String(name),
    type: raw.type || (fn ? 'tool' : raw.role || 'step'),
    span: span == null ? null : String(span),
    duration_ms: durationMs(raw),
    prompt_tokens: tok.prompt_tokens,
    completion_tokens: tok.completion_tokens,
    total_tokens: tok.total_tokens,
    input_preview: textOf(input).slice(0, 300),
    output_preview: textOf(output).slice(0, 300),
    quality,
    signature: stableSig([name, textOf(input)]),
    output_signature: stableSig([name, textOf(output)]),
    raw
  };
}

function extractArray(root) {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];
  for (const k of ['steps', 'events', 'spans', 'trace', 'records', 'runs', 'messages', 'items', 'tool_calls']) {
    if (Array.isArray(root[k])) return root[k];
  }
  if (Array.isArray(root.messages)) return root.messages;
  return [root];
}

function loadTrace(filePath) {
  const rawText = fs.readFileSync(filePath, 'utf8');
  let data;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jsonl') {
    data = rawText.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
  } else {
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      const lines = rawText.split(/\r?\n/).filter(l => l.trim());
      data = lines.map(l => JSON.parse(l));
    }
  }
  return { data, rawText };
}

function parseTrace(data) {
  let items = extractArray(data);
  const flat = [];
  for (const it of items) {
    flat.push(it);
    if (Array.isArray(it?.tool_calls)) {
      for (const tc of it.tool_calls) {
        flat.push({
          type: 'tool',
          name: tc.function?.name || tc.name,
          arguments: tc.function?.arguments ?? tc.arguments,
          tool_call_id: tc.id,
          span: it.span_id || it.id,
          usage: it.usage || it.token_usage,
          start_time: it.start_time || it.timestamp,
          end_time: it.end_time
        });
      }
    }
    if (Array.isArray(it?.spans)) {
      for (const s of it.spans) flat.push(s);
    }
  }
  return flat.map((r, i) => normalizeStep(r, i, r?.span_id || r?.parent_id || null));
}

function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }

function trend(values) {
  const vs = values.filter(v => v != null);
  if (vs.length < 3) return { direction: 'insufficient', delta: 0 };
  const mid = Math.floor(vs.length / 2);
  const a = mean(vs.slice(0, mid));
  const b = mean(vs.slice(mid));
  const delta = (b ?? 0) - (a ?? 0);
  const base = Math.max(Math.abs(a ?? 0), 1);
  const ratio = delta / base;
  let direction = 'flat';
  if (ratio > 0.25) direction = 'up';
  else if (ratio < -0.25) direction = 'down';
  return { direction, delta, ratio, early_avg: a, late_avg: b };
}

function analyze(steps, opts = {}) {
  const maxStepMs = opts.maxStepMs ?? 5000;
  const maxStepTokens = opts.maxStepTokens ?? 2000;
  const loopRepeat = opts.loopRepeat ?? 3;
  const alerts = [];

  for (const s of steps) {
    if (s.duration_ms != null && s.duration_ms > maxStepMs) {
      alerts.push({ type: 'threshold_duration', severity: 'warning', step: s.index, span: s.span, message: `Step "${s.name}" duration ${s.duration_ms}ms exceeds ${maxStepMs}ms`, metric: { duration_ms: s.duration_ms, threshold_ms: maxStepMs } });
    }
    if (s.total_tokens != null && s.total_tokens > maxStepTokens) {
      alerts.push({ type: 'threshold_tokens', severity: 'warning', step: s.index, span: s.span, message: `Step "${s.name}" tokens ${s.total_tokens} exceed ${maxStepTokens}`, metric: { total_tokens: s.total_tokens, threshold_tokens: maxStepTokens } });
    }
  }

  const sigCounts = new Map();
  for (const s of steps) {
    sigCounts.set(s.signature, (sigCounts.get(s.signature) || 0) + 1);
  }
  for (const [sig, count] of sigCounts.entries()) {
    if (count >= loopRepeat) {
      const idxs = steps.filter(s => s.signature === sig).map(s => s.index);
      alerts.push({ type: 'runaway_loop', severity: 'critical', steps: idxs, message: `Repeated step/tool signature occurred ${count} times (possible runaway loop): ${sig.slice(0,120)}`, metric: { repeats: count } });
    }
  }

  const outCounts = new Map();
  for (const s of steps) {
    if (!s.output_preview) continue;
    const k = s.output_signature;
    outCounts.set(k, (outCounts.get(k) || 0) + 1);
  }
  for (const [sig, count] of outCounts.entries()) {
    if (count >= loopRepeat) {
      const idxs = steps.filter(s => s.output_signature === sig && s.output_preview).map(s => s.index);
      alerts.push({ type: 'runaway_loop_output', severity: 'warning', steps: idxs, message: `Identical output signature repeated ${count} times (possible stuck loop).`, metric: { repeats: count } });
    }
  }

  const tokenTrend = trend(steps.map(s => s.total_tokens));
  if (tokenTrend.direction === 'up') {
    alerts.push({ type: 'token_drift', severity: 'warning', message: `Token spend trending up across steps (early avg ${fmt(tokenTrend.early_avg)}, late avg ${fmt(tokenTrend.late_avg)}).`, metric: tokenTrend });
  }
  const durTrend = trend(steps.map(s => s.duration_ms));
  if (durTrend.direction === 'up') {
    alerts.push({ type: 'latency_drift', severity: 'warning', message: `Step latency trending up (early avg ${fmt(durTrend.early_avg)}ms, late avg ${fmt(durTrend.late_avg)}ms).`, metric: durTrend });
  }
  const qTrend = trend(steps.map(s => s.quality));
  if (qTrend.direction === 'down') {
    alerts.push({ type: 'quality_drift', severity: 'critical', message: `Quality/score trending down (early avg ${fmt(qTrend.early_avg)}, late avg ${fmt(qTrend.late_avg)}).`, metric: qTrend });
  }

  const totals = {
    steps: steps.length,
    total_duration_ms: steps.reduce((a,s)=>a + (s.duration_ms || 0), 0),
    steps_with_duration: steps.filter(s=>s.duration_ms!=null).length,
    total_tokens: steps.reduce((a,s)=>a + (s.total_tokens || 0), 0),
    prompt_tokens: steps.reduce((a,s)=>a + (s.prompt_tokens || 0), 0),
    completion_tokens: steps.reduce((a,s)=>a + (s.completion_tokens || 0), 0),
    steps_with_tokens: steps.filter(s=>s.total_tokens!=null).length,
    spans: [...new Set(steps.map(s=>s.span).filter(Boolean))]
  };
  const bySpan = {};
  for (const s of steps) {
    const k = s.span || '(none)';
    bySpan[k] = bySpan[k] || { span: k, steps: 0, total_duration_ms: 0, total_tokens: 0 };
    bySpan[k].steps += 1;
    bySpan[k].total_duration_ms += s.duration_ms || 0;
    bySpan[k].total_tokens += s.total_tokens || 0;
  }
  return { totals, bySpan: Object.values(bySpan), trends: { tokens: tokenTrend, duration_ms: durTrend, quality: qTrend }, alerts };
}

function fmt(v) { return v == null ? 'n/a' : (Math.round(v * 100) / 100); }

function makeReport(steps, analysis, meta = {}) {
  return {
    generated_at: new Date().toISOString(),
    offline: true,
    meta,
    summary: analysis.totals,
    trends: analysis.trends,
    span_breakdown: analysis.bySpan,
    alerts: analysis.alerts,
    steps: steps.map(({ raw, ...s }) => s)
  };
}

module.exports = { loadTrace, parseTrace, analyze, makeReport };
