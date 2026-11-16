const fs = require('fs');
const path = require('path');
const { loadStubConfig, createStubHandler } = require('./stub-agent');

function loadFixtures(fixturesPath) {
  const full = path.resolve(fixturesPath);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (Array.isArray(data)) return data;
  return data.scenarios || [];
}

async function callHttpEndpoint(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from agent endpoint: ${text}`);
  }
  return res.json();
}

async function replayScenario(scenario, handler, { endpoint } = {}) {
  const turns = scenario.turns || [];
  const history = [];
  let finalExit = null;
  const transcriptTurns = [];

  for (let i = 0; i < turns.length; i++) {
    const userMessage = typeof turns[i] === 'string' ? turns[i] : (turns[i].user || turns[i].message || '');
    const payload = { scenarioId: scenario.id, turnIndex: i, message: userMessage, history: history.slice() };
    let result;
    if (endpoint) {
      result = await callHttpEndpoint(endpoint, payload);
    } else {
      result = await handler(payload);
    }
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

async function runSuite({ fixturesPath, agentPath, endpoint }) {
  const scenarios = loadFixtures(fixturesPath);
  let handler = null;
  if (!endpoint) {
    const config = loadStubConfig(agentPath);
    handler = createStubHandler(config);
  }
  const results = [];
  for (const scenario of scenarios) {
    const transcript = await replayScenario(scenario, handler, { endpoint });
    results.push({ scenario, transcript });
  }
  return results;
}

module.exports = { loadFixtures, runSuite, replayScenario };
