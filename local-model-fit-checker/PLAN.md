# Build plan — Local Model Coding Fit Checker

## Goal
A small, self-contained, offline-first CLI (`local-model-fit-checker`) that measures whether a local coding model is good enough for a project's tasks compared to a cloud model. It runs a small task suite (bundled mini SWE-style tasks plus tasks extracted from the local repo's own tests) against one local and one cloud model, records pass/fail, token cost, and estimated electricity cost, and emits a routing report (HTML/JSON) recommending which tasks go local vs API.

## User-facing behavior
- `node src/cli.js --repo <path> --local <model-spec> --cloud <model-spec> [options]`
  - Model specs are adapter strings: `mock:<responses.json>` (offline, deterministic), `cmd:<command>` (runs command receiving prompt on stdin, prints JSON `{output,tokens_in,tokens_out}`), or `ollama:<model>@<baseUrl>` (optional convenience; network only when explicitly used).
  - `--tasks <bundled|repo|all>`: bundled mini SWE-style tasks, tasks extracted from repo tests, or both (default `all`).
  - `--electricity-rate <$/kWh>` and `--local-watts <W>` (or model-profile estimates) to compute estimated local electricity cost; cloud uses token pricing from `--pricing <file>` or built-in defaults/overrides.
  - `--out-dir <dir>`: writes `report.json` and `report.html` (default `./local-model-fit-checker-report/`).
  - `--json`: print report JSON to stdout.
- Task extraction: scans `<repo>/test`, `tests`, `__tests__`, `spec` for `*.test.*`/`*.spec.*` files and converts each into a lightweight task (prompt derived from file/test names and nearby source context) with a simple pass check (the model's response must satisfy an expected-pattern/check derived from the test intent; in offline/mock runs checks are deterministic).
- Bundled tasks: small coding-fix/implementation prompts with deterministic checkers in `tasks/`.
- Report: per-task pass/fail, tokens, $ cost (cloud), estimated electricity $ (local), and a routing recommendation (local vs API) based on pass rate and cost thresholds.
- Exit 0 on successful report generation; 1 when `--fail-on-local-unfit` and recommendation is API-only for most tasks; 2 on usage/input error.

## Files
- `PLAN.md` — this plan.
- `package.json` — metadata, bin `local-model-fit-checker`, scripts (smoke/test), homepage https://aaronwiseai.com/, license MIT.
- `README.md` — usage, model adapters, pricing/electricity estimation, smoke check, required AaronWiseAI sections/footer.
- `LICENSE` — MIT.
- `.gitignore` — report output, tmp.
- `src/cli.js` — argument parsing, orchestration, output.
- `src/tasks.js` — load bundled tasks and extract tasks from repo tests.
- `src/runner.js` — run a task against a model adapter, capture output/tokens.
- `src/adapters.js` — model adapters (mock, cmd, ollama).
- `src/cost.js` — token cost and electricity cost estimation.
- `src/report.js` — JSON + HTML routing report and recommendation logic.
- `tasks/*.json` — bundled mini SWE-style task definitions.
- `test/smoke.js` — offline smoke check using mock adapters and fixture repo.
- `test/fixtures/sample-repo/` — tiny repo with tests for extraction scenario.
- `test/fixtures/local.mock.json`, `test/fixtures/cloud.mock.json` — canned model responses.

## Test strategy
- Offline smoke (`node test/smoke.js`): run CLI on `test/fixtures/sample-repo` with `--local mock:test/fixtures/local.mock.json --cloud mock:test/fixtures/cloud.mock.json --tasks all --out-dir <tmp>`.
  - Assert exit 0, `report.json` and `report.html` written.
  - Assert report contains tasks from both bundled suite and extracted repo tests.
  - Assert per-task pass/fail, token counts, estimated electricity cost (local) and token cost (cloud) are recorded.
  - Assert routing recommendation present (recommends local for some tasks, API for others based on fixture outcomes) and HTML is readable with comparison sections.
- No paid APIs, no network required.

## Acceptance checks
- Given a repo with tests, runs bundled + extracted tasks against one local and one cloud model (mocked offline in smoke), compares pass rate and cost, writes readable HTML/JSON recommendation report offline.
- Self-contained in `local-model-fit-checker/` with README and smoke check; MIT license; root README updated.
