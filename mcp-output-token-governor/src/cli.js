'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./config');
const { Reporter } = require('./reporter');
const { GovernedServer } = require('./governed-server');
const { McpStdioClient } = require('./mcp-client');
const { countTokens } = require('./tokenizer');
const { startHttpServer } = require('./http-server');
const { runStdio } = require('./stdio-proxy');
const { ServerPool } = require('./server-pool');

async function main(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || 'http';

  if (cmd === 'http') {
    const configPath = getArg(args, '--config');
    const port = parseInt(getArg(args, '--port') || '0', 10);
    const config = configPath ? loadConfig(configPath) : { servers: {}, defaultBudget: 2000, defaultMarker: null, reportDir: null };
    const { reporter } = startHttpServer({ config, port });
    process.on('SIGINT', () => {
      const outDir = config.reportDir || process.cwd();
      try { reporter.writeFiles(outDir); console.error(`Report written to ${outDir}`); } catch (e) {}
      process.exit(0);
    });
    return;
  }

  if (cmd === 'stdio') {
    const configPath = getArg(args, '--config');
    await runStdio(configPath);
    return;
  }

  if (cmd === 'report') {
    const out = getArg(args, '--out') || process.cwd();
    const reporter = new Reporter();
    const paths = reporter.writeFiles(out);
    console.log(`Wrote ${paths.jsonPath} and ${paths.htmlPath}`);
    return;
  }

  if (cmd === 'verify') {
    await runVerify(args);
    return;
  }

  console.error('Usage: node src/cli.js <http|report|verify> ...');
  process.exit(1);
}

function getArg(args, name) {
  const i = args.indexOf(name);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

async function runVerify(args) {
  const configPath = getArg(args, '--config');
  const outDir = getArg(args, '--out') || process.cwd();
  const config = configPath ? loadConfig(configPath) : defaultVerifyConfig();
  const serverName = Object.keys(config.servers)[0] || 'default';
  const spec = config.servers[serverName];

  // Baseline: call the real (ungoverned) server and count tokens.
  const rawClient = new McpStdioClient(spec);
  await rawClient.initialize();
  const tools = ['search', 'list_files', 'read_logs', 'fetch_api', 'dump_meta'];
  const baselineTotals = [];
  for (const tool of tools) {
    const result = await rawClient.callTool(tool, {});
    const text = extractText(result);
    baselineTotals.push(countTokens(text));
  }
  rawClient.close();

  // Post-change: call through the governed proxy.
  const reporter = new Reporter();
  const pool = new ServerPool();
  const governed = new GovernedServer(spec, config.defaultBudget, reporter, pool);
  await governed.start();
  for (const tool of tools) {
    await governed.callTool(tool, {});
  }
  governed.close();
  await pool.closeAll();

  const data = reporter.toJSON();
  const baselineTotal = baselineTotals.reduce((a, b) => a + b, 0);
  const postTotal = data.summary.tokenCountAfter;
  const budgetedCalls = data.summary.budgetedCalls;
  const paths = reporter.writeFiles(outDir);
  const pass = postTotal < baselineTotal && budgetedCalls > 0;
  const summary = {
    baselineTokenTotal: baselineTotal,
    postTokenTotal: postTotal,
    budgetedCalls,
    tokensReclaimed: baselineTotal - postTotal,
    pass,
    reportJson: paths.jsonPath,
    reportHtml: paths.htmlPath,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!pass) process.exit(2);
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (result && Array.isArray(result.content)) {
    const parts = result.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') return item.text;
        return '';
      })
      .filter((p) => p != null && p.length > 0);
    return parts.join('\n');
  }
  return JSON.stringify(result);
}

function defaultVerifyConfig() {
  const here = path.join(__dirname, '..', 'test', 'fake-mcp-server.js');
  return {
    servers: {
      fake: {
        name: 'fake',
        transport: 'stdio',
        budget: 2000,
        command: process.execPath,
        args: [here],
      },
    },
    defaultBudget: 2000,
    defaultMarker: null,
    reportDir: null,
  };
}

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}

module.exports = { main };