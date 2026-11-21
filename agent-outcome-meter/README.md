# Agent Outcome Meter

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

Agent Outcome Meter is a self-hosted Node.js web service that attributes LLM spend to merged pull requests. It receives usage events from a LiteLLM proxy instrumentation plugin (task/session IDs, token counts, model), ingests GitHub webhooks to link runs to PRs, and serves a dashboard showing cost per merged PR broken down by model and turn count. Failed runs (tests fail, never merge) are counted in total spend but excluded from cost-per-accepted-outcome.

## Problem

Teams running coding agents (Claude Code, Codex, Cursor, Copilot) cannot answer what a task actually cost or whether it produced an accepted outcome. Provider dashboards report total spend and raw token counts, while agent runs resend growing context across tens or hundreds of turns, so a task that needed six retries and a manual cleanup pass looks cheap on the invoice. This tool closes the attribution gap with an open-source, self-hosted service.

## MVP Features

- **LiteLLM instrumentation endpoint**: `/api/usage` receives usage events with task_id, session_id, model, token counts; computes cost at ingestion time using a rate card.
- **GitHub webhook handler**: `/api/github-webhook` verifies signatures, listens for `pull_request` (merged) and `check_run` (failure) events to mark runs as accepted/failed.
- **Dashboard APIs**: `/api/dashboard/merged-pr-costs` (per-PR breakdown by model/turn) and `/api/dashboard/total-spend` (total/accepted/failed spend, cost per accepted outcome).
- **Dashboard UI**: Vanilla JS + CSS, no build step.
- **Postgres + SQLite**: Uses `pg` in production (Docker Compose), falls back to `node:sqlite` for tests.
- **Append-only attribution**: Cost computed at ingest with rate card stored per run; never recomputed retroactively.
- **Docker Compose**: Self-hosted deployment (app + Postgres 15).
- **Smoke tests**: Node test runner + Docker Compose smoke script exercising acceptance criteria.

## Quick Start (Docker Compose)

Requirements: Docker, Docker Compose.

```bash
cd agent-outcome-meter
docker compose up --build
```

Open <http://localhost:3000>.

The service is ready at `http://localhost:3000`.

## Local Development (SQLite)

Requirements: Node.js >= 22.

```bash
cd agent-outcome-meter
npm install
npm start
# Runs on http://localhost:3000 with SQLite (data/app.db)
```

## LiteLLM Proxy Integration

Add a simple callback plugin to your LiteLLM `config.yaml`:

```yaml
callbacks:
  - "http://your-agent-meter:3000/api/usage"
```

Or use the `success_callback` / `failure_callback` at model or router level. The endpoint expects JSON matching:

```json
{
  "task_id": "abc-123",
  "session_id": "sess-456",
  "repo": "owner/repo",
  "pr_number": 42,
  "engineer_id": "eng-1",
  "team_id": "platform",
  "model": "claude-sonnet-4-20250514",
  "prompt_tokens": 1200,
  "completion_tokens": 800,
  "turn": 1
}
```

The rate card (per-model prices) is stored per run at ingestion time and never recomputed.

## GitHub Webhook

Configure a GitHub webhook pointing to `https://your-host/api/github-webhook` with events:
- Pull requests (`pull_request` with `closed` action when merged)
- Check runs (`check_run` with `failure` conclusion)

Set the webhook secret in `config/settings.json` (`webhook_secret`).

## Configuration

`config/settings.json`:
```json
{
  "port": 3000,
  "webhook_secret": "your-github-webhook-secret",
  "pricing_path": "config/pricing.json",
  "default_team_id": "platform"
}
```

`config/pricing.json` — per-model prices per 1K tokens (input/output), USD:
```json
{
  "prices": {
    "claude-sonnet-4-20250514": { "input": 3.0, "output": 15.0 },
    "gpt-4o-2024-11-20": { "input": 2.5, "output": 10.0 }
  },
  "currency": "USD",
  "per_tokens": 1000
}
```

## Tests

```bash
npm test
# Runs node --test test/smoke.mjs (SQLite, in-memory)
```

### Docker Smoke Test

With the service running (`docker compose up --build -d`):

```bash
npm run docker-smoke
```

The script waits for `/api/health`, then exercises acceptance criteria via HTTP.

## Acceptance Criteria

1. **Fixture merged PR**: Simulated agent run through the LiteLLM proxy against a fixture repo produces a merged PR. Dashboard shows cost per merged PR broken down by model and turn count, matching the proxy log within 1%.
2. **Failure case**: A run that fails tests and never merges is counted in total spend but excluded from cost-per-accepted-outcome. Dashboard reports higher cost per accepted outcome and does not hide failed spend.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/