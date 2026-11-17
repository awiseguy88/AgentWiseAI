# Build plan — Inbox Agent Coverage Guard

## Goal
A local-first Node.js web service that connects to Gmail/Outlook via OAuth, runs reconciliation sweeps searching `in:inbox` minus processed labels with message-ID deduplication to find emails touched by nothing, exposes a human review queue for edge-case emails the agent skipped, provides a dead-letter queue capturing failed agent actions with retry/reprocess, shows a coverage dashboard (touched/untouched/failed counts and trends), and accepts webhooks from custom AI agents reporting processed emails. Works without modifying existing workflows. Offline after initial OAuth.

## Users
Founders and small teams running AI email agents/automations (booking, support, sales inboxes) on n8n/Make/Zapier/custom stacks with Gmail/Outlook, who need to detect silently-missed emails.

## Files
- `package.json` — name `inbox-agent-coverage-guard`, bin, homepage https://aaronwiseai.com/, license MIT, `npm test` runs offline smoke; runtime dep `better-sqlite3`.
- `LICENSE` — MIT license text.
- `README.md` — About AaronWiseAI section with required sentence, About footer line, usage, OAuth setup, webhooks, Docker Compose, acceptance mapping; ends with required footer line.
- `PLAN.md` — this file.
- `src/cli.js` — CLI entry: commands `serve`, `sweep`, `review`, `retry`, `agents`, `connect`, `smoke`, `help`.
- `src/config.js` — env/args config.
- `src/storage.js` — SQLite-backed state: inboxes, messages, processed, dead_letter, audit_log, sweeps, agents.
- `src/providers/index.js` — provider registry (mock, gmail, outlook).
- `src/providers/mock.js` — fixture-based email provider.
- `src/providers/gmail.js` — Gmail API adapter using stored OAuth tokens.
- `src/providers/outlook.js` — Microsoft Graph adapter using stored OAuth tokens.
- `src/reconcile.js` — reconciliation sweep engine.
- `src/deadletter.js` — DLQ retry/reprocess.
- `src/server.js` — HTTP service + JSON API + static web UI.
- `web/index.html`, `web/app.js`, `web/styles.css` — browser dashboard: coverage, review queue, DLQ, audit log, trends.
- `tests/fixtures/gmail-inbox.json` — 20 mock emails (15 with processed label).
- `tests/fixtures/agent-processed.json` — 15 processed IDs reported by mock agent.
- `tests/fixtures/failed-actions.json` — simulated 503 failure payloads.
- `tests/smoke.js` — offline smoke test covering all 3 acceptance criteria.
- `docker-compose.yml` — app service + volume.
- `Dockerfile` — Node runtime image.
- `.env.example` — example env.

## Milestones
- **M1 (this ticket)**: mock provider, reconciliation sweep, review queue, DLQ with retry, coverage dashboard + trends, webhook ingestion, OAuth code paths (gmail/outlook), smoke test, PLAN/LICENSE/README/package.json homepage/Docker Compose/root README entry.
- **M2 (future)**: multi-inbox, CI gating for agent changes, Postgres backend, real OAuth token refresh at scale.

## Modules
- `src/cli.js` — entry/orchestration.
- `src/storage.js` — SQLite state.
- `src/providers/*` — email providers.
- `src/reconcile.js` — sweep engine.
- `src/deadletter.js` — DLQ.
- `src/server.js` — HTTP service + API + static UI.

## Test strategy
Offline smoke test (`tests/smoke.js`, `npm test`), mock provider only, no network:
1. Acceptance 1: 20 emails + 15 processed → sweep finds 5 untouched in review queue with message-IDs and timestamps.
2. Acceptance 2: simulated 503 → DLQ captures payload, retry succeeds, audit log shows resolution.
3. Acceptance 3: dashboard shows "15 processed, 5 untouched, 0 failed" with per-email detail; sweep refreshes; runs offline.

## Acceptance checks (issue #119)
1. Given a Gmail inbox with 20 test emails and a mock agent that processes 15, the reconciliation sweep finds 5 untouched emails and displays them in the review queue with message-IDs and timestamps.
2. Given a failing agent action (simulated 503), the dead-letter queue captures the failure with payload, allows retry, and shows resolution in the audit log.
3. The coverage dashboard shows "15 processed, 5 untouched, 0 failed" with per-email detail and refreshes on sweep, all offline after initial OAuth.
