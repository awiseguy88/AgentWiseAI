'use strict';

const { countTokens } = require('./tokenizer');
const { DEFAULT_MARKER } = require('./config');

/**
 * Compute the token budget available for the kept prefix of the text, after
 * reserving room for the truncation marker.
 */
function prefixTokenBudget(tokenBudget, markerText, keptChars) {
  const markerTokens = countTokens(markerText);
  const newlineTokens = keptChars > 0 ? 1 : 0; // the '\n' joining text and marker
  return tokenBudget - markerTokens - newlineTokens;
}

/**
 * Apply a token budget to a plain-text tool result.
 *
 * - If the text already fits the budget, it is returned unchanged (byte-identical).
 * - Otherwise the text is truncated (deterministically, via binary search over
 *   character prefixes) to the largest prefix whose tokens plus the marker fit
 *   the budget, then the marker is appended.
 *
 * Returns a structured record describing the result and the savings.
 */
function applyBudget(text, tokenBudget, markerText, opts = {}) {
  const marker = markerText != null ? markerText : DEFAULT_MARKER;
  const byteLength = Buffer.byteLength(text, 'utf8');
  const tokenCount = countTokens(text);

  if (tokenCount <= tokenBudget) {
    return {
      result: text,
      budgeted: false,
      tokenCount,
      tokenBudget,
      bytesSaved: 0,
      tokensSaved: 0,
      byteLengthBefore: byteLength,
      byteLengthAfter: byteLength,
      truncated: false,
    };
  }

  const availTokens = prefixTokenBudget(tokenBudget, marker, 1);

  if (availTokens <= 0) {
    // Budget too small to keep any text; return only the marker.
    const finalText = marker;
    const finalTokens = countTokens(finalText);
    const byteLengthAfter = Buffer.byteLength(finalText, 'utf8');
    return {
      result: finalText,
      budgeted: true,
      tokenCount,
      tokenBudget,
      bytesSaved: Math.max(0, byteLength - byteLengthAfter),
      tokensSaved: Math.max(0, tokenCount - finalTokens),
      byteLengthBefore: byteLength,
      byteLengthAfter,
      truncated: true,
      markerOnly: true,
    };
  }

  // Binary search for the largest prefix length k such that
  // countTokens(text.slice(0, k)) <= availTokens.
  let low = 0;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (countTokens(text.slice(0, mid)) <= availTokens) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let kept = text.slice(0, best);
  // Avoid leaving a dangling high surrogate at the cut point.
  kept = kept.replace(/[\uD800-\uDBFF]$/u, '');
  const finalText = kept + '\n' + marker;
  const finalTokens = countTokens(finalText);
  const byteLengthAfter = Buffer.byteLength(finalText, 'utf8');

  return {
    result: finalText,
    budgeted: true,
    tokenCount,
    tokenBudget,
    bytesSaved: Math.max(0, byteLength - byteLengthAfter),
    tokensSaved: Math.max(0, tokenCount - finalTokens),
    byteLengthBefore: byteLength,
    byteLengthAfter,
    truncated: true,
  };
}

function getToolBudget(serverSpec, toolName, defaultBudget) {
  if (serverSpec && serverSpec.toolBudgets && serverSpec.toolBudgets[toolName] != null) {
    return serverSpec.toolBudgets[toolName];
  }
  if (serverSpec && serverSpec.budget != null) {
    return serverSpec.budget;
  }
  return defaultBudget;
}

module.exports = { applyBudget, getToolBudget };