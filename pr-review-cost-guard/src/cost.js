'use strict';

// --- cost.js: per-PR cost computation + monthly cap enforcement ---

const pricing = require('./pricing.js');

function costForFile(triagedFile, cfg) {
  let cheapTokens = 0;
  let flaggedTokens = 0;
  let flaggedCount = 0;
  let totalHunks = 0;

  for (const h of triagedFile.hunks) {
    totalHunks += 1;
    const t = pricing.estimateHunkTokens(h, cfg.tokensPerLine);
    cheapTokens += t;
    if (h.triage && h.triage.flagged) {
      flaggedCount += 1;
      flaggedTokens += t;
    }
  }

  const cheapCost = cheapTokens * cfg.cheapInputPrice / 1000;
  // Pricier model: input on flagged hunks + a fixed output estimate per flagged hunk.
  const pricierCost =
    flaggedTokens * cfg.pricierInputPrice / 1000 +
    flaggedCount * cfg.pricierOutputTokens * cfg.pricierOutputPrice / 1000;

  return {
    path: triagedFile.path,
    totalHunks,
    flaggedHunks: flaggedCount,
    cheapTokens,
    flaggedTokens,
    cheapCostUsd: cheapCost,
    pricierCostUsd: pricierCost,
    totalUsd: cheapCost + pricierCost,
  };
}

function costForRun(triagedDiff, cfg) {
  const prs = (triagedDiff.files || []).map((f) => costForFile(f, cfg));
  const totalUsd = prs.reduce((s, p) => s + p.totalUsd, 0);
  const totalHunks = prs.reduce((s, p) => s + p.totalHunks, 0);
  const flaggedHunks = prs.reduce((s, p) => s + p.flaggedHunks, 0);
  return { prs, totalUsd, totalHunks, flaggedHunks };
}

// Cap enforcement: does this run fit within the remaining monthly budget?
function checkCap(state, estimatedUsd, capUsd) {
  const spent = Number(state.spent_usd || 0);
  const cap = Number(capUsd);
  const remaining = cap - spent;
  const allowed = estimatedUsd <= remaining;
  return {
    allowed,
    capUsd: cap,
    spentUsd: spent,
    estimatedUsd,
    remainingUsd: remaining,
    remainingAfterUsd: allowed ? remaining - estimatedUsd : remaining,
    reason: allowed
      ? null
      : `estimated cost $${estimatedUsd.toFixed(4)} exceeds remaining monthly budget $${remaining.toFixed(4)} (cap $${cap.toFixed(2)})`,
  };
}

module.exports = { costForFile, costForRun, checkCap };
