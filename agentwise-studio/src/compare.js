'use strict';

const { getRun } = require('./db');

function keyForClaim(c) {
  return `${c.claimType}|${c.claimText.slice(0, 80)}|${c.turnIndex}`;
}

function keyForAlert(a) {
  return `${a.type}|${a.message.slice(0, 80)}`;
}

function keyForStep(s) {
  return `${s.name}|${s.type}|${s.span}`;
}

function diffArrays(a, b, keyFn) {
  const aMap = new Map(a.map(x => [keyFn(x), x]));
  const bMap = new Map(b.map(x => [keyFn(x), x]));
  const removed = [];
  const added = [];
  const changed = [];
  for (const [k, x] of aMap) {
    if (!bMap.has(k)) removed.push(x);
  }
  for (const [k, x] of bMap) {
    if (!aMap.has(k)) added.push(x);
  }
  for (const [k, x] of bMap) {
    if (aMap.has(k) && JSON.stringify(x) !== JSON.stringify(aMap.get(k))) {
      changed.push({ before: aMap.get(k), after: x });
    }
  }
  return { removed, added, changed };
}

function compareRuns(id1, id2) {
  const run1 = getRun(id1);
  const run2 = getRun(id2);
  if (!run1 || !run2) throw new Error('run not found');

  const claims1 = run1.claims || [];
  const claims2 = run2.claims || [];
  const claimDiff = diffArrays(claims1, claims2, keyForClaim);

  const alerts1 = run1.driftAlerts || [];
  const alerts2 = run2.driftAlerts || [];
  const alertDiff = diffArrays(alerts1, alerts2, keyForAlert);

  const steps1 = run1.driftSteps || [];
  const steps2 = run2.driftSteps || [];
  const stepDiff = diffArrays(steps1, steps2, keyForStep);

  // Metric deltas for common steps
  const steps1Map = new Map(steps1.map(s => [keyForStep(s), s]));
  const stepDeltas = [];
  for (const s2 of steps2) {
    const s1 = steps1Map.get(keyForStep(s2));
    if (s1) {
      const deltaDuration = s2.duration_ms != null && s1.duration_ms != null ? s2.duration_ms - s1.duration_ms : null;
      const deltaTokens = s2.total_tokens != null && s1.total_tokens != null ? s2.total_tokens - s1.total_tokens : null;
      if (deltaDuration !== null || deltaTokens !== null) {
        stepDeltas.push({
          key: keyForStep(s2),
          name: s2.name,
          type: s2.type,
          span: s2.span,
          deltaDurationMs: deltaDuration,
          deltaTotalTokens: deltaTokens,
          before: { duration_ms: s1.duration_ms, total_tokens: s1.total_tokens },
          after: { duration_ms: s2.duration_ms, total_tokens: s2.total_tokens }
        });
      }
    }
  }

  return {
    run1Id: run1.id,
    run1Name: run1.name,
    run2Id: run2.id,
    run2Name: run2.name,
    summary1: run1.summary,
    summary2: run2.summary,
    claims: claimDiff,
    alerts: alertDiff,
    steps: stepDiff,
    stepDeltas
  };
}

module.exports = { compareRuns };