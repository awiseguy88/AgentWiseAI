#!/usr/bin/env node
'use strict';

// --- cli.js: PR Review Cost Guard CLI ---

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const diff = require('./diff.js');
const triage = require('./triage.js');
const pricing = require('./pricing.js');
const cost = require('./cost.js');
const state = require('./state.js');
const report = require('./report.js');

const TOOL = 'pr-review-cost-guard';
const VERSION = '0.1.0';

function nowIso() { return new Date().toISOString(); }

function readDiffsDir(diffsDir) {
  const entries = fs.readdirSync(diffsDir).sort();
  const prs = [];
  for (const name of entries) {
    if (!name.endsWith('.diff')) continue;
    const m = name.match(/(\d+)\.diff$/);
    const prNumber = m ? Number(m[1]) : name.replace(/\.diff$/, '');
    const text = fs.readFileSync(path.join(diffsDir, name), 'utf8');
    prs.push({ pr: prNumber, name, text });
  }
  return prs;
}

function readGitDiff(repoDir, prNumber) {
  const diffText = execSync(`git -C ${repoDir} diff HEAD~${prNumber}..HEAD 2>/dev/null || git -C ${repoDir} diff HEAD~1..HEAD`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).toString();
  return [{ pr: prNumber, name: `pr-${prNumber}.diff`, text: diffText }];
}

function buildRun(reportCfg) {
  return {
    tool: TOOL,
    version: VERSION,
    generated_at: nowIso(),
    config: reportCfg,
    run_id: Math.floor(Date.now() / 1000),
    summary: {},
    prs: [],
  };
}

function runScan(args) {
  const { diffsDir, repoDir, prNumber, monthlyCap, report: reportFormat, outDir, configPath, commit, postPr, stateDir } = args;

  const cfg = pricing.loadConfig(configPath);
  if (monthlyCap !== undefined) cfg.monthlyCapUsd = monthlyCap;

  let prInputs;
  if (diffsDir) prInputs = readDiffsDir(diffsDir);
  else if (repoDir) prInputs = readGitDiff(repoDir, prNumber || 1);
  else throw new Error('Provide --diffs <dir> or --repo <dir> [--pr <n>]');

  const st = state.loadState(stateDir || process.cwd());
  const capUsd = cfg.monthlyCapUsd !== null ? cfg.monthlyCapUsd : (st.cap_usd || 50);

  const run = buildRun(cfg);
  const triaged = { files: [] };
  let totalUsd = 0, totalHunks = 0, flaggedHunks = 0;

  for (const p of prInputs) {
    const parsed = diff.parseDiff(p.text);
    // triage each file's hunks with the correct file path
    const files = parsed.files.map((f) => triage.triageFile(f, cfg.largeHunkLines));
    const fileCosts = files.map((f) => cost.costForFile(f, cfg));
    const fileTotal = fileCosts.reduce((s, c) => s + c.totalUsd, 0);
    const fHunks = fileCosts.reduce((s, c) => s + c.totalHunks, 0);
    const fFlagged = fileCosts.reduce((s, c) => s + c.flaggedHunks, 0);
    const reasons = files.flatMap((f) => f.hunks.filter((h) => h.triage.flagged).flatMap((h) => h.triage.reasons));
    run.prs.push({
      pr: p.pr,
      path: p.name,
      total_hunks: fHunks,
      flagged_hunks: fFlagged,
      cheap_cost_usd: Number(fileCosts.reduce((s, c) => s + c.cheapCostUsd, 0).toFixed(6)),
      pricier_cost_usd: Number(fileCosts.reduce((s, c) => s + c.pricierCostUsd, 0).toFixed(6)),
      total_usd: Number(fileTotal.toFixed(6)),
      flag_reasons: [...new Set(reasons)],
    });
    totalUsd += fileTotal;
    totalHunks += fHunks;
    flaggedHunks += fFlagged;
    triaged.files.push(...files);
  }

  const estimatedUsd = Number(totalUsd.toFixed(6));
  const capCheck = cost.checkCap(st, estimatedUsd, capUsd);

  run.summary = {
    pr_count: prInputs.length,
    total_hunks: totalHunks,
    flagged_hunks: flaggedHunks,
    estimated_cost_usd: Number(estimatedUsd.toFixed(4)),
    cap_usd: Number(capUsd.toFixed(2)),
    remaining_usd: Number(capCheck.remainingUsd.toFixed(4)),
    status: capCheck.allowed ? 'allowed' : 'blocked',
    cap_reason: capCheck.reason,
  };

  // emit reports
  fs.mkdirSync(outDir, { recursive: true });
  const { jsonPath, htmlPath } = report.writeReports(outDir, run);

  // console summary
  console.log(`PR Review Cost Guard v${VERSION}`);
  console.log(`Scanned ${run.summary.pr_count} PR(s): ${run.summary.total_hunks} hunks, ${run.summary.flagged_hunks} flagged.`);
  console.log(`Estimated cost this run: $${run.summary.estimated_cost_usd} (cap $${run.summary.cap_usd}, remaining $${run.summary.remaining_usd}).`);
  console.log(`Status: ${run.summary.status.toUpperCase()}.`);
  if (capCheck.reason) console.log(`  ${capCheck.reason}`);
  console.log(`Reports: ${jsonPath} / ${htmlPath}`);

  // optional comment post (dry-run preview unless --post used with a real PR number)
  const payload = report.commentPayload(Object.assign({}, run, { html_path: htmlPath }));
  const commentPath = path.join(outDir, `comment-${run.run_id}.md`);
  fs.writeFileSync(commentPath, payload + '\n', 'utf8');
  console.log(`Summary comment preview: ${commentPath}`);

  if (postPr) {
    postComment(postPr, payload);
  }

  // commit actual spend if requested
  if (commit) {
    if (!capCheck.allowed) {
      console.error(`Not committing spend: run is blocked (${capCheck.reason}).`);
      process.exitCode = 2;
      return;
    }
    state.recordRun(stateDir || process.cwd(), {
      run_id: run.run_id,
      generated_at: run.generated_at,
      pr_count: run.summary.pr_count,
      estimated_usd: run.summary.estimated_cost_usd,
      committed: true,
      month: st.month,
    });
    console.log(`Committed spend $${run.summary.estimated_cost_usd} to monthly state.`);
  }

  if (!capCheck.allowed) process.exitCode = 2;
}

