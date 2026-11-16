'use strict';

/**
 * Compute per-turn quality metrics and a slop score.
 * Metrics: verbosity_ratio, redundancy (4-gram), step_signature_repetition,
 *          claim_density, code_yield.
 */

const CLAIM_PATTERNS = [
  /\b(done|completed|finished|fixed|resolved)\b/i,
  /\b(tests?\s+(pass(ed|ing)?|all\s+pass|green))\b/i,
  /\b(build\s+(succeed(ed|s)?|pass(ed)?|ok|green))\b/i,
  /\b(verified|validated|confirmed)\b/i,
  /\b(works?\s+(as\s+expected|correctly|now))\b/i,
  /\b(implemented|added|created|updated|merged)\b/i,
  /\b(success(ful(ly)?)?)\b/i
];

function computeMetrics(turn, runContext = {}) {
  const text = String(turn.text || '');
  const totalChars = text.length;
  let codeBlocks = turn.codeBlocks;
  if (!Array.isArray(codeBlocks) || codeBlocks.length === 0) {
    const re = /```[\w-]*\n([\s\S]*?)```/g;
    codeBlocks = [];
    let m;
    while ((m = re.exec(text)) !== null) codeBlocks.push(m[1]);
  }
  const codeChars = (codeBlocks || []).reduce((s, b) => s + b.length, 0);
  const proseChars = Math.max(0, totalChars - codeChars);

  const verbosity_ratio = totalChars === 0 ? 0 : clamp(proseChars / totalChars, 0, 1);
  const code_yield = totalChars === 0 ? 0 : clamp(codeChars / totalChars, 0, 1);
  const redundancy = ngramRedundancy(text, 4);
  const claim_density = claimDensity(text); // claims per 1000 chars
  const step_signature_repetition = stepSignatureRepetition(turn, runContext);

  const slop = slopScore({ verbosity_ratio, redundancy, step_signature_repetition, claim_density, code_yield });

  return {
    verbosity_ratio: round4(verbosity_ratio),
    redundancy: round4(redundancy),
    step_signature_repetition: round4(step_signature_repetition),
    claim_density: round4(claim_density),
    code_yield: round4(code_yield),
    slop_score: round2(slop),
    total_chars: totalChars,
    code_chars: codeChars,
    prose_chars: proseChars,
    claims: countClaims(text)
  };
}

function ngramRedundancy(text, n = 4) {
  const tokens = tokenize(text);
  if (tokens.length < n) return 0;
  const grams = new Map();
  let total = 0;
  for (let i = 0; i <= tokens.length - n; i++) {
    const g = tokens.slice(i, i + n).join(' ');
    grams.set(g, (grams.get(g) || 0) + 1);
    total++;
  }
  if (total === 0) return 0;
  const unique = grams.size;
  return clamp(1 - unique / total, 0, 1);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function countClaims(text) {
  if (!text) return 0;
  let count = 0;
  // Count sentence-like segments that match any claim pattern
  const segments = String(text).split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (CLAIM_PATTERNS.some(p => p.test(seg))) count++;
  }
  return count;
}

function claimDensity(text) {
  const chars = String(text || '').length;
  if (chars === 0) return 0;
  const claims = countClaims(text);
  return (claims / chars) * 1000;
}

function stepSignatureRepetition(turn, runContext) {
  // runContext.seenSignatures: Set of signatures seen before this turn
  // runContext.totalTurnsSoFar: count
  const sig = turn.step_signature || '';
  if (!sig || sig.length < 10) return 0;
  const seen = runContext.seenSignatures;
  if (!seen) return 0;
  return seen.has(sig) ? 1 : 0;
}

function slopScore(m) {
  const claimNorm = 1 - clamp(m.claim_density / 2, 0, 1); // 2 claims/1k chars = healthy
  const score =
    0.25 * m.verbosity_ratio +
    0.25 * m.redundancy +
    0.20 * m.step_signature_repetition +
    0.15 * claimNorm +
    0.15 * (1 - m.code_yield);
  return clamp(score * 100, 0, 100);
}

function computeRunMetrics(turns) {
  const seen = new Set();
  const perTurn = [];
  for (const turn of turns) {
    const metrics = computeMetrics(turn, { seenSignatures: new Set(seen) });
    perTurn.push({ ...turn, metrics });
    if (turn.step_signature) seen.add(turn.step_signature);
  }
  // recompute step_signature_repetition properly with prior-seen context
  const seen2 = new Set();
  for (let i = 0; i < perTurn.length; i++) {
    const t = perTurn[i];
    const isRepeat = seen2.has(t.step_signature) ? 1 : 0;
    if (t.step_signature) seen2.add(t.step_signature);
    if (isRepeat !== t.metrics.step_signature_repetition) {
      t.metrics.step_signature_repetition = isRepeat;
      t.metrics.slop_score = round2(slopScore(t.metrics));
    }
  }

  const scores = perTurn.map(t => t.metrics.slop_score);
  const aggregate = {
    turn_count: perTurn.length,
    mean_slop: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    max_slop: scores.length ? round2(Math.max(...scores)) : 0,
    min_slop: scores.length ? round2(Math.min(...scores)) : 0,
    mean_redundancy: mean(perTurn.map(t => t.metrics.redundancy)),
    mean_verbosity: mean(perTurn.map(t => t.metrics.verbosity_ratio)),
    mean_claim_density: mean(perTurn.map(t => t.metrics.claim_density)),
    mean_code_yield: mean(perTurn.map(t => t.metrics.code_yield)),
    repeated_turns: perTurn.filter(t => t.metrics.step_signature_repetition === 1).length
  };
  return { perTurn, aggregate };
}

function gateResult(aggregate, perTurn, threshold = 60) {
  const breaches = [];
  if (aggregate.mean_slop > threshold) {
    breaches.push({ type: 'aggregate', score: aggregate.mean_slop, threshold });
  }
  for (const t of perTurn) {
    if (t.metrics.slop_score > threshold) {
      breaches.push({ type: 'turn', turn_index: t.index, score: t.metrics.slop_score, threshold });
    }
  }
  return { pass: breaches.length === 0, threshold, breaches, aggregate_slop: aggregate.mean_slop };
}

function mean(arr) {
  if (!arr.length) return 0;
  return round4(arr.reduce((a, b) => a + b, 0) / arr.length);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }

module.exports = { computeMetrics, computeRunMetrics, gateResult, ngramRedundancy, countClaims, claimDensity, slopScore, CLAIM_PATTERNS };
