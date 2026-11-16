const fs = require('fs');
const path = require('path');
const { loadMockAgent } = require('./fixtures');

function loadMockConfig(agentSpec) {
  return loadMockAgent(agentSpec);
}

function createMockHandler(config) {
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

async function replayScenario(scenario, handler) {
  const turns = scenario.turns || [];
  const history = [];
  let finalExit = null;
  const transcriptTurns = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const userMessage = typeof turn === 'string' ? turn : (turn.user || turn.message || '');
    const payload = { scenarioId: scenario.id, turnIndex: i, message: userMessage, history: history.slice() };
    const result = await handler(payload);
    const turnResult = {
      user: userMessage,
      reply: result.reply || '',
      toolCalls: result.toolCalls || [],
      captured: result.captured || {},
      exit: result.exit,
      done: !!result.done,
    };
    transcriptTurns.push(turnResult);
    history.push({ role: 'user', content: userMessage }, { role: 'agent', content: turnResult.reply, toolCalls: turnResult.toolCalls });
    if (result.exit !== undefined && result.exit !== null) finalExit = result.exit;
    if (result.done) break;
  }

  if (finalExit === null && transcriptTurns.length) {
    finalExit = transcriptTurns[transcriptTurns.length - 1].exit ?? null;
  }

  return { scenarioId: scenario.id, exit: finalExit, turns: transcriptTurns };
}

async function runSuite(scenarios, handler) {
  const results = [];
  for (const scenario of scenarios) {
    const transcript = await replayScenario(scenario, handler);
    results.push({ scenario, transcript });
  }
  return results;
}

async function runMultipleTimes({ scenarios, agentPath, runs }) {
  const allResults = [];
  for (let run = 0; run < runs; run++) {
    const config = loadMockConfig(agentPath);
    const handler = createMockHandler(config);
    const suiteResults = await runSuite(scenarios, handler);
    allResults.push(suiteResults);
  }
  return allResults;
}

module.exports = { loadMockConfig, createMockHandler, replayScenario, runSuite, runMultipleTimes };
