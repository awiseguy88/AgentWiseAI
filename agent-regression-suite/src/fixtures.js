const fs = require('fs');
const path = require('path');

function loadFixtures(fixturesPath) {
  const full = path.resolve(fixturesPath);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (Array.isArray(data)) return data;
  return data.scenarios || [];
}

function validateScenario(scenario) {
  const errors = [];
  if (!scenario.id) errors.push('Scenario missing required "id"');
  if (!Array.isArray(scenario.turns)) errors.push(`Scenario "${scenario.id}": turns must be an array`);
  if (scenario.expected && typeof scenario.expected !== 'object') errors.push(`Scenario "${scenario.id}": expected must be an object`);
  return errors;
}

function loadMockAgent(agentSpec) {
  if (typeof agentSpec === 'string') {
    const full = path.resolve(agentSpec);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  }
  return agentSpec;
}

module.exports = { loadFixtures, validateScenario, loadMockAgent };
