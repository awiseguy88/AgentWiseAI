# Agent Done Claim Verifier

Offline-first CLI for AI agents and developers that parses local agent session/transcript files, detects completion claims, matches them to nearby command results, and flags unbacked "done" claims before they waste review time.

It replaces manual transcript review and blind trust in agent summaries by labeling claimed-success turns as `verified` or `unverified` with reasons (such as stale green results, missing rebuild evidence, or a failing exit before a success claim) and emitting actionable reports plus starter hook-policy snippets.

## What it does

- Parses common local transcript formats offline:
  - JSON arrays/objects (`messages`, `events`, `turns`, `transcript`)
  - JSONL event streams
  - Plain-text transcripts with command/exit markers
- Detects completion claims (done/fixed, tests pass, build succeeded/built).
- Matches claims to nearby command results and flags unbacked claims:
  - `failing_exit_before_claim`
  - `stale_green`
  - `no_rebuild`
  - `no_command_result` / `no_matching_command_result`
- Emits:
  - `report.html` (human-readable, actionable)
  - `report.json` (machine-readable)
- Includes bundled starter hook-policy snippets for popular agent CLIs (Claude Code, Codex CLI, Aider, generic) — no network access or paid APIs required.

## Usage

```bash
node src/cli.js <transcript-file> [--out-dir DIR] [--json]
```

Examples:

```bash
# Analyze a sample transcript and write reports to ./done-claim-report
node src/cli.js test/fixtures/sample-transcript.jsonl

# Choose an output directory
node src/cli.js path/to/session.jsonl --out-dir ./out

# Print JSON report to stdout (reports are still written)
node src/cli.js path/to/session.json --json
```

Outputs by default:
- `<out-dir>/report.html`
- `<out-dir>/report.json`

## Sample transcript

A sample transcript with verified and unverified claims is included at `test/fixtures/sample-transcript.jsonl`.

## Hook-policy snippets

Starter local guardrail snippets are bundled in [`hooks/`](hooks/):

- [`hooks/claude-code.md`](hooks/claude-code.md)
- [`hooks/codex-cli.md`](hooks/codex-cli.md)
- [`hooks/aider.md`](hooks/aider.md)
- [`hooks/generic.md`](hooks/generic.md)

They provide policy/checklist templates to require fresh passing command evidence before accepting completion claims.

## Smoke check

```bash
npm test
# or
node test/smoke.js
```

The smoke check validates parsing, claim detection, verified/unverified labeling with reasons, report generation (HTML/JSON), and bundled hook snippets using the sample transcript.

## Files

- `src/parser.js` — transcript format detection and normalization
- `src/verifier.js` — claim detection and command-result matching/labeling
- `src/report.js` — HTML/JSON report rendering
- `src/snippets.js` — hook snippet loader
- `src/cli.js` — CLI entrypoint
- `hooks/` — starter hook-policy snippets
- `test/` — fixtures and smoke check

## About AaronWiseAI

AaronWiseAI builds practical online and offline tools for AI agents and developers. Visit https://aaronwiseai.com/

Part of the AaronWiseAI tool collection — https://aaronwiseai.com/
