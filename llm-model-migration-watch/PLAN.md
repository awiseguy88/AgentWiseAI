# Build plan — LLM Model Migration Watch

## Goal
A self-hosted web platform with a CLI runner that loads task suites (bundled mini agent scenarios plus tasks extracted from the project's own tests), runs them against a current model and one or more candidate models, and emits an HTML/JSON comparison report (pass rate, cost per task, latency, tool-call accuracy) with a go/no-go recommendation and projected cost savings.

## Users
Developers and small teams running AI coding agents, support agents, or LLM-powered apps who need automated, evidence-based model migration decisions as new releases ship.

## Milestones
- **M1 (this ticket, ~10 hours)**: CLI runner with bundled 10-task suite, repo test extraction, mock/cmd/Ollama adapters, HTML/JSON report with per-model pass rate/cost/latency/tool-accuracy, go/no-go recommendation, cost-vs-quality tradeoff, CI-gating exit codes.
- **M2 (future)**: Web dashboard with persistent accounts, model inventory, project workspaces, eval history, background worker polling model release feeds, auto-trigger evals, CI integration gating deployment on migration go/no-go.
- **M3 (future)**: Docker Compose deployment (app + worker + Postgres), standalone CLI binary distribution, smoke test runs CLI on fixture suite and opens dashboard listing saved run.

## Files
- `package.json` — manifest, `bin` pointing at `src/cli.js`; `npm test`/`npm run smoke` run offline smoke check; `homepage` = `https://aaronwiseai.com/`; `license` = `MIT`.
- `LICENSE` — MIT license text.
- `README.md` — usage, adapters, task suite, report, smoke check, AaronWiseAI branding (About + footer lines).
- `PLAN.md` — this file.
- `src/cli.js` — CLI entry: arg parsing, directory validation, task suite loading, model spec parsing, runner invocation, report generation, output writing, exit code.
- `src/tasks.js` — `loadBundledTasks(toolRoot)`, `extractRepoTasks(repoPath)`, prompt/checker construction for repo tests.
- `src/adapters.js` — model adapters: `mock:<file>`, `cmd:<shell>`, `ollama:<model>@<baseUrl>`; deterministic offline mock for CI/smoke.
- `src/runner.js` — `runTask(task, adapterSpec)`, `checkResult(task, output)`: evaluates pass/fail, tool-call accuracy (checker can specify expected tool name), returns per-task result.
- `src/cost.js` — `cloudTokenCost(tokensIn, tokensOut, pricing)`, defaults overridable via CLI.
- `src/report.js` — `buildReport(modelsResults, opts)` aggregates per-model per-task results into summary + recommendation (go/no-go/consider) + cost-vs-quality tradeoff; `renderHtml(report)` produces readable HTML; `writeReport(report, outDir)` writes `report.json` and `report.html`.
- `tasks/` — 10 bundled mini agent scenario JSON files (id, title, type: "bundled", prompt, checker). Each checker supports `contains`, `containsAll`, `notContains`, `containsAny`, `tool` (expected tool name), `toolNot` (forbidden tool).
- `tests/fixtures/sample-repo/` — small repo with test files for repo-task extraction.
- `tests/fixtures/*.mock.json` — mock responses keyed by task id for current and candidate models.
- `tests/smoke.js` — offline smoke test: spawns CLI on fixtures with mock adapters, asserts exit 0, verifies report.json/report.html exist, per-model pass/cost/latency/tool-accuracy fields, go/no-go logic flags regression, cost-vs-quality projection, mixed recommendations, HTML readability.

## Modules
- `src/cli.js` — entry/orchestration.
- `src/tasks.js` — task loading (bundled + repo extraction).
- `src/adapters.js` — model invocation.
- `src/runner.js` — task execution + checking.
- `src/cost.js` — cost math.
- `src/report.js` — report building + rendering.

## Test strategy
- Offline smoke test (`tests/smoke.js`): uses bundled tasks + extracted repo tasks with mock adapters for current and candidate models. One candidate is cheaper but has a quality regression on one task (wrong tool call). Asserts:
  - CLI exits 0 (report-only tool; exit code 1 reserved for `no-go` when `--fail-on-no-go` used).
  - `report.json` contains per-model summary with pass rate, avg cost, avg latency, tool accuracy.
  - Candidate with regression is flagged `do_not_migrate: true` with specific failure evidence (task id, expected vs actual tool).
  - Cost-vs-quality tradeoff shows projected monthly savings vs quality delta.
  - HTML report is readable and includes summary cards, per-task table, recommendation box.
- Manual verification: `--json` output; `--fail-on-no-go` exits 1 on regression; error handling for missing dir/specs.

## Acceptance checks (from issue #79)
1. Given a repo with a bundled 10-task agent fixture suite, the tool runs each task against two configured models and produces an HTML/JSON report showing per-model pass rate, average cost, and latency.
2. Given a model with a known quality regression on one fixture task (e.g. cannot call a specific tool correctly), the tool flags that task as failed and marks the model as "do not migrate" with the specific failure evidence.
3. Given a candidate model that is cheaper but has lower pass rate, the tool produces a cost-vs-quality tradeoff recommendation showing projected monthly savings vs quality delta.

## Additional checks
- Zero runtime dependencies (Node.js stdlib only).
- MIT license, homepage set, About AaronWiseAI section with required line and footer.
- Commits use repository author identity (awiseguy88 / 18493653+awiseguy88@users.noreply.github.com).
- Root README tool table updated with folder link, one-line description, and merged PR.