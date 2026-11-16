'use strict';

const DEFAULT_CLOUD_PRICING = {
  input_per_million: 1.0,
  output_per_million: 2.0,
};

function cloudTokenCost(tokensIn, tokensOut, pricing) {
  const p = Object.assign({}, DEFAULT_CLOUD_PRICING, pricing || {});
  const inCost = (tokensIn / 1_000_000) * Number(p.input_per_million || 0);
  const outCost = (tokensOut / 1_000_000) * Number(p.output_per_million || 0);
  return +(inCost + outCost).toFixed(8);
}

module.exports = { cloudTokenCost, DEFAULT_CLOUD_PRICING };