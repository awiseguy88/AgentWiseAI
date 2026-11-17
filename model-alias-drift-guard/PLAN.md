# Build plan — Model Alias Drift Guard

## Goal
A self-hosted web service + CLI runner that guards floating model aliases against silent drift. It loads a golden prompt set (bundled 30-task coding-agent fixture plus user-defined tasks), runs every task against the configured live model alias at temperature 0, compares each run against a frozen baseline (tool calls, args, enum values, output format, latency, cost), and emits an HTML/JSON drift report with per-task diffs and a non-zero exit code when any metric drops beyond a configurable threshold. A cron scheduler runs the suite daily/weekly, results persist, a web dashboard shows drift-trend charts, alert routing fires on threshold breaches, and Docker Compose ships app + scheduler + Postgres.

## Users
Developers and engineering teams running AI coding, support, triage, RAG, or voice agents in production who pin a model alias in config and need to detect model-behind-alias changes before users do.

## Files
- `package.json` — manifest: name `model-alias-drift-guard`, `bin` → `src/cli.js`, `homepage` https://aaronwiseai.com/, license MIT, `npm test` runs offline smoke; no runtime deps.
- `LICENSE` — MIT license text.
- `README.md` — About AaronWiseAI section with required sentence, About footer line, usage, adapters, thresholds, scheduler, dashboard, alerts, Docker Compose, acceptance mapping; ends with the required footer line.
- `PLAN.md` — this file (goal, users, files, milestones, test strategy, acceptance checks).
- `src/cli.js` — CLI entry: commands `run`, `baseline`, `serve`, `schedule`, `tasks`, `smoke`, `help`; arg parsing, model-alias/adapter selection, baseline/threshold loading, store location, run execution, report writing, exit codes.
- `src/adapters.js` — model invocation adapters: `mock:<file>` (deterministic offline), `cmd:<shell>` (JSON on stdin/stdout), `ollama:<model>@<base>`, `openai:<model>@<base>` (OpenAI-compatible API), `anthropic:<model>`. Each returns `{output, tool_calls, tokens, latency_ms}`.
- `src/tasks.js` — `loadGoldenTasks()` from `tasks/` (bundled + user `--tasks-dir`), prompt/checker contract.
- `src/runner.js` — `runTask(task, adapterSpec)`: executes task at temperature 0, captures tool calls/args/output/latency/cost, runs per-task checks → per-task result.
- `src/baseline.js` — `freezeBaseline(results)` → baseline JSON; `driftDiff(baselineTask, currentTask)` → per-task diff + drift score; `statusAgainstBaseline(...)` → task status (pass/regressed/error).
- `src/report.js` — `buildReport(runMeta, baseline, results)` aggregated object + `renderHtml(report)` (readable HTML with per-task diffs) + `writeReport(outDir)` writes `report.json` and `report.html`.
- `src/storage.js` — persistent run storage: `data/runs/<runId>.json` full runs + `data/index.json` summary index; atomic writes; `listRuns`, `getRun`, `appendRun`, `series(alias, limit)`.
- `src/scheduler.js` — cron (5-field) parser, next-run computation, background run loop triggered by next run, programmatic `runOnce`, and config (cron expression, max runs per process).
- `src/alerts.js` — alert evaluation from a run vs baseline; channels: slack webhook, generic webhook, email via local `sendmail`, pluggable shell command; cooldown state in `data/alert-state.json`.
- `src/server.js` — HTTP service: static `web/` dashboard + JSON API (`/api/runs`, `/api/runs/:id`, `/api/series`, `/api/baseline`, `/api/config`, `/api/tasks`, `POST /api/runs`, `POST /api/alerts/test`).
- `web/index.html`, `web/styles.css`, `web/app.js` — offline single-page dashboard: KPI cards, hand-drawn SVG drift-trend chart (pass rate vs baseline + regressed-count bars), runs table, run/task drift detail, baseline/thresholds/alerts panels.
- `tasks/golden.json` — 30 bundled coding-agent fixture tasks (id, title, tags, prompt, tools, expect: tool_sequence/tool_args/enums/output_format/forbid_tools/contains_all/not_contains/refusal_expected).
- `tests/fixtures/mock-good.json` — stub model responses matching baseline (30 tasks pass).
- `tests/fixtures/mock-drifted.json` — stub model with two silent regressions (T-07 date arg "2026-09-08"→"today"; T-15 refusal replaced by hallucinated tool call).
- `tests/fixtures/baseline.frozen.json` — frozen baseline generated from mock-good.
- `tests/smoke.js` — offline smoke test: spawns CLI on mock-good (exit 0, report exists, 30 pass, no regressions); mock-drifted (exit non-zero, exactly 2 regressed, per-task diff printed); scheduler `runOnce` stores timestamped run; series endpoint includes run plotted against baseline; alert channel fires on breach; cron next-run computation.
- `docker-compose.yml` — app + scheduler + Postgres service definitions; volumes for `data/`.
- `Dockerfile` — Node runtime image, copies app, runs CLI/server.
- `.env.example` — example env (alias, adapter, pricing, alerts, cron).

