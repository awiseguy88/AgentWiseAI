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

function extractFingerprint(transcript) {
  const turns = transcript.turns || [];
  const allToolCalls = turns.flatMap((t) => t.toolCalls || []);
  const finalCaptured = Object.assign({}, ...turns.map((t) => t.captured || {}));
  const allText = turns.map((t) => t.reply || '').join('\n');
  const exit = transcript.exit;
  const turnCount = turns.length;

  return {
    toolCallSignatures: allToolCalls.map((tc) => `${tc.name}:${stableStringify(tc.args || {})}`).sort(),
    capturedFields: stableStringify(finalCaptured),
    exitCode: exit,
    turnCount,
    textHash: simpleHash(allText),
  };
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

function scoreFingerprint(scenario, transcript) {
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
    pass: failures.length === 0,
    failures,
    fingerprint: extractFingerprint(transcript),
  };
}

function compareFingerprints(base, trial) {
  const diffs = [];
  if (base.exitCode !== trial.exitCode) diffs.push({ field: 'exitCode', base: base.exitCode, trial: trial.exitCode });
  if (base.turnCount !== trial.turnCount) diffs.push({ field: 'turnCount', base: base.turnCount, trial: trial.turnCount });
  if (base.capturedFields !== trial.capturedFields) diffs.push({ field: 'capturedFields', base: base.capturedFields, trial: trial.capturedFields });
  const baseTools = new Set(base.toolCallSignatures);
  const trialTools = new Set(trial.toolCallSignatures);
  for (const t of baseTools) if (!trialTools.has(t)) diffs.push({ field: 'toolCalls', missing: t });
  for (const t of trialTools) if (!baseTools.has(t)) diffs.push({ field: 'toolCalls', extra: t });
  return { identical: diffs.length === 0, diffs };
}

module.exports = { extractFingerprint, scoreFingerprint, compareFingerprints, stableStringify, findToolCall };
