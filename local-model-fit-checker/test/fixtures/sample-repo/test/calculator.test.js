const { add, multiply } = require('../src/calculator');

test('add sums two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

test('multiply computes product', () => {
  expect(multiply(2, 3)).toBe(6);
});