function postComment(prNumber, payload) {
  try {
    const tmp = path.join(require('node:os').tmpdir(), `pr-guard-comment-${Date.now()}.md`);
    fs.writeFileSync(tmp, payload, 'utf8');
    execSync(`gh pr comment ${prNumber} --body-file ${tmp} --repo ${process.env.GITHUB_REPOSITORY || ''}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    fs.unlinkSync(tmp);
    console.log(`Posted summary comment to PR #${prNumber}.`);
  } catch (err) {
    console.error(`Failed to post comment to PR #${prNumber}: ${err.message}`);
    console.error('Tip: ensure gh is authenticated and GITHUB_REPOSITORY is set.');
    process.exitCode = process.exitCode || 1;
  }
}

function runBudget(args) {
  const { cap, stateDir } = args;
  const dir = stateDir || process.cwd();
  if (cap !== undefined) {
    state.setCap(dir, cap);
    console.log(`Monthly cap set to $${Number(cap).toFixed(2)} for month ${state.currentMonth()}.`);
  } else {
    const st = state.loadState(dir);
    console.log(`Month: ${st.month}`);
    console.log(`Cap: ${st.cap_usd == null ? 'unset' : '$' + Number(st.cap_usd).toFixed(2)}`);
    console.log(`Spent: $${Number(st.spent_usd || 0).toFixed(4)}`);
    console.log(`Runs logged: ${(st.runs || []).length}`);
  }
}

function printUsage() {
  console.log(`
PR Review Cost Guard v${VERSION} — local CLI that caps AI PR-review cost.

Usage:
  pr-review-cost-guard scan --diffs <dir> [--monthly-cap <usd>] [--report html|json|both] [--out <dir>] [--commit] [--post <pr-number>] [--config <path>] [--state-dir <dir>]
  pr-review-cost-guard scan --repo <dir> [--pr <n>] [--monthly-cap <usd>] ...
  pr-review-cost-guard budget [--cap <usd>] [--state-dir <dir>]

Examples:
  pr-review-cost-guard scan --diffs test/fixtures/sample-repo --monthly-cap 50 --out outputs/
  pr-review-cost-guard budget --cap 50
`);
}

function main(argv) {
  const cmd = argv[0];
  const rest = argv.slice(1);
  const get = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i !== -1 && i + 1 < rest.length ? rest[i + 1] : undefined;
  };
  const has = (name) => rest.includes(`--${name}`);

  if (cmd === 'help' || cmd === '--help' || cmd === '-h' || !cmd) {
    printUsage();
    return;
  }
  if (cmd === 'version' || cmd === '--version') {
    console.log(`${TOOL} v${VERSION}`);
    return;
  }
  if (cmd === 'scan') {
    const monthlyCap = get('monthly-cap') !== undefined ? Number(get('monthly-cap')) : undefined;
    runScan({
      diffsDir: get('diffs'),
      repoDir: get('repo'),
      prNumber: get('pr') !== undefined ? Number(get('pr')) : 1,
      monthlyCap,
      report: get('report') || 'both',
      outDir: get('out') || 'outputs',
      configPath: get('config'),
      commit: has('commit'),
      postPr: get('post'),
      stateDir: get('state-dir') || process.cwd(),
    });
    return;
  }
  if (cmd === 'budget') {
    runBudget({ cap: get('cap'), stateDir: get('state-dir') || process.cwd() });
    return;
  }
  console.error(`Unknown command: ${cmd}`);
  printUsage();
  process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { main, runScan, runBudget, readDiffsDir };
