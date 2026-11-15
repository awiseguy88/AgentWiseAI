# PLAN: Agent Drift & Step-Level Monitor

## Goal
Build a small, self-contained, offline-first CLI tool that parses common agent session/trace formats, attributes timing and token spend to each step/span, detects threshold breaches, quality/token drift, and runaway loops, and emits actionable HTML/JSON reports.

## User-facing behavior
- User runs `node src/cli.js --input <trace.json|jsonl> [--out dir] [--json] [--html] [threshold options]`.
- Tool reads a local trace file only (no network, no paid APIs) and normalizes steps/spans/tool calls.
- For each step it reports: name/type/span, duration, prompt/completion/total tokens, and previews.
- It flags steps exceeding duration/token thresholds and emits alerts for drift (token/latency up, quality down trends) and runaway loops (repeated signatures/outputs).
- Outputs `report.json` and/or `report.html` in the chosen output directory with summary, span breakdown, alerts, and step-level table.

## Files and modules
- `PLAN.md` — this build plan.
- `package.json` — metadata, bin, `test` and `smoke` scripts (Node built-ins only).
- `README.md` — purpose, usage, supported formats/fields, outputs, tests, limitations.
- `src/cli.js` — argument parsing, file I/O, orchestration, exit codes.
- `src/lib.js` — trace loading, normalization/parsing, metric extraction, drift/loop/threshold analysis, report object assembly.
- `src/report.js` — JSON and offline HTML report rendering/writing.
- `examples/sample-trace.json` — sample trace covering steps, tool calls, spans, timing, tokens, a loop pattern, and drift signals for acceptance/smoke.
- `test/smoke.test.js` (and/or unit-style checks) — Node `--test` smoke/acceptance checks run offline.

## Test strategy
- Automated smoke/acceptance via `node --test`: run parser+analysis on `examples/sample-trace.json` and assert step listing with duration/token counts, threshold flagging, at least one drift or loop detection, and JSON/HTML report generation without network access.
- Manual/CLI smoke: `npm run smoke` (or direct `node src/cli.js ...`) writes reports to `reports/smoke` for inspection.
- Keep tests deterministic and self-contained using local fixtures only.

## Acceptance checks
- Given a sample agent trace, tool lists each step with duration and token count in JSON/HTML output.
- Steps exceeding configured thresholds are flagged.
- Detects at least one drift or loop pattern from the sample trace.
- Produces actionable `report.json` and/or `report.html` offline with no network access or paid APIs.
- Tool lives in its own subfolder with README and smoke/test coverage, independent of other tools/workspaces.
