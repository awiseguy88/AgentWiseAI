function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function findToolCall(actualCalls, expected) {
  return actualCalls.find((c) => {
    if (c.name !== expected.name) return false;
    if (!expected.args) return true;
    return stableStringify(c.args || {}) === stableStringify(expected.args);
  });
}

function scoreScenario(scenario, transcript) {
  const failures = [];
  const expected = scenario.expected || {};
  const allToolCalls = (transcript.turns || []).flatMap((t) => t.toolCalls || []);
  const finalCaptured = Object.assign({}, ...(transcript.turns || []).map((t) => t.captured || {}));
  const allText = (transcript.turns || []).map((t) => t.reply || '').join('\n');

  if (expected.exit !== undefined && transcript.exit !== expected.exit) {
    failures.push({
      type: 'exit',
      message: `Expected exit "${expected.exit}" but got "${transcript.exit}"`,
      expected: expected.exit,
      actual: transcript.exit,
    });
  }

  for (const tc of expected.toolCalls || []) {
    const found = findToolCall(allToolCalls, tc);
    if (!found) {
      failures.push({
        type: 'tool_call',
        message: tc.args
          ? `Expected tool call ${tc.name} with args ${JSON.stringify(tc.args)}`
          : `Expected tool call ${tc.name}`,
        expected: tc,
        actual: allToolCalls,
      });
    }
  }

  for (const [key, value] of Object.entries(expected.captured || {})) {
    if (finalCaptured[key] !== value) {
      failures.push({
        type: 'captured_field',
        message: `Expected captured field "${key}" to be ${JSON.stringify(value)} but got ${JSON.stringify(finalCaptured[key])}`,
        expected: { [key]: value },
        actual: { [key]: finalCaptured[key] },
      });
    }
  }

  for (const phrase of expected.forbiddenPhrases || []) {
    if (allText.toLowerCase().includes(String(phrase).toLowerCase())) {
      failures.push({
        type: 'forbidden_phrase',
        message: `Forbidden phrase found: ${JSON.stringify(phrase)}`,
        expected: `absent: ${phrase}`,
        actual: phrase,
      });
    }
  }

  return {
    scenario,
    id: scenario.id,
    description: scenario.description || '',
    pass: failures.length === 0,
    failures,
    transcript,
  };
}

module.exports = { scoreScenario };
