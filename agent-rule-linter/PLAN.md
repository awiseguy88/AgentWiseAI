# Agent Rule Linter — Plan

## Goal
Implement issue #43: a local CLI that parses AGENTS.md/CLAUDE.md/rule files, classifies each rule as machine-checkable or not, generates pre-commit hooks, CI checks, and agent-hook snippets for the checkable ones, and flags vague rules for manual review.

## Acceptance criteria
Given a sample AGENTS.md with five rules, the tool:
- identifies which rules are machine-checkable
- emits working enforcement snippets for at least three
- runs offline with no paid APIs

## Approach
- `src/lib.js`: parse rule files, extract individual rules, classify each rule (machine-checkable vs vague) using heuristic keyword/pattern matching, generate pre-commit hook, CI, and agent-hook snippets for checkable rules.
- `src/cli.js`: CLI entry point — scans a directory for rule files, prints summary, writes JSON/HTML reports and optional enforcement artifacts.
- `examples/sample-AGENTS.md`: sample with 5 rules covering checkable and vague cases.
- `test/smoke.js`: node:test-free smoke script asserting acceptance criteria.

## Non-goals
- No paid APIs, no network calls.
- No full NLP/LLM-based classification — heuristic is sufficient for MVP.
- No automatic installation of hooks into `.git/hooks` (snippets are emitted for user review).
