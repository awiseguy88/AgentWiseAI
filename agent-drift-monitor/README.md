# Agent Drift & Step-Level Monitor

Small, self-contained, **offline-first** tool that parses common agent session/trace formats and emits step-level HTML/JSON reports.

## What it does
- Parses local trace files (`.json` / `.jsonl`) in common shapes: generic step lists, span-style traces, and OpenAI/agent logs with `tool_calls`.
- Times each step/tool call (from explicit timestamps/durations or inferred fields).
- Ties token spend to specific steps and spans (prompt/completion/total where available).
- Detects alerts:
  - **Threshold flags**: step duration and/or token count above configured limits.
  - **Runaway loops**: repeated tool+input patterns, repeated outputs, or oscillating step signatures.
  - **Drift signals**: rising token spend, rising latency, or declining quality/score trend across steps.
- Outputs `report.json` and `report.html` with step-level breakdowns and alerts. No network access, no paid APIs.

## Install / run
Requires Node.js >= 20 (no npm dependencies).

```bash
cd agent-drift-monitor
node src/cli.js --input examples/sample-trace.json --out reports/demo --json --html
```

Options:
- `--input <path>` trace file (`.json` or `.jsonl`) (required)
- `--out <dir>` output directory (default: `reports/<timestamp>`)
- `--json` write `report.json`
- `--html` write `report.html` (default if neither specified)
- `--max-step-ms <n>` duration threshold in ms (default: 5000)
- `--max-step-tokens <n>` token threshold per step (default: 2000)
- `--loop-repeat <n>` repeat count to flag a loop pattern (default: 3)

## Trace format support
The parser normalizes best-effort from:
- `{ "steps": [...] }` / `{ "events": [...] }` / arrays of step objects
- Span traces with `spans`, `start_time`/`end_time` or `duration_ms`
- Agent messages with `tool_calls`, `function`, `usage`/`token_usage`
- JSONL (one event/span per line)

Recognized fields (when present): `name`/`tool`/`type`, `start`/`end`/`duration_ms`/`latency_ms`, `tokens`/`total_tokens`/`usage.prompt_tokens`/`usage.completion_tokens`, `input`/`arguments`, `output`/`result`, `quality`/`score`/`success`.

## Output
- `report.json`: normalized steps, per-step metrics, aggregates, and alerts.
- `report.html`: offline report with summary, alert list, and a step-level breakdown table.

## Tests / smoke check
```bash
npm test
npm run smoke
```

## Limitations
- Format detection is heuristic; unknown fields are preserved in raw step data but may not be timed/attributed.
- Drift/loop detection is pattern-based over the provided trace (not a trained model).
