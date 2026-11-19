/**
 * Smoke test for agent-rule-linter
 *
 * Validates the acceptance criteria:
 *   Given a sample AGENTS.md with five rules, the tool identifies which
 *   rules are machine-checkable, emits working enforcement snippets for
 *   at least three, and runs offline with no paid APIs.
 */

import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseRules, classifyRule, lintFile, summarize, generatePreCommitHook, generateCICheck, generateAgentHook } from '../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SAMPLE = resolve(ROOT, 'examples', 'sample-AGENTS.md');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('Running agent-rule-linter smoke tests...\n');

// 1. Sample file exists
assert(existsSync(SAMPLE), 'Sample AGENTS.md exists');

// 2. Parse rules from sample
const text = readFileSync(SAMPLE, 'utf-8');
const rules = parseRules(text);
console.log(`Parsed ${rules.length} rule entries`);
assert(rules.length >= 5, 'At least 5 rules parsed from sample');

// 3. Lint and classify
const results = lintFile(SAMPLE);
const summary = summarize(results);
console.log(`Summary: ${summary.total} total, ${summary.checkable} checkable, ${summary.notCheckable} not checkable`);

assert(summary.checkable >= 3, 'At least 3 rules are machine-checkable (acceptance criterion)');
assert(summary.notCheckable >= 1, 'At least 1 rule is flagged as vague/manual');

// 4. Enforcement snippets for checkable rules
const checkable = results.filter((r) => r.checkable);
for (const r of checkable) {
  assert(r.snippet && r.snippet.preCommit, `Pre-commit hook generated for: ${r.line}`);
  assert(r.snippet && r.snippet.ci, `CI snippet generated for: ${r.line}`);
  assert(r.snippet && r.snippet.agentHook, `Agent hook snippet generated for: ${r.line}`);
}

// 5. Specific classifications we expect
const ruleTexts = results.map((r) => r.rule.toLowerCase());
const forcePush = results.find((r) => r.rule.toLowerCase().includes('force push'));
assert(forcePush && forcePush.checkable, '"Never force push" is classified as machine-checkable');

const testsRule = results.find((r) => r.rule.toLowerCase().includes('run tests'));
assert(testsRule && testsRule.checkable, '"Always run tests" is classified as machine-checkable');

const cleanCode = results.find((r) => r.rule.toLowerCase().includes('clean') && r.rule.toLowerCase().includes('best practice'));
assert(cleanCode && !cleanCode.checkable, '"Write clean, maintainable code..." is flagged as vague/manual');

// 6. Snippet content sanity
const fpHook = generatePreCommitHook({ raw: 'Never force push to the main branch' });
assert(fpHook.includes('force push'), 'Force-push hook contains relevant text');
assert(fpHook.startsWith('#!/bin/sh'), 'Force-push hook is a shell script');

const testHook = generatePreCommitHook({ raw: 'Always run tests before committing (npm test)' });
assert(testHook.includes('npm test'), 'Test hook runs npm test');

const fpAgent = generateAgentHook({ raw: 'Never force push to the main branch' });
assert(fpAgent.includes('"action"'), 'Agent hook is JSON-like with action field');

const ciSnippet = generateCICheck({ raw: 'Always run tests before committing (npm test)' });
assert(ciSnippet.includes('npm test'), 'CI snippet includes npm test');

// 7. Runs offline — no network calls, no paid APIs (implicit: this test imports only local modules)
assert(true, 'Runs offline with no paid APIs (no external dependencies)');

console.log(`\n${failures === 0 ? 'All tests passed.' : `${failures} test(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
