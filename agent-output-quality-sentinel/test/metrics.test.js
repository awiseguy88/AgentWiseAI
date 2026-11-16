'use strict';

const assert = require('assert');
const { computeMetrics, computeRunMetrics, gateResult, ngramRedundancy, countClaims } = require('../src/metrics');

function turn(text, extra) {
  return { index: 0, role: 'assistant', text, codeBlocks: [], step_signature: extra && extra.sig || null, meta: extra || null };
}

// verbosity: prose-heavy -> high ratio; code-heavy -> low ratio
const prose = 'This is just a bunch of plain text with no code at all. It is verbose.';
assert.ok(computeMetrics(turn(prose)).verbosity_ratio > 0.8, 'prose should be high verbosity');
const code = 'Here is the implementation:\n\n```python\nimport os\nimport sys\n\ndef main():\n    print("hello")\n    return 0\n\nif __name__ == "__main__":\n    sys.exit(main())\n```\n';
assert.ok(computeMetrics(turn(code)).verbosity_ratio < 0.5, 'code should be low verbosity');
assert.ok(computeMetrics(turn(code)).code_yield > 0.5, 'code should be high code yield');

// redundancy: repeated 4-grams -> high redundancy
assert.ok(computeMetrics(turn('foo bar baz qux foo bar baz qux foo bar baz qux')).redundancy > 0.5, 'repetitive text should be redundant');
assert.strictEqual(computeMetrics(turn('a b c d')).redundancy, 0, 'unique short text should have 0 redundancy');

// claim density
assert.ok(countClaims('All tests passed and the build succeeded.') >= 1, 'should detect claims');
assert.ok(countClaims('maybe things are okay i guess') === 0, 'should not detect weak text as claims');

// step repetition: same signature repeats
const { perTurn } = computeRunMetrics([
  turn('first', { sig: 'read_file|a' }),
  turn('second', { sig: 'read_file|a' })
]);
assert.strictEqual(perTurn[0].metrics.step_signature_repetition, 0, 'first occurrence not repeat');
assert.strictEqual(perTurn[1].metrics.step_signature_repetition, 1, 'second occurrence is repeat');

// gate
const pass = gateResult({ mean_slop: 10, max_slop: 10, min_slop: 10, turn_count: 1, repeated_turns: 0, mean_redundancy: 0, mean_verbosity: 0, mean_claim_density: 5, mean_code_yield: 0 }, [], 60);
assert.ok(pass.pass, 'low slop should pass gate');
const fail = gateResult({ mean_slop: 70, max_slop: 90, min_slop: 40, turn_count: 2, repeated_turns: 1, mean_redundancy: 0.5, mean_verbosity: 0.5, mean_claim_density: 0, mean_code_yield: 0 }, [], 60);
assert.ok(!fail.pass && fail.breaches.length >= 1, 'high slop should fail gate');

console.log('metrics tests passed');