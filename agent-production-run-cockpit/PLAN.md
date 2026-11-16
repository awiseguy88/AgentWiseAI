# Agent Production Run Cockpit — PLAN

## Goal
Build a self-hosted observability platform (Node.js CLI + local web UI) that ingests agent run traces (JSONL), shows per-step cost/latency/token breakdown, flags flaky upstream APIs causing call inflation, detects provider model updates causing behavior drift with before/after diff, attributes unattributed cost to a workflow/customer, and enforces a budget cap that stops a run.

## Users
- Platform/engineering teams running AI agents in production (support, coding, workflow agents) who need one cockpit for cost, retry amplification, context creep, drift, attribution, and budget enforcement.
- Developers/operators who want a dependency-light, offline-capable self-hosted tool with Docker deployment and fixture-driven verification.

## Scope (current milestone — M1 end-to-end MVP)
1. **Log ingestion (JSONL):** parse agent run/step records with run_id, workflow/customer, step, model, model_version, tokens, latency, cost, timestamps, intended_step markers, and status.
2. **Per-step cost/latency/token breakdown:** aggregate by run and step; emit receipts and report.
3. **Flaky upstream / retry-loop detection:** identify steps where actual calls far exceed intended calls (call inflation) and name looping step and customer/workflow.
4. **Context-creep alerting:** compute context-growth ratio (e.g. 50th message vs first) and flag/investigate.
5. **Model-version tracking + drift detection:** compare held-out regression/baseline scores across model versions; produce before/after diff and keep/investigate verdict. Runs missing `model_version` are reported as **unversioned** and **excluded from drift comparison** (never silently passing).
6. **Cost attribution:** attribute cost to workflow/customer (including previously unattributed entries when identifiers exist).
7. **Budget cap enforcement:** proxy mode can stop a run when a configured budget cap is exceeded, returning a receipt.
8. **Local web view:** serve a local HTML report/dashboard for ingested runs and receipts.
9. **Distribution artifacts:** Dockerfile + Docker Compose smoke test, fixtures, tests, README with required AaronWiseAI sections/footer, MIT LICENSE, package.json homepage `https://aaronwiseai.com/`.

## Files / structure
- `PLAN.md` — this plan and acceptance checks.
- `LICENSE` — MIT.
- `README.md` — usage, fixtures, acceptance evidence, About AaronWiseAI + footer.
- `package.json` — CLI metadata, scripts, `homepage: https://aaronwiseai.com/`.
- `tsconfig.json` — TypeScript build config.
- `.gitignore` — node_modules/dist/report output.
- `src/types.ts` — run/step/report types.
- `src/ingest.ts` — JSONL ingestion and normalization.
- `src/pricing.ts` — pricing table helpers / cost resolution.
- `src/analyze.ts` — per-step breakdown, retry-loop, context-creep, attribution, verdicts.
- `src/drift.ts` — model-version drift comparison and before/after diff.
- `src/budget.ts` — budget cap tracker/enforcer for proxy flow.
- `src/report.ts` — JSON/HTML report generation.
- `src/server.ts` — local web view + proxy endpoint for budget-cap stop.
- `src/cli.ts` — CLI entrypoint (`analyze`, `serve`, `proxy`, `drift`).
- `fixtures/runs-30.jsonl` — 30-run fixture including retry loop (4 intended, 31 actual) and context creep (50th message ~9x first).
- `fixtures/regression-baseline.json` — held-out regression baseline for drift diff.
- `fixtures/regression-current.json` — current regression results (includes versioned/unversioned cases).
- `fixtures/proxy-run.json` — sample run for proxy/budget-cap end-to-end receipt.
- `test/acceptance.mjs` — automated checks for issue acceptance criteria.
- `Dockerfile`, `docker-compose.yml`, `scripts/smoke.sh` — Docker Compose smoke test.

## Test strategy
- **Automated (Node, offline):** `npm test` builds (if needed) and runs `test/acceptance.mjs` which:
  1. Analyzes `fixtures/runs-30.jsonl` and asserts: retry-loop named with looping step and customer, 31 actual vs 4 intended detected, context-growth ratio ~9x reported, and an `investigate` verdict present.
  2. Runs drift comparison with fixtures missing `model_version` and asserts those runs are reported unversioned and excluded from drift comparison (not passing).
  3. Exercises end-to-end proxy/budget-cap receipt generation (`fixtures/proxy-run.json`) and asserts receipt contains per-step cost, retry count, context-growth ratio, model version, and keep/investigate recommendation based on held-out regression score.
- **Docker Compose smoke test:** `docker compose up --build --abort-on-container-exit` (or `scripts/smoke.sh`) runs the acceptance suite inside a container to prove the self-hosted bundle works.
- **Manual:** `node dist/cli.js serve --report ...` to inspect local web view.

## Acceptance checks (mapped to issue #112)
1. **Fixture 30-run log set:** contains one retry loop (4 intended steps, 31 actual calls) and one context-creep case (50th message at 9x first-message cost). Report names the looping step and customer, the context-growth ratio, and an `investigate` verdict. ✅ verified by `test/acceptance.mjs`.
2. **Failure case:** runs missing a model version field are reported as unversioned and excluded from drift comparison rather than silently passing. ✅ verified by drift fixture/test.
3. **End-to-end:** a real agent run through the proxy yields a receipt breaking out per-step cost, retry count, context-growth ratio, model version, and a keep/investigate recommendation based on the held-out regression score. ✅ verified by proxy receipt test path.

## Risks / notes
- Pricing/model catalogs vary; use a bundled/local pricing table with overrides and make assumptions explicit in report.
- "Real agent run through the proxy" is demonstrated via a deterministic local proxy endpoint/CLI path that processes a run and enforces budget cap, producing the required receipt (no external paid APIs).
- Drift comparison requires a held-out regression score source; fixtures provide baseline/current scores for deterministic before/after diff and verdict.

## Current milestone status
- [x] PLAN.md written before coding.
- [ ] Implementation, fixtures, tests, Docker smoke, README/root index, PR.
