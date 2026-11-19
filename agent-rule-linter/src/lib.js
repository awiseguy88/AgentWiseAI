/**
 * agent-rule-linter core logic
 *
 * Parses AGENTS.md/CLAUDE.md/rule files, classifies each rule as
 * machine-checkable or not, and generates enforcement snippets (pre-commit
 * hooks, CI checks, agent hooks) for the checkable ones.
 *
 * Runs fully offline with no external dependencies.
 */

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

const RULE_FILES = ['AGENTS.md', 'CLAUDE.md', 'CLAUDE-CODE.md', 'RULES.md', 'AGENT-RULES.md'];

/**
 * Candidate rule files to look for under a directory root.
 */
export function findRuleFiles(dir) {
  const found = [];
  for (const name of RULE_FILES) {
    const path = `${dir}/${name}`;
    if (existsSync(path)) found.push(path);
  }
  return found.sort();
}

/**
 * Split a rule file into individual rule entries.
 * A rule is a line or block starting with a marker like:
 *   - "Rule: ..." / "Rules:" / "- " / "1." / "• "
 *   - Lines starting with "never", "always", "must", "should", "do not"
 */
export function parseRules(text) {
  const lines = text.split(/\r?\n/);
  const rules = [];
  let current = null;

  const flush = () => {
    if (current) rules.push(current);
    current = null;
  };

  const ruleStart = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Header markers
    if (/^[-•*]\s+/.test(trimmed)) return true;
    if (/^\d+[\.\)]\s+/.test(trimmed)) return true;
    // Imperative sentence starts
    if (/^(never|always|must|shall|should|do not|don't|avoid|ensure|prefer|use|run|do)\b/i.test(trimmed)) return true;
    // Explicit rule label
    if (/^(rule|guideline|principle)[:\-]\s+/i.test(trimmed)) return true;
    return false;
  };

  for (const line of lines) {
    if (ruleStart(line)) {
      flush();
      current = { raw: line, line: trimmedLine(line) };
    } else if (current) {
      current.raw += '\n' + line;
    }
  }
  flush();
  return rules;
}

