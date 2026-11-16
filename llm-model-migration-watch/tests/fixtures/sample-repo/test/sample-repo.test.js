'use strict';
const assert = require('assert');

describe('sample repo tests', () => {
  it('sums integers correctly', () => {
    assert.strictEqual(sum(5), 15);
  });
  it('returns unique values', () => {
    assert.deepStrictEqual(unique([1, 2, 2, 3, 3, 3]), [1, 2, 3]);
  });
});

function sum(n) {
  let s = 0;
  for (let i = 1; i <= n; i++) s += i;
  return s;
}

function unique(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) { if (!seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}