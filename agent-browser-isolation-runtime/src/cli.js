#!/usr/bin/env node
'use strict';

const { ProfileStore } = require('./profile');
const { FixtureSite } = require('./fixture-site');
const { JobRunner } = require('./runner');
const { BrowserProfile } = require('./browser');
const { McpServer } = require('./mcp');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_ROOT = path.join(process.cwd(), '.profiles');
const FIXTURE_PORT = 19871;
const BASE_URL = `http://localhost:${FIXTURE_PORT}`;

async function startFixture() {
  const site = new FixtureSite(FIXTURE_PORT);
  await site.start();
  console.error(`[cli] fixture site listening on ${BASE_URL}`);
  return site;
}

async function cmdServe({ profileRoot }) {
  const store = new ProfileStore(profileRoot);
  const server = new McpServer({ store });
  server.serve();
}

async function cmdDemo({ profileRoot }) {
  const store = new ProfileStore(profileRoot);
  const site = await startFixture();
  const runner = new JobRunner({ store, baseUrl: BASE_URL });
  const jobs = [
    runner.createJob({ id: 'job-a', profile: 'alice-profile', account: 'alice', password: 'alicepw' }),
    runner.createJob({ id: 'job-b', profile: 'bob-profile', account: 'bob', password: 'bobpw' }),
  ];
  console.error('[cli] running demo: two concurrent isolated jobs');
  const results = await runner.runConcurrent(jobs);
  const outcomes = results.map((r, i) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message }));
  console.log(JSON.stringify({ demo: 'isolated-login', outcomes }, null, 2));
  await site.stop();
}

async function cmdVerify({ profileRoot }) {
  const store = new ProfileStore(profileRoot);
  const site = await startFixture();
  const runner = new JobRunner({ store, baseUrl: BASE_URL });

  console.error('[verify] running isolation, detection, and failure tests...');

  // 1) Isolation: 100 runs, zero cross-contamination.
  let crossContamination = 0;
  for (let i = 0; i < 100; i++) {
    const pa = `alice-${i}`;
    const pb = `bob-${i}`;
    const jobs = [
      runner.createJob({ id: `a-${i}`, profile: pa, account: 'alice', password: 'alicepw' }),
      runner.createJob({ id: `b-${i}`, profile: pb, account: 'bob', password: 'bobpw' }),
    ];
    const results = await runner.runConcurrent(jobs);
    const a = results[0].status === 'fulfilled' ? results[0].value : null;
    const b = results[1].status === 'fulfilled' ? results[1].value : null;
    if (!a || a.account !== 'alice') crossContamination++;
    if (!b || b.account !== 'bob') crossContamination++;
  }

  // 2) Detection: stealth config passes challenge, non-stealth fails loudly.
  let detectionPassed = false;
  let detectionFailedLoudly = false;
  const stealth = new BrowserProfile({ store, name: 'stealth-test', driver: 'fixture' });
  const challenge = await stealth.checkChallenge(BASE_URL);
  detectionPassed = challenge.passed;
  stealth.close();

  const nonStealth = new BrowserProfile({
    store,
    name: 'non-stealth-test',
    driver: 'fixture',
    stealth: { userAgent: 'HeadlessChrome/124', viewport: { width: 0, height: 0 }, initScript: '', realInput: false },
  });
  const challenge2 = await nonStealth.checkChallenge(BASE_URL);
  detectionFailedLoudly = challenge2.status === 403;
  nonStealth.close();

  // 3) Failure: kill one mid-run, other intact + recoverable on restart.
  const pf = 'kill-test-1';
  const pb = 'kill-test-2';
  const j1 = runner.createJob({ id: 'kill-1', profile: pf, account: 'alice', password: 'alicepw' });
  const j2 = runner.createJob({ id: 'kill-2', profile: pb, account: 'bob', password: 'bobpw' });
  // Start both; immediately kill j1 after first navigate (simulate by running and killing after small delay).
  const p1 = runner.runJob(j1);
  const p2 = runner.runJob(j2);
  await new Promise((r) => setTimeout(r, 50));
  runner.killJob('kill-1');
  const r1 = await p1.catch(() => ({ status: 'killed' }));
  const r2 = await p2;
  const otherIntact = r2 && r2.account === 'bob';
  const killedRecovered = store.exists(pf);
  // Verify killed job's profile state is recoverable.
  const recoveredProfile = new BrowserProfile({ store, name: pf, driver: 'fixture' });
  const recov = await recoveredProfile.extract('#account-data');
  const hasState = !!recov.account; // should be empty because killed before login, but state file exists
  recoveredProfile.close();

  await site.stop();

  const report = {
    isolation: { runs: 100, crossContamination, pass: crossContamination === 0 },
    detection: { stealthPass: detectionPassed, nonStealthFailsLoudly: detectionFailedLoudly, pass: detectionPassed && detectionFailedLoudly },
    failure: { otherIntact, killedRecovered, pass: otherIntact && killedRecovered },
    overall: crossContamination === 0 && detectionPassed && detectionFailedLoudly && otherIntact && killedRecovered,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.overall) process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node src/cli.js serve [--profile-root DIR]
  node src/cli.js demo [--profile-root DIR]
  node src/cli.js verify [--profile-root DIR]
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'serve';
  const opts = { profileRoot: DEFAULT_ROOT };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--profile-root') opts.profileRoot = args[++i];
  }
  if (cmd === 'serve') await cmdServe(opts);
  else if (cmd === 'demo') await cmdDemo(opts);
  else if (cmd === 'verify') await cmdVerify(opts);
  else { usage(); process.exitCode = 2; }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { main, BASE_URL };