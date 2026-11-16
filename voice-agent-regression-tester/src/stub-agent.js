const fs = require('fs');
const path = require('path');

function loadStubConfig(agentSpec) {
  if (typeof agentSpec === 'string') {
    const full = path.resolve(agentSpec);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  }
  return agentSpec;
}

function createStubHandler(config) {
  const scenarios = config.scenarios || {};
  return async function handleTurn({ scenarioId, turnIndex, message }) {
    const sc = scenarios[scenarioId];
    if (!sc) {
      return { reply: 'unknown scenario', toolCalls: [], captured: {}, exit: 'error', done: true };
    }
    const turns = sc.turns || [];
    const step = turns[turnIndex] || turns[turns.length - 1] || {};
    return {
      reply: step.reply || '',
      toolCalls: step.toolCalls || [],
      captured: step.captured || {},
      exit: step.exit !== undefined ? step.exit : sc.exit,
      done: step.done !== undefined ? step.done : turnIndex >= (turns.length - 1),
    };
  };
}

module.exports = { loadStubConfig, createStubHandler };