## Milestones
- **M1 (this ticket)**: CLI runner, bundled 30-task golden suite, stub mock adapters, frozen baseline, per-task drift diffs, HTML/JSON report, non-zero exit on threshold breach, cron scheduler, persistent run storage, alert routing, web dashboard with trend charts, smoke test, PLAN.md/LICENSE/README/package.json homepage/Docker Compose, root README tool table entry, merged PR.
- **M2 (future)**: persistent accounts/project workspaces, multi-model comparison, auto-failover recommendations, background polling of model release feeds, CI gating, compliance exports.

## Modules
- `src/cli.js` — entry/orchestration across commands.
- `src/adapters.js` — model invocation (mock/cmd/ollama/openai/anthropic).
- `src/tasks.js` — golden-set loading (bundled + user-defined).
- `src/runner.js` — task execution + per-task checks.
- `src/baseline.js` — baseline freeze/diff/status.
- `src/report.js` — report aggregation + HTML/JSON rendering.
- `src/storage.js` — persistent run storage + series queries.
- `src/scheduler.js` — cron parsing + scheduled run loop.
- `src/alerts.js` — alert evaluation + channel dispatch.
- `src/server.js` — HTTP service + JSON API + static dashboard.

## Test strategy
- Offline smoke test (`tests/smoke.js`, `npm test`): stub model adapters only, no network, no API keys.
  1. Baseline-regeneration check: running mock-good against `tests/fixtures/baseline.frozen.json` yields exit 0, 30 tasks pass, `report.json`/`report.html` written, no drift fields above threshold.
  2. Regression check: mock-drifted against the same baseline yields non-zero exit, exactly 2 regressed tasks (T-07, T-15), per-task diff printed to stdout and embedded in report, drift scores > 0.
  3. Scheduler/persistence: `runOnce` stores a timestamped run; `/api/runs` list and `/api/series` include it; series point passes vs baseline is plottable; alert on breach fires into a local stub webhook/slack channel.
  4. Unit-ish assertions inline: cron next-run is monotone/valid, arg-matching vs tool-arg diffs, output-format detection, threshold evaluation at exact boundary.
- Manual verification: `serve` starts on configured port, dashboard lists saved runs; CLI `baseline` freezes a run; `--json` output validates.
- Requirements: Node.js 18+ (stdlib only); network adapters opt-in.

## Acceptance checks (issue #117)
1. **Fixture:** bundled 30-task golden set runs against a stub model → HTML/JSON drift report with per-task pass/fail vs frozen baseline → exits 0 when nothing drifts.
2. **Failure case:** stub model silently changes one tool argument (`"2026-09-08"` → `"today"`) and drops one refusal into a hallucinated tool call → guard flags exactly two regressed tasks, prints per-task diff, exits non-zero.
3. **End-to-end:** scheduling the guard daily against a live alias stores a timestamped run; dashboard shows drift-trend chart with the run plotted against frozen baseline; alert fires when a threshold is breached.
- Plus root README tool table entry (folder link, one-line description, merged PR link), MIT license, About/footer lines in README, `package.json.homepage`, tests/fixtures present.

## Additional checks
- Zero runtime dependencies (Node.js stdlib only).
- MIT license; homepage set; README About + footer lines exactly as required.
- Commits use repository author identity (awiseguy88 / 18493653+awiseguy88@users.noreply.github.com).
- Root README tool table updated with folder link, one-line description, and merged PR.
- PR merged into main, branch deleted; only main left.
