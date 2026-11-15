'use strict';

// --- pricing.js: token estimation + pricing table defaults (all configurable) ---
// Prices are USD per 1,000 input/output tokens. No network call is needed for
// any of these values; they are a local estimate only.

const DEFAULTS = {
  cheapModel: process.env.CHEAP_MODEL || 'claude-haiku-4.5',
  cheapInputPrice: Number(process.env.CHEAP_INPUT_PRICE_PER_1K) || 0.25,
  pricierModel: process.env.PRICIER_MODEL || 'claude-sonnet-4.5',
  pricierInputPrice: Number(process.env.PRICIER_INPUT_PRICE_PER_1K) || 3.00,
  pricierOutputPrice: Number(process.env.PRICIER_OUTPUT_PRICE_PER_1K) || 15.00,
  pricierOutputTokens: Number(process.env.PRICIER_OUTPUT_TOKENS) || 400,
  tokensPerLine: Number(process.env.TOKENS_PER_LINE) || 0.75,
  largeHunkLines: Number(process.env.LARGE_HUNK_LINES) || 60,
  monthlyCapUsd: Number(process.env.MONTHLY_CAP_USD) || 50,
};

function loadConfig(configPath) {
  const cfg = Object.assign({}, DEFAULTS);
  if (configPath) {
    try {
      const fs = require('node:fs');
      const file = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      Object.assign(cfg, file);
    } catch (err) {
      // ignore missing/invalid config; env vars / defaults still apply
    }
  }
  return cfg;
}

// Estimate input tokens for a hunk: lines * tokens-per-line, min 1 token.
function estimateHunkTokens(hunk, tokensPerLine) {
  return Math.max(1, Math.round((hunk.lines && hunk.lines.length || 0) * tokensPerLine));
}

module.exports = { DEFAULTS, loadConfig, estimateHunkTokens };
