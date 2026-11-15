#!/usr/bin/env node
'use strict';

// Model API Watch CLI
// Scans a project for hard-coded model IDs and prints a report of affected
// models: change date, new price or failure mode, suggested replacement, and
// cost impact. Fully offline; no accounts, no paid APIs.

const fs = require('fs');
const path = require('path');
const { scanProject } = require('./scanner');
const { allEntries } = require('./registry');

function usage() {
  console.error('Usage: model-api-watch <path-to-project> [--json]');
  console.error('  Scans a project for hard-coded model IDs and reports affected');
  console.error('  models (change date, new price or failure mode, replacement,');
  console.error('  cost impact). Offline: no accounts, no paid APIs.');
  console.error('');
  console.error('Options:');
  console.error('  --json     Print the raw scan result as JSON instead of a report');
  console.error('  -h, --help Show this help');
}

function formatText(result) {
  const lines = [];
  const { findings, stats } = result;
  lines.push('Model API Watch — affected models report');
  lines.push(`Scanned: ${result.root}`);
  lines.push(`Files scanned: ${stats.filesScanned} | model references found: ${stats.modelsFound}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('No affected models found in this project.');
    lines.push('');
    lines.push(`Registry tracks ${allEntries().length} known changes. Run again after updating the bundled registry.`);
    return lines.join('\n');
  }

  const grouped = new Map();
  for (const f of findings) {
    const key = f.entry.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(f);
  }

  for (const [, refs] of grouped) {
    const entry = refs[0].entry;
    const foundIds = [...new Set(refs.map(r => r.modelId))];
    const where = [...new Set(refs.map(r => `${r.file}:${r.line}`))];
    const label = foundIds.length === 1 ? foundIds[0] : foundIds.join(', ');
    lines.push(`Model: ${label} (${entry.name})`);
    lines.push(`  Change:    ${entry.change} — effective ${entry.effectiveDate}`);
    lines.push(`  Price:     ${entry.oldPrice}  ->  ${entry.newPrice}`);
    lines.push(`  Replace:   ${entry.replacement}`);
    lines.push(`  Cost:      ${entry.costImpact}`);
    lines.push(`  Seen at:   ${where.slice(0, 8).join(', ')}${where.length > 8 ? ` (+${where.length - 8} more)` : ''}`);
    lines.push(`  Note:      ${entry.note}`);
    lines.push('');
  }

  lines.push(`${grouped.size} affected model(s).`);
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  let target = null;
  let json = false;
  for (const a of args) {
    if (a === '--json') { json = true; }
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
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
    console.log(JSON.stringify({
      root: result.root,
      stats: result.stats,
      findings: result.findings.map(f => ({
        modelId: f.modelId,
        file: f.file,
        line: f.line,
        snippet: f.snippet,
        change: f.entry.change,
        effectiveDate: f.entry.effectiveDate,
        oldPrice: f.entry.oldPrice,
        newPrice: f.entry.newPrice,
        replacement: f.entry.replacement,
        costImpact: f.entry.costImpact,
        note: f.entry.note,
      })),
    }, null, 2));
    return;
  }

  console.log(formatText(result));
}

main();