# Agent Outcome Meter — PLAN

## Goal
Build a self-hosted web service (Node/Express + Postgres + Docker Compose) that attributes LLM spend to merged pull requests. It receives usage events from a LiteLLM proxy instrumentation plugin (task/session IDs, token counts, model), ingests GitHub webhooks to link runs to PRs, and serves a dashboard showing cost per merged PR broken down by model and turn count. Failed runs (tests fail, never merge) are counted in total spend but excluded from cost-per-accepted-outcome.

## Users
- Engineering/platform teams running coding agents (Claude Code, Codex, Cursor, Copilot) against real repositories.
- Finance leaders who need to know what agent tasks actually cost and whether they produced accepted outcomes.
- Developers who want an open-source, self-hosted alternative to proprietary SaaS (LangSmith).

## Files
```
agent-outcome-meter/
├── package.json
├── PLAN.md
├── README.md
├── LICENSE
├── Dockerfile
├── docker-compose.yml
├── config/
│   ├── pricing.json
│   └── settings.json
├── src/
│   ├── server.js
│   ├── db.js
│   ├── pricing.js
│   ├── usage.js
│   ├── webhook.js
│   └── dashboard.js
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── test/
│   ├── smoke.mjs
│   ├── docker-smoke.sh
│   └── fixtures/
│       ├── proxy-events.json
│       ├── webhook-events.json
│       └── acceptance.json
```

## Test Strategy
- `npm test` runs `node --test test/smoke.mjs` using SQLite (node:sqlite) in a temp DB. Exercises acceptance 1 & 2.
- `npm run docker-smoke` runs `test/docker-smoke.sh` against `docker compose up --build -d` (Postgres). Verifies same acceptance criteria over HTTP.

## Acceptance Checks
1. **Fixture merged PR**: Simulated agent run through LiteLLM proxy against fixture repo produces a merged PR. Dashboard shows cost per merged PR broken down by model and turn count, matching proxy log within 1%.
2. **Failure case**: A run that fails tests and never merges is counted in total spend but excluded from cost-per-accepted-outcome. Dashboard reports higher cost per accepted outcome and does not hide failed spend.