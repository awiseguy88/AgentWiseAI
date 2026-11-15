#!/usr/bin/env node
/**
 * Smoke Test: AI Code Disclosure Manifest
 * Tests the CLI against fixture repositories with known AI markers
 */

const { execSync } = require('child_process');
const { join } = require('path');
const { existsSync, readFileSync } = require('fs');

const CLI = join(__dirname, '..', 'bin', 'ai-disclose');
const FIXTURES = join(__dirname, 'fixtures', 'repos');
const AI_MARKERS = join(FIXTURES, 'fixture-ai-markers');
const CLEAN_REPO = join(FIXTURES, 'fixture-clean');
const MIXED_REPO = join(FIXTURES, 'fixture-mixed');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function runCLI(args, expectedExit = 0) {
  try {
    const output = execSync(`node ${CLI} ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { exit: 0, stdout: output, stderr: '' };
  } catch (e) {
    return { exit: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

// Test 1: JSON output from AI markers repo
console.log('\n=== Test 1: JSON output from AI markers repo ===');
{
  const result = runCLI(`scan ${AI_MARKERS} -f json`);
  assert(result.exit === 0, 'JSON scan exits successfully');
  
  try {
    const json = JSON.parse(result.stdout);
    assert(json.manifestVersion === '1.0', 'Has manifest version 1.0');
    assert(json.repository.includes('fixture-ai-markers'), 'Repository path is correct');
    assert(json.summary.totalFindings > 0, 'Total findings > 0 (has AI markers)');
    assert(json.summary.byConfidence.high > 0, 'Has high-confidence findings');
    assert(json.findings.commits.length > 0, 'Has commit findings');
    assert(json.findings.files.length > 0, 'Has file findings');
    assert(json.templates.disclosure.length > 0, 'Has disclosure template');
    assert(json.templates.attribution.length > 0, 'Has attribution template');
    assert(json.templates.cc0.length > 0, 'Has CC0 template');
    assert(json.templates.oss.length > 0, 'Has OSS template');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
  }
}

// Test 2: HTML output from AI markers repo
console.log('\n=== Test 2: HTML output from AI markers repo ===');
{
  const tmpFile = '/tmp/test-disclosure.html';
  const result = runCLI(`scan ${AI_MARKERS} -f html -o ${tmpFile}`);
  assert(result.exit === 0, 'HTML scan exits successfully');
  
  if (existsSync(tmpFile)) {
    const html = readFileSync(tmpFile, 'utf8');
    assert(html.includes('<!DOCTYPE html>'), 'HTML has DOCTYPE');
    assert(html.includes('AI Code Disclosure Manifest'), 'HTML has title');
    assert(html.includes('badge-high') || html.includes('badge-medium'), 'HTML has confidence badges');
    assert(html.includes('DISCLOSURE') || html.includes('disclosure'), 'HTML has disclosure template');
    assert(html.includes('CC0') || html.includes('cc0'), 'HTML has CC0 template');
    // Self-contained check
    assert(!html.includes('src="http') && !html.includes('href="http') && !html.includes('url(http'), 'HTML is self-contained (no external URLs)');
  }
}

// Test 3: Templates output
console.log('\n=== Test 3: Templates output ===');
{
  const result = runCLI(`templates ${AI_MARKERS} -f templates`);
  assert(result.exit === 0, 'Templates command exits successfully');
  assert(result.stdout.includes('DISCLOSURE NOTICE'), 'Has disclosure notice header');
  assert(result.stdout.includes('ATTRIBUTION NOTICE'), 'Has attribution notice header');
  assert(result.stdout.includes('CC0 DEDICATION'), 'Has CC0 dedication header');
  assert(result.stdout.includes('OSS NOTICE'), 'Has OSS notice header');
  assert(result.stdout.includes('AaronWiseAI'), 'Has AaronWiseAI branding');
  assert(result.stdout.includes('https://aaronwiseai.com/'), 'Has AaronWiseAI URL');
}

// Test 4: Clean repo should have minimal findings
console.log('\n=== Test 4: Clean repo (no AI markers) ===');
{
  const result = runCLI(`scan ${CLEAN_REPO} -f json`);
  assert(result.exit === 0, 'Clean repo scan exits successfully');
  
  try {
    const json = JSON.parse(result.stdout);
    assert(json.summary.totalFindings === 0, `Clean repo has 0 findings (got ${json.summary.totalFindings})`);
    assert(json.summary.byConfidence.high === 0, 'Clean repo has 0 high-confidence');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
  }
}

// Test 5: Quick scan
console.log('\n=== Test 5: Quick scan (git only) ===');
{
  const result = runCLI(`quick ${AI_MARKERS} -f json`);
  assert(result.exit === 0, 'Quick scan exits successfully');
  
  try {
    const json = JSON.parse(result.stdout);
    assert(json.scanInfo.options.mode === 'quick', 'Mode is quick');
    assert(json.summary.commitsWithFindings > 0, 'Quick scan finds commit markers');
    assert(json.summary.filesScanned === 0, 'Quick scan does not scan files');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
  }
}

// Test 6: Confidence filtering
console.log('\n=== Test 6: Confidence filtering ===');
{
  const resultHigh = runCLI(`scan ${AI_MARKERS} -f json --confidence high`);
  assert(resultHigh.exit === 0, 'High-confidence filter exits successfully');
  
  try {
    const jsonHigh = JSON.parse(resultHigh.stdout);
    const highOnly = jsonHigh.findings.commits
      .flatMap(c => c.findings)
      .filter(f => f.confidence === 'high').length;
    const allHighInResult = jsonHigh.findings.commits
      .flatMap(c => c.findings)
      .every(f => f.confidence === 'high');
    assert(allHighInResult, 'All findings in high-only scan are high confidence');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
  }
}

// Test 7: Mixed repo
console.log('\n=== Test 7: Mixed repo ===');
{
  const result = runCLI(`scan ${MIXED_REPO} -f json`);
  assert(result.exit === 0, 'Mixed repo scan exits successfully');
  
  try {
    const json = JSON.parse(result.stdout);
    assert(json.summary.commitsScanned > 5, `Has multiple commits (${json.summary.commitsScanned})`);
    assert(json.summary.commitsWithFindings > 0, 'Has at least one commit with findings');
    assert(json.summary.commitsWithFindings < json.summary.commitsScanned, 'Not all commits have findings');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
  }
}

// Test 8: Error handling (not a git repo)
console.log('\n=== Test 8: Error handling ===');
{
  const result = runCLI(`scan /tmp -f json`, 1);
  assert(result.exit === 1, 'Exits with error for non-git path');
  assert(result.stderr.includes('Not a git repository') || result.stderr.includes('Error'), 'Shows error message');
}

// Test 9: Help and version
console.log('\n=== Test 9: Help and version ===');
{
  const resultHelp = runCLI(`--help`);
  assert(resultHelp.exit === 0, 'Help exits successfully');
  assert(resultHelp.stdout.includes('Usage:') || resultHelp.stdout.includes('usage:'), 'Help shows usage');
  assert(resultHelp.stdout.includes('AaronWiseAI'), 'Help shows AaronWiseAI branding');

  const resultVersion = runCLI(`--version`);
  assert(resultVersion.exit === 0, 'Version exits successfully');
  assert(resultVersion.stdout.includes('1.0.0'), 'Shows version 1.0.0');
}

// Summary
console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '✓ All tests passed!' : '✗ Some tests failed');

process.exit(failed === 0 ? 0 : 1);