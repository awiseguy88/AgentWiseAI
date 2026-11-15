#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { readTranscript } = require('../src/parser');
const { analyze } = require('../src/verifier');
const { loadSnippets } = require('../src/snippets');

function main() {
  const fixture = path.join(__dirname, 'fixtures', 'sample-transcript.jsonl');
  const { events, format } = readTranscript(fixture);
  assert(events.length > 0, 'expected parsed events');
  assert(format === 'jsonl', `expected jsonl format, got ${format}`);

  const result = analyze(events);
  const { claims, summary } = result;
  assert(claims.length >= 4, `expected >=4 claims, got ${claims.length}`);
  assert(summary.total === claims.length, 'summary total mismatch');
  for (const c of claims) {
    assert(c.status === 'verified' || c.status === 'unverified', `invalid status: ${c.status}`);
    assert(Array.isArray(c.reasons) && c.reasons.length > 0, 'each claim should have reasons');
  }

  const verified = claims.filter(c => c.status === 'verified');
  const unverified = claims.filter(c => c.status === 'unverified');
  assert(verified.length >= 1, 'expected at least one verified claim');
  assert(unverified.length >= 3, 'expected multiple unverified claims');

  const reasonsText = unverified.flatMap(c => c.reasons).join('\n');
  assert(/failing_exit_before_claim/.test(reasonsText), 'expected failing_exit_before_claim reason');
  assert(/stale_green/.test(reasonsText), 'expected stale_green reason');
  assert(/no_rebuild|no_matching_command_result/.test(reasonsText), 'expected no_rebuild or no matching command result reason');

  const snippets = loadSnippets();
  assert(snippets.length >= 4, 'expected bundled hook snippets');
  for (const s of snippets) {
    assert(fs.existsSync(path.join(__dirname, '..', s.file)), `missing snippet file ${s.file}`);
    assert(s.content && s.content.length > 20, `snippet ${s.file} should have content`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcv-smoke-'));
  const cli = path.join(__dirname, '..', 'src', 'cli.js');
  execFileSync(process.execPath, [cli, fixture, '--out-dir', tmp], { stdio: 'pipe' });
  const htmlPath = path.join(tmp, 'report.html');
  const jsonPath = path.join(tmp, 'report.json');
  assert(fs.existsSync(htmlPath), 'report.html not generated');
  assert(fs.existsSync(jsonPath), 'report.json not generated');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert(/Agent Done Claim Verifier Report/.test(html), 'HTML missing title');
  assert(/verified/.test(html) && /unverified/.test(html), 'HTML missing status labels');
  assert(/Starter hook-policy snippets/.test(html), 'HTML missing hook snippets section');
  assert(report.summary && report.summary.total === claims.length, 'JSON summary mismatch');
  assert(Array.isArray(report.claims) && report.claims.length === claims.length, 'JSON claims mismatch');
  assert(Array.isArray(report.hookSnippets) && report.hookSnippets.length >= 4, 'JSON missing hook snippets');

  console.log('Smoke check passed.');
  console.log(`Claims: ${summary.total}, verified: ${summary.verified}, unverified: ${summary.unverified}`);
}

main();
