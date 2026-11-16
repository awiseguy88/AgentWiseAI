const path = require('path');
const { loadFixtures } = require('./fixtures');
const { runMultipleTimes } = require('./runner');
const { scoreFingerprint } = require('./fingerprint');
const { runSPRT } = require('./sprt');
const { writeReports } = require('./report');

function parseArgs(argv) {
  const args = {
    fixtures: 'fixtures/scenarios.json',
    agent: null,
    baseline: null,
    runs: 10,
    out: 'reports/latest',
    alpha: 0.05,
    beta: 0.10,
    p0: 0.99,
    p1: 0.50,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures' || a === '-f') args.fixtures = argv[++i];
    else if (a === '--agent' || a === '-a') args.agent = argv[++i];
    else if (a === '--baseline' || a === '-b') args.baseline = argv[++i];
    else if (a === '--runs' || a === '-n') args.runs = parseInt(argv[++i], 10);
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--alpha') args.alpha = parseFloat(argv[++i]);
    else if (a === '--beta') args.beta = parseFloat(argv[++i]);
    else if (a === '--p0') args.p0 = parseFloat(argv[++i]);
    else if (a === '--p1') args.p1 = parseFloat(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`agent-regression-suite — offline behavioral regression testing for AI agents (SPRT)

Usage:
  agent-regression-suite [options]

Options:
  --fixtures, -f <path>   Frozen scenario suite JSON (default: fixtures/scenarios.json)
  --agent, -a <path>      Agent to test (mock agent config JSON)
  --baseline, -b <path>   Baseline agent config (optional, for comparison demos)
  --runs, -n <number>     Max runs/trials per scenario (default: 10)
  --out, -o <dir>         Output directory for report.json/report.html (default: reports/latest)
  --alpha <n>             SPRT Type I error / false-pass risk (default: 0.05)
  --beta <n>              SPRT Type II error / false-fail risk (default: 0.10)
  --p0 <n>                Acceptable pass probability under H0 (default: 0.99)
  --p1 <n>                Pass probability under regression H1 (default: 0.50)
  -h, --help              Show this help

Verdicts per scenario: PASS, FAIL, or INCONCLUSIVE (SPRT). CI exits non-zero if any scenario is FAIL.
`);
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { printHelp(); return 0; }
  if (!args.agent) {
    console.error('Error: provide --agent <path> (mock agent config JSON).\n');
    printHelp();
    return 2;
  }

  try {
    const scenarios = loadFixtures(args.fixtures);
    if (!scenarios.length) throw new Error('No scenarios loaded from fixtures.');

    const allRuns = await runMultipleTimes({ scenarios, agentPath: args.agent, runs: args.runs });
    const sprtParams = { alpha: args.alpha, beta: args.beta, p0: args.p0, p1: args.p1 };

    const scenarioReports = scenarios.map((scenario, idx) => {
      const trials = allRuns.map((runResults) => {
        const { transcript } = runResults[idx];
        return scoreFingerprint(scenario, transcript);
      });
      const trialPasses = trials.map((t) => t.pass);
      const sprt = runSPRT(trialPasses, sprtParams);
      return {
        id: scenario.id,
        description: scenario.description || '',
        trials: trials.map((t) => ({ pass: t.pass, failures: t.failures, fingerprint: t.fingerprint })),
        sprt,
      };
    });

    const passed = scenarioReports.filter((s) => s.sprt.verdict === 'PASS').length;
    const failed = scenarioReports.filter((s) => s.sprt.verdict === 'FAIL').length;
    const inconclusive = scenarioReports.filter((s) => s.sprt.verdict === 'INCONCLUSIVE').length;
    const overall = failed > 0 ? 'FAIL' : (inconclusive > 0 ? 'INCONCLUSIVE' : 'PASS');

    const report = {
      timestamp: new Date().toISOString(),
      fixtures: args.fixtures,
      agent: args.agent,
      baseline: args.baseline || '',
      runs: args.runs,
      sprt: sprtParams,
      summary: { total: scenarioReports.length, passed, failed, inconclusive, overall },
      scenarios: scenarioReports,
    };

    const { jsonPath, htmlPath } = writeReports(report, args.out);

    console.log(`Agent Regression Suite: ${overall} (${passed} pass, ${failed} fail, ${inconclusive} inconclusive / ${scenarioReports.length} scenarios)`);
    for (const s of scenarioReports) {
      const conf = (s.sprt.confidence * 100).toFixed(1);
      console.log(`  ${s.sprt.verdict} ${s.id} — ${(s.sprt.confidence * 100).toFixed(1)}% confidence (${s.sprt.runsCompleted}/${s.sprt.runsRequested} runs)`);
      if (s.sprt.verdict === 'FAIL' && s.trials.length) {
        const firstFail = s.trials.find((t) => !t.pass);
        if (firstFail && firstFail.failures.length) {
          console.log(`    First failure: ${firstFail.failures[0].message}`);
        }
      }
    }
    console.log(`Reports: ${path.relative(process.cwd(), jsonPath)} | ${path.relative(process.cwd(), htmlPath)}`);

    return overall === 'FAIL' ? 1 : 0;
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
