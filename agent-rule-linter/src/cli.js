#!/usr/bin/env node

/**
 * agent-rule-linter CLI
 *
 * Usage:
 *   node src/cli.js [dir] [--json] [--out <dir>] [--hooks] [--ci] [--agent-hooks]
 *
 * Arguments:
 *   dir              Root directory to scan (default: current working directory)
 *   --json           Output JSON report to stdout
 *   --out <dir>      Write HTML/JSON reports to the given directory
 *   --hooks          Write generated pre-commit hooks to <out>/hooks/
 *   --ci             Write CI snippet to <out>/ci/
 *   --agent-hooks    Write agent hook snippets to <out>/agent-hooks/
 *
 * Exit codes:
 *   0 = all good (no violations detected — note: this linter is advisory by default)
 *   1 = some rules are machine-checkable (exit 0 for now to stay non-breaking)
 *   2 = usage / input error
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintDir, summarize, findRuleFiles } from './lib.js';

function parseArgs(argv) {
  const args = {
    dir: process.cwd(),
    json: false,
    out: null,
    hooks: false,
    ci: false,
    agentHooks: false,
  };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--out' && argv[i + 1]) { args.out = argv[++i]; continue; }
    if (a === '--hooks') { args.hooks = true; continue; }
    if (a === '--ci') { args.ci = true; continue; }
    if (a === '--agent-hooks') { args.agentHooks = true; continue; }
    if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      printUsage();
      process.exit(2);
    }
    positional.push(a);
  }
  if (positional.length > 0) args.dir = positional[0];
  return args;
}

function printUsage() {
  console.log(`Usage: node src/cli.js [dir] [--json] [--out <dir>] [--hooks] [--ci] [--agent-hooks]
  --json         Output JSON report to stdout
  --out <dir>    Write reports to <dir>
  --hooks        Write pre-commit hooks to <out>/hooks/
  --ci           Write CI snippet to <out>/ci/
  --agent-hooks  Write agent hook snippets to <out>/agent-hooks/`);
}

function renderHtml(results, summary, sourceDir) {
  const ts = new Date().toISOString();
  const rows = results.map((r) => `
    <tr class="${r.checkable ? 'checkable' : 'vague'}">
      <td><code>${escapeHtml(r.line)}</code></td>
      <td>${escapeHtml(r.rule.slice(0, 120))}</td>
      <td>${r.checkable ? '✅ Machine-checkable' : '❌ Vague / manual review'}</td>
      <td>${escapeHtml(r.reason)}</td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Agent Rule Linter Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 1000px; color: #222; }
    h1 { margin-bottom: 0.3rem; }
    .summary { margin: 1rem 0; padding: 0.75rem 1rem; background: #f7f7f7; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { background: #f0f0f0; }
    tr.checkable td:nth-child(3) { color: #1a7f37; }
    tr.vague td:nth-child(3) { color: #b3541e; }
    code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>Agent Rule Linter Report</h1>
  <p class="summary">
    <strong>${summary.total}</strong> rules total — <strong>${summary.checkable}</strong> machine-checkable, <strong>${summary.notCheckable}</strong> vague/manual.
    Generated ${ts}. Source: <code>${escapeHtml(sourceDir)}</code>
  </p>
  <table>
    <thead><tr><th>Line</th><th>Rule</th><th>Status</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function main(argv) {
  const args = parseArgs(argv);
  if (!existsSync(args.dir)) {
    console.error(`Error: directory does not exist: ${args.dir}`);
    return 2;
  }
  const files = findRuleFiles(args.dir);
  if (files.length === 0) {
    console.error(`No rule files found in ${args.dir} (looked for AGENTS.md, CLAUDE.md, CLAUDE-CODE.md, RULES.md, AGENT-RULES.md)`);
    return 0;
  }

  const results = lintDir(args.dir);
  const summary = summarize(results);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  const outDir = args.out || `reports/${ts}`;

  if (!args.json) {
    // Human-readable summary on stdout
    console.log(`Scanned ${files.length} rule file(s) in ${args.dir}`);
    console.log(`  Total rules: ${summary.total}`);
    console.log(`  Machine-checkable: ${summary.checkable}`);
    console.log(`  Vague / manual review: ${summary.notCheckable}`);
    if (summary.notCheckable > 0) {
      console.log('\nVague rules (manual review):');
      for (const r of results.filter((x) => !x.checkable)) {
        console.log(`  - ${r.rule.slice(0, 100)}`);
        console.log(`    Reason: ${r.reason}`);
      }
    }
  }

  // Write reports
  mkdirSync(outDir, { recursive: true });
  const written = [];

  const jsonPath = `${outDir}/report.json`;
  writeFileSync(jsonPath, JSON.stringify({ source: args.dir, summary, results }, null, 2));
  written.push(jsonPath);

  const htmlPath = `${outDir}/report.html`;
  writeFileSync(htmlPath, renderHtml(results, summary, args.dir));
  written.push(htmlPath);

  if (args.json) {
    console.log(JSON.stringify({ source: args.dir, summary, results }, null, 2));
  }

  // Optional: write enforcement artifacts
  const safeName = (s) => String(s || 'rule').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'rule';
  if (args.hooks) {
    const hooksDir = `${outDir}/hooks`;
    mkdirSync(hooksDir, { recursive: true });
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.checkable) continue;
      const name = `rule-${i + 1}-${safeName(r.line)}.sh`;
      writeFileSync(`${hooksDir}/${name}`, r.snippet.preCommit);
      written.push(`${hooksDir}/${name}`);
    }
  }

  if (args.ci) {
    const ciDir = `${outDir}/ci`;
    mkdirSync(ciDir, { recursive: true });
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.checkable) continue;
      const name = `rule-${i + 1}-${safeName(r.line)}.yml`;
      writeFileSync(`${ciDir}/${name}`, r.snippet.ci);
      written.push(`${ciDir}/${name}`);
    }
  }

  if (args.agentHooks) {
    const hooksDir = `${outDir}/agent-hooks`;
    mkdirSync(hooksDir, { recursive: true });
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.checkable) continue;
      const name = `rule-${i + 1}-${safeName(r.line)}.json`;
      writeFileSync(`${hooksDir}/${name}`, r.snippet.agentHook);
      written.push(`${hooksDir}/${name}`);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(written, null, 2));
  } else {
    console.log(`\nReports written to ${outDir}:`);
    for (const w of written) console.log(`  ${w}`);
  }

  // Always exit 0 — this linter is advisory and should not block by default.
  return 0;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const code = main(process.argv);
  process.exit(code);
}