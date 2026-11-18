# Agent Regression Suite — PLAN

## Goal
Provide a dependency-light, offline Node CLI that detects behavioral regressions in stochastic AI agents. It loads frozen scenarios (turn sequences with expected tool calls/args, captured fields, and forbidden phrases), replays them against a local agent CLI or mock model, extracts behavioral fingerprints from traces, and applies Sequential Probability Ratio Tests (SPRT) to declare **Pass / Fail / Inconclusive** per scenario with CI-gating exit codes.

## Users
- Founders and small teams shipping AI agents (support, booking, sales, or code-generation agents) who change prompts, models, tools, or knowledge bases and need to verify nothing broke before the next real run.
- CI systems that need deterministic gating for non-deterministic agent behavior without paid APIs or hosted QA platforms.

## Files
- `PLAN.md` — this plan, milestones, and acceptance checks.
- `LICENSE` — MIT.
- `package.json` — CLI metadata, scripts, `homepage: https://aaronwiseai.com/`.
- `README.md` — usage, fixture format, SPRT explanation, demo, limitations, About/footer.
- `bin/agent-regression-suite.js` — CLI entrypoint.
- `src/cli.js` — argument parsing and orchestration.
- `src/fixtures.js` — load/validate frozen scenario suites.
- `src/runner.js` — replay against mock-agent config or local agent CLI/command; capture traces.
- `src/fingerprint.js` — extract stable behavioral fingerprints and compare traces to expectations.
- `src/sprt.js` — SPRT engine and verdict computation (Pass/Fail/Inconclusive).
- `src/report.js` — JSON/HTML CI-gated reports.
- `fixtures/scenarios.json` — 3 frozen scenarios (booked, refusal, transfer-style agent behaviors).
- `fixtures/mock-agent-baseline.json` — unchanged mock agent used for stable/pass demo.
- `fixtures/mock-agent-regressed.json` — regressed mock agent (prompt/behavior change) for Fail demo.
- `fixtures/mock-agent-flaky-ok.json` (or equivalent deterministic config) — used to demonstrate repeated-run pass path in tests.
- `test/smoke.test.js` — acceptance tests covering SPRT fail/regress, unchanged pass across runs, and offline report generation.

## Milestones
### Milestone 1 (this implementation, end-to-end)
1. **Scaffold & plan**: create subfolder, PLAN.md, MIT LICENSE, package.json/homepage, README skeleton.
2. **Core engine**: fixture loading, mock replay (and CLI hook), behavioral fingerprint extraction, per-trial assertion scoring.
3. **SPRT verdicts & reports**: SPRT Pass/Fail/Inconclusive per scenario, aggregated JSON/HTML report, CI exit code (non-zero on Fail/regression gate).
4. **Tests & demo**: bundled fixtures + regressed/unchanged mocks; acceptance checks (1) regressed fixture flags Fail ≥90% confidence and CI non-zero, (2) unchanged agent across 10 runs declares Pass ≥95% confidence and never flakes, both offline with fixture mocks.
5. **Repo integration**: update root README tool table with folder link, one-line description, and PR reference placeholder/update as delivery progresses.

### Future milestones (recorded, not implemented now)
- Mutation testing (prompt/tool/model/context mutations).
- Metamorphic relations (permutation, perturbation, composition, oracle).
- Trace-first offline analysis on pre-recorded traces.
- CI/CD deployment gates with configurable risk thresholds and richer coverage metrics.

## Test strategy
- **Unit/integration via Node test runner** (`node --test`), no external dependencies.
- **Offline only**: all acceptance tests use bundled fixture scenarios and mock-agent JSON configs; no network, no paid APIs.
- **Deterministic regression demo**: a mock agent config missing a required tool call (simulating a one-line prompt/behavior regression) yields consistent trial failures so SPRT reaches Fail with ≥90% confidence quickly.
- **Stability demo**: an unchanged mock agent yields consistent trial passes across 10 runs so SPRT reaches Pass with ≥95% confidence and never flakes.
- **Report/CI gating**: verify `report.json`/`report.html` are produced and process exits non-zero when any scenario is Fail (or configured gate fails).

## Acceptance checks
1. `cd agent-regression-suite && npm test` passes.
2. Given a fixture agent that regresses after a one-line prompt change, the suite flags a **Fail** verdict with **≥90% confidence** using SPRT, and a CI run exits **non-zero**. (Offline, fixture mocks.)
3. Given the same agent unchanged across 10 runs, the suite declares **Pass** with **≥95% confidence** and never flakes. (Offline, fixture mocks.)
4. First/demo run produces readable HTML/JSON CI-gated reports from bundled fixtures with no account or paid service.
5. Package includes PLAN.md, MIT LICENSE, README with About AaronWiseAI section/footer and `package.json` `homepage` set to `https://aaronwiseai.com/`.
