'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Default truncation marker. Clearly states that the result was truncated,
 * roughly how much was removed, and which tool applied the governor, so an
 * agent reading the output can tell it is not the complete result.
 */
const DEFAULT_MARKER =
  '[mcp-output-token-governor] truncated to fit the per-tool token budget — original result was longer than the budget; full result not returned.';

function loadConfig(filePath) {
  if (!filePath) {
    throw new Error('A config file path is required (--config <path>).');
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse config JSON at ${abs}: ${err.message}`);
  }
  return normalizeConfig(raw);
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Config must be a JSON object.');
  }
  const cfg = {
    servers: {},
    defaultBudget: raw.defaultBudget != null ? raw.defaultBudget : 2000,
    defaultMarker: typeof raw.defaultMarker === 'string' ? raw.defaultMarker : DEFAULT_MARKER,
    reportDir: typeof raw.reportDir === 'string' ? raw.reportDir : null,
  };

  if (raw.servers && typeof raw.servers === 'object') {
    for (const [name, spec] of Object.entries(raw.servers)) {
      cfg.servers[name] = normalizeServer(name, spec, cfg.defaultBudget);
    }
  }
  return cfg;
}

function normalizeServer(name, spec, defaultBudget) {
  if (!spec || typeof spec !== 'object') {
    throw new Error(`Server "${name}" must be an object.`);
  }
  const transport = spec.transport || 'stdio';
  const server = {
    name,
    transport,
    budget: spec.budget != null ? spec.budget : defaultBudget,
    toolBudgets: {},
    marker: typeof spec.marker === 'string' ? spec.marker : null,
    command: typeof spec.command === 'string' ? spec.command : null,
    args: Array.isArray(spec.args) ? spec.args.map(String) : [],
    url: typeof spec.url === 'string' ? spec.url : null,
    env: spec.env && typeof spec.env === 'object' ? spec.env : null,
  };
  if (spec.tools && typeof spec.tools === 'object') {
    for (const [tool, budget] of Object.entries(spec.tools)) {
      if (typeof budget === 'number' && budget > 0) {
        server.toolBudgets[tool] = budget;
      }
    }
  }
  return server;
}

module.exports = { loadConfig, normalizeConfig, DEFAULT_MARKER };