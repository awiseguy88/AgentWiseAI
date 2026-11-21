import fs from 'node:fs';

let pricesCache = null;

export function loadPricing(path) {
  if (!pricesCache) {
    pricesCache = JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  return pricesCache;
}

export function modelPrice(prices, model) {
  const entry = prices.prices[model] || prices.prices[model.split(':')[0]] || null;
  return entry || { input: 0, output: 0 };
}

export function usageCost(model, promptTokens, completionTokens, prices) {
  const perTokens = prices.per_tokens || 1000;
  const p = modelPrice(prices, model);
  const inputUsd = (promptTokens / perTokens) * p.input;
  const outputUsd = (completionTokens / perTokens) * p.output;
  return inputUsd + outputUsd;
}

export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}