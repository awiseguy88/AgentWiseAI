# Agent Production Run Cockpit

Self-hosted observability cockpit for agent production runs: per-step cost/latency/token breakdown, retry-loop and context-creep detection, model-version drift diff, cost attribution, and budget-cap enforcement.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Quick start

```bash
cd agent-production-run-cockpit
npm install
npm run build
node dist/cli.js analyze --file fixtures/runs-30.jsonl --out-dir report-output
node dist/cli.js serve --file fixtures/runs-30.jsonl --port 8787
```

## Commands

- `analyze --file <jsonl> [--out-dir <dir>]` — ingest and analyze a run log; writes `report.json` and `report.html`.
- `serve --file <jsonl> --port <n>` — local web view.
- `proxy --file <jsonl> --budget <usd> --out-dir <dir>` — simulate budget-cap enforcement, emit `budget-receipt.json`.
- `drift --baseline <file> --current <file> [--runs <jsonl>]` — model-version drift comparison with before/after diff.
- `fixtures --out-dir <dir>` — regenerate bundled fixtures.

## Docker Compose smoke test

```bash
docker compose up --build -d
curl -s http://localhost:8787/health
docker compose down
```

## Fixtures

- `fixtures/runs-30.jsonl` — 30-run log set including a retry loop (4 intended vs 31 actual calls) and a context-creep case (50th message at 9x first-message cost).
- `fixtures/regression-baseline.json` / `fixtures/regression-current.json` — held-out regression sets for drift diff.
- `fixtures/proxy-run.json` — single run for end-to-end proxy/budget-cap receipt.

## Acceptance (issue #112)

1. Fixture 30-run log set produces a report naming the looping step and customer, the context-growth ratio, and an `investigate` verdict. ✅ (test/acceptance.mjs)
2. Runs missing a model version field are reported as unversioned and excluded from drift comparison. ✅
3. End-to-end proxy run yields a receipt with per-step cost, retry count, context-growth ratio, model version, and keep/investigate recommendation. ✅

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