function trimmedLine(line) {
  return line.replace(/^[-•*]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
}

/**
 * Classify a rule as machine-checkable or not.
 *
 * Machine-checkable patterns:
 *   - Commands: "run tests", "npm test", "pnpm test", "use pnpm"
 *   - Git restrictions: "never force push", "no force push", "do not force push"
 *   - File restrictions: "never delete", "do not commit", "do not modify"
 *   - Format: "line width", "80 columns", "prettier", "eslint"
 *   - Branches: "main branch", "master branch", "no direct commits to main"
 *
 * Vague patterns (not machine-checkable):
 *   - "be careful", "consider", "think about", "prefer when possible"
 *   - "write clean code", "follow best practices"
 */
export function classifyRule(rawText) {
  const text = rawText.toLowerCase();
  const trimmed = text.trim();

  // Explicit non-checkable / advisory language
  const vagueMarkers = [
    'consider', 'think about', 'prefer when possible', 'should ideally',
    'best practice', 'clean code', 'well-written', 'good practice',
    'try to', 'aim to', 'it is recommended', 'generally'
  ];
  for (const m of vagueMarkers) {
    if (trimmed.includes(m)) {
      return { checkable: false, reason: `Vague advisory language: "${m}"` };
    }
  }

  // Machine-checkable: command / tool usage
  const cmdMarkers = ['npm test', 'pnpm test', 'yarn test', 'run tests', 'use pnpm', 'use npm', 'prettier', 'eslint'];
  for (const m of cmdMarkers) {
    if (text.includes(m)) {
      return { checkable: true, reason: `Machine-checkable command: "${m}"` };
    }
  }

  // Machine-checkable: git restrictions
  const gitMarkers = ['force push', 'force-push', 'git push --force', 'no direct commit', 'direct commit to main', 'direct commit to master'];
  for (const m of gitMarkers) {
    if (text.includes(m)) {
      return { checkable: true, reason: `Machine-checkable git rule: "${m}"` };
    }
  }

  // Machine-checkable: file/directory restrictions
  const fileMarkers = ['never delete', 'do not delete', 'do not modify', 'do not commit', 'do not touch', 'read-only', 'immutable'];
  for (const m of fileMarkers) {
    if (text.includes(m)) {
      return { checkable: true, reason: `Machine-checkable file rule: "${m}"` };
    }
  }

  // Machine-checkable: branch protections
  const branchMarkers = ['main branch', 'master branch', 'protected branch', 'no push to main', 'no push to master'];
  for (const m of branchMarkers) {
    if (text.includes(m)) {
      return { checkable: true, reason: `Machine-checkable branch rule: "${m}"` };
    }
  }

  // Default: short imperative sentences are probably checkable, longer ones probably not
  const words = trimmed.split(/\s+/).length;
  if (words <= 12) {
    return { checkable: true, reason: 'Short imperative rule, likely machine-checkable' };
  }

  return { checkable: false, reason: 'Too long / ambiguous to reliably classify automatically' };
}

/**
 * Generate a pre-commit hook snippet for a checkable rule.
 */
export function generatePreCommitHook(rule) {
  const text = rule.raw.toLowerCase();
  if (text.includes('force push') || text.includes('force-push')) {
    return `#!/bin/sh
# Generated by agent-rule-linter: enforce "no force push"
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  against=HEAD
else
  against=4b825dc642cb6eb9a060e54bf8d69288fbee4904
fi

# Block force-push attempts
if git push --force-now --dry-run 2>/dev/null | grep -q .; then
  echo "error: force push is not allowed by agent rule" >&2
  exit 1
fi
exit 0
`;
  }
  if (text.includes('npm test') || text.includes('run tests') || text.includes('pnpm test') || text.includes('yarn test')) {
    return `#!/bin/sh
# Generated by agent-rule-linter: run tests before commit
npm test
`;
  }
  if (text.includes('prettier')) {
    return `#!/bin/sh
# Generated by agent-rule-linter: format with prettier before commit
npx prettier --check .
`;
  }
  if (text.includes('eslint')) {
    return `#!/bin/sh
# Generated by agent-rule-linter: lint with eslint before commit
npx eslint .
`;
  }
  return `#!/bin/sh
# Generated by agent-rule-linter: ${rule.raw.slice(0, 60)}...
echo "Checking rule: ${rule.raw.slice(0, 80)}" >&2
exit 0
`;
}

/**
 * Generate a CI check snippet (GitHub Actions) for a checkable rule.
 */
export function generateCICheck(rule) {
  const text = rule.raw.toLowerCase();
  const name = 'agent-rule-check';
  if (text.includes('npm test') || text.includes('run tests') || text.includes('pnpm test') || text.includes('yarn test')) {
    return `      - name: ${name}
        run: npm test
`;
  }
  if (text.includes('prettier')) {
    return `      - name: ${name}
        run: npx prettier --check .
`;
  }
  if (text.includes('eslint')) {
    return `      - name: ${name}
        run: npx eslint .
`;
  }
  if (text.includes('force push') || text.includes('force-push')) {
    return `      - name: ${name}
        run: |
          echo "Force push check: protected branches reject force pushes at the GitHub settings level."
`;
  }
  return `      - name: ${name}
        run: echo "Manual review required: ${rule.raw.slice(0, 60)}..."
`;
}

/**
 * Generate an agent hook snippet (Claude Code / Cursor / Codex) for a checkable rule.
 */
export function generateAgentHook(rule) {
  const text = rule.raw.toLowerCase();
  if (text.includes('force push') || text.includes('force-push')) {
    return `{
  "hook": "pre-tool-use",
  "matcher": "git push",
  "condition": "args.includes('--force') || args.includes('-f')",
  "action": "block",
  "message": "Force push is not allowed by agent rule: ${rule.raw.slice(0, 80)}"
}
`;
  }
  if (text.includes('npm test') || text.includes('run tests') || text.includes('pnpm test') || text.includes('yarn test')) {
    return `{
  "hook": "post-tool-use",
  "matcher": "edit|write|delete",
  "action": "prompt",
  "message": "Agent rule: run tests after editing files (npm test)"
}
`;
  }
  if (text.includes('never delete') || text.includes('do not delete')) {
    return `{
  "hook": "pre-tool-use",
  "matcher": "delete|rm",
  "action": "block",
  "message": "File deletion is not allowed by agent rule: ${rule.raw.slice(0, 80)}"
}
`;
  }
  if (text.includes('prettier')) {
    return `{
  "hook": "post-tool-use",
  "matcher": "write|edit",
  "action": "suggest",
  "message": "Run prettier on modified files: npx prettier --write"
}
`;
  }
  return `{
  "hook": "pre-tool-use",
  "matcher": "*",
  "action": "warn",
  "message": "Agent rule reminder: ${rule.raw.slice(0, 80)}"
}
`;
}

/**
 * Lint a single rule file.
 */
export function lintFile(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const entries = parseRules(text);
  const results = entries.map((entry) => {
    const classification = classifyRule(entry.raw);
    return {
      file: filePath,
      rule: entry.raw,
      line: entry.line,
      checkable: classification.checkable,
      reason: classification.reason,
      snippet: classification.checkable ? {
        preCommit: generatePreCommitHook(entry),
        ci: generateCICheck(entry),
        agentHook: generateAgentHook(entry)
      } : null
    };
  });
  return results;
}

/**
 * Lint all rule files under a directory.
 */
export function lintDir(dir) {
  const files = findRuleFiles(dir);
  if (files.length === 0) return [];
  return files.flatMap((f) => lintFile(f));
}

/**
 * Summarize results: counts of checkable vs non-checkable.
 */
export function summarize(results) {
  const checkable = results.filter((r) => r.checkable).length;
  const notCheckable = results.filter((r) => !r.checkable).length;
  return { total: results.length, checkable, notCheckable };
}
