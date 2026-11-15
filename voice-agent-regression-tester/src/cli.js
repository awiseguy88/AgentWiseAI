#!/usr/bin/env node
const path = require('path');
const { runSuite } = require('./runner');
const { scoreScenario } = require('./assertions');
const { writeReports } = require('./report');

function parseArgs(argv) {
  const args = { fixtures: 'fixtures/scenarios.json', agent: null, endpoint: null, out: 'reports/latest' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures' || a === '-f') args.fixtures = argv[++i];
    else if (a === '--agent' || a === '-a') args.agent = argv[++i];
    else if (a === '--endpoint' || a === '-e') args.endpoint = argv[++i];
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`voice-agent-regression-tester — offline voice-agent regression CLI

Usage:
  voice-agent-regression-tester [options]

Options:
  --fixtures <path>   Fixture suite JSON (default: fixtures/scenarios.json)
  --agent <path>      Stub agent config JSON for offline replay
  --endpoint <url>    HTTP endpoint to replay against instead of stub
  --out <dir>         Output directory for report.json/report.html (default: reports/latest)
  -h, --help          Show this help
`);
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { printHelp(); return 0; }
  if (!args.agent && !args.endpoint) {
    console.error('Error: provide either --agent <path> or --endpoint <url>.\n');
    printHelp();
    return 2;
  }
  try {
    const pairs = await runSuite({
      fixturesPath: args.fixtures,
      agentPath: args.agent,
      endpoint: args.endpoint,
    });
    const results = pairs.map(({ scenario, transcript }) => scoreScenario(scenario, transcript));
    const { summary, htmlPath, jsonPath } = writeReports(results, {
      outDir: args.out,
      fixtures: args.fixtures,
      agent: args.agent,
      endpoint: args.endpoint,
    });
    console.log(`Voice agent regression: ${summary.passed}/${summary.total} scenarios passed (${summary.status})`);
    for (const r of results) {
      if (!r.pass) {
        console.log(`  FAIL ${r.scenario.id}: ${r.failures.map((f) => f.message).join('; ')}`);
      } else {
        console.log(`  PASS ${r.scenario.id}`);
      }
    }
    console.log(`Reports: ${path.relative(process.cwd(), jsonPath)} | ${path.relative(process.cwd(), htmlPath)}`);
    return summary.status === 'PASS' ? 0 : 1;
  } catch (err) {
    console.error(`Run failed: ${err && err.message ? err.message : err}`);
    return 1;
  }
}

module.exports = { main, parseArgs };

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
