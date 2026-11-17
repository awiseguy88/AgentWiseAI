# Model Alias Drift Guard

Self-hosted web service and CLI runner that detects silent behavioral drift in a live model alias by replaying a frozen golden prompt set and emitting per-task drift diffs, trend charts, and threshold-breach alerts.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Problem

Floating model aliases can change underneath you without notice. A silent checkpoint swap can alter tool-call arguments, output format, or refusal behavior while every validator and human review still passes. Manual transcript review and one-off migration evals only catch regressions when you run them; this tool runs on a **timer** against the live alias so a model that changes with zero code change, zero deploy, and zero announcement is detected the same day.

## What it does

- Loads a **bundled 30-task coding-agent golden fixture** plus optional user-defined tasks.
- Runs every task against the configured **live model alias** at temperature 0.
- Computes per-task pass/fail against a **frozen baseline** (tool calls, args, enum values, output format, latency, cost).
- Emits **HTML/JSON drift reports** with per-task diffs and a **non-zero exit code** when any metric drops beyond a configurable threshold.
- Schedules runs via **cron**, persists timestamped runs, and serves a **web dashboard** with drift-trend charts.
- Routes **alerts** (Slack/webhook/email/file/command) when a threshold is breached.
- Ships with **Docker Compose** deployment and an offline **smoke test**.

## Requirements

- Node.js 18+ (no runtime dependencies; Node.js standard library only)

## Quick start (offline smoke)

```bash
cd model-alias-drift-guard
npm test
# or
node tests/smoke.js
```

The smoke test runs entirely offline using stub mock adapters and bundled fixtures.

## CLI usage

```bash
# list bundled golden tasks
node src/cli.js tasks

# freeze a baseline from a known-good run
node src/cli.js baseline --adapter mock:tests/fixtures/mock-good.json

# run the golden suite against the live alias and emit a drift report
node src/cli.js run \
  --alias claude-sonnet \
  --adapter openai:claude-sonnet-4-6@https://api.anthropic.com \
  --baseline tests/fixtures/baseline.frozen.json \
  --thresholds thresholds.json \
  --alerts-file alerts.json \
  --out-dir ./drift-report

# start the web dashboard
node src/cli.js serve --port 3030

# start the cron scheduler (runs daily by default)
node src/cli.js schedule --cron "0 2 * * *"
```

### Model adapters

- `mock:<responses.json>` — deterministic offline responses keyed by task id. Used for CI/smoke and reproducible comparisons.
- `cmd:<shell command>` — runs a command with the prompt on stdin; expects JSON `{output,tool_calls,tokens_in,tokens_out,latency_ms}` on stdout.
- `openai:<model>@<baseUrl>` — OpenAI-compatible chat completions (`/v1/chat/completions`) at temperature 0. Reads `OPENAI_API_KEY` when set.
- `ollama:<model>@<baseUrl>` — calls Ollama `/api/generate` (opt-in network).
- `anthropic:<model>` — Anthropic Messages API at temperature 0. Reads `ANTHROPIC_API_KEY` when set.

### Thresholds

`thresholds.json` example:

```json
{
  "min_pass_rate": 1.0,
  "max_regressed": 0,
  "max_drift_score": 0.1,
  "alert_cooldown_ms": 3600000
}
```

A non-zero exit code is returned when any threshold is breached (use `--no-exit-code` to suppress).

### Alert routing

`alerts.json` example:

```json
{
  "alerts": [
    { "type": "slack", "target": "https://hooks.slack.com/services/..." },
    { "type": "webhook", "target": "https://example.com/drift-hook" },
    { "type": "email", "target": "oncall@example.com" },
    { "type": "file", "target": "./alerts.log" },
    { "type": "cmd", "target": "./notify.sh" }
  ],
  "alert_cooldown_ms": 3600000
}
```

Alerts fire when a run breaches thresholds.

## Web dashboard

`node src/cli.js serve` serves a static dashboard (vanilla HTML/CSS/JS, no build) with:

- KPI cards (alias, latest pass rate, regressed count, breach status)
- **Drift trend chart** plotting each stored run's pass rate over time against the frozen baseline, with breach markers and regressed-count bars
- Runs table and per-task run detail with diffs
- Baseline/thresholds/alerts panels

API endpoints: `/api/config`, `/api/runs`, `/api/runs/:id`, `/api/series`, `/api/baseline`, `/api/tasks`, `POST /api/runs`, `POST /api/alerts/test`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Services: `app` (dashboard on port 3030), `scheduler` (cron runner), `postgres` (optional persistent store backing). Run data is persisted in the `./data` volume.

## Acceptance criteria mapping

1. **Fixture:** `node src/cli.js run --adapter mock:tests/fixtures/mock-good.json --baseline tests/fixtures/baseline.frozen.json` runs the bundled 30-task golden set, produces `drift-report/report.html` and `drift-report/report.json` with per-task pass/fail vs the frozen baseline, and exits 0 when nothing drifts.
2. **Failure case:** `node src/cli.js run --adapter mock:tests/fixtures/mock-drifted.json --baseline tests/fixtures/baseline.frozen.json` flags exactly two regressed tasks (T-07: date arg `"2026-09-08"` → `"today"`, T-15: refusal → hallucinated tool call), prints per-task diffs, and exits non-zero.
3. **End-to-end:** `node src/cli.js schedule --cron "0 2 * * *"` stores timestamped runs under `data/`; `node src/cli.js serve` shows a drift-trend chart with each run plotted against the frozen baseline, and alerts fire when a threshold is breached.

## Project layout

- `src/cli.js` — CLI entry and commands
- `src/adapters.js` — model adapters (mock/cmd/openai/ollama/anthropic)
- `src/tasks.js` — golden-set loader
- `src/runner.js` — per-task execution and checks
- `src/baseline.js` — baseline freeze, diff, threshold evaluation
- `src/report.js` — HTML/JSON report builder
- `src/storage.js` — persistent run storage and series
- `src/scheduler.js` — cron parser and scheduler loop
- `src/alerts.js` — alert evaluation and routing
- `src/server.js` — (served by cli) HTTP dashboard/API
- `tasks/golden.json` — 30 bundled coding-agent tasks
- `tests/fixtures/` — stub models and frozen baseline
- `tests/smoke.js` — offline smoke test
- `web/` — static dashboard assets

## License

MIT (see [LICENSE](LICENSE)).

---
Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/