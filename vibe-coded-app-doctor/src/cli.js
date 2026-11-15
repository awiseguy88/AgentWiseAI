#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { scanProject } = require('./scanner');
const { renderHtmlReport } = require('./report');

function usage() {
  console.error('Usage: vibe-coded-app-doctor <path-to-project> [--out report.html] [--json]');
  console.error('  Scans a codebase offline for common AI-generated app mistakes and writes a prioritized HTML report.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  let target = null;
  let outPath = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') { outPath = args[++i]; }
    else if (a === '--json') { json = true; }
    else if (!a.startsWith('-')) { target = a; }
    else { console.error('Unknown option:', a); usage(); process.exit(1); }
  }
  if (!target) { usage(); process.exit(1); }
  const root = path.resolve(process.cwd(), target);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error('Target is not a directory:', root);
    process.exit(2);
  }
  const result = scanProject(root);
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }
  const html = renderHtmlReport(result);
  const dest = path.resolve(process.cwd(), outPath || path.join(root, 'vibe-doctor-report.html'));
  fs.writeFileSync(dest, html, 'utf8');
  const catCount = new Set(result.issues.map(i => i.category)).size;
  console.log(`Report written: ${dest}`);
  console.log(`Issues: ${result.issues.length} across ${catCount} categories (files scanned: ${result.stats.filesScanned})`);
  if (result.issues.some(i => i.severity === 'high')) process.exitCode = 0; // report-only tool
}

main();
