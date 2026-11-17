# Inbox Agent Coverage Guard

Local-first web service that guards AI email automations (n8n, Make, Zapier, custom agents) against silently-missed emails. Connects to Gmail/Outlook via OAuth, runs reconciliation sweeps searching `in:inbox` minus processed labels with message-ID deduplication to find emails touched by nothing, exposes a human review queue for edge-case emails the agent skipped, provides a dead-letter queue capturing failed agent actions with retry/reprocess, shows a coverage dashboard (touched/untouched/failed counts and trends), and accepts webhooks from custom AI agents reporting processed emails. Works without modifying existing workflows.

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## Why it exists

AI email automations silently miss emails despite every execution showing "Succeeded". Common causes include:

- Unread-only trigger (skips already-read email)
- Polling forward-only (no history scan)
- Max emails per poll (truncation)
- No retry on 503/transient errors
- OAuth expiry after 7 days (Testing mode)
- Unpublished workflows, read-status invisibility, stale published versions, Gmail "Skip the Inbox" filters, Execute Once batch truncation

Existing tools (Flowhush, RunLookout) are cloud-only heartbeat monitors that require adding ping URLs to workflows and lack email reconciliation. Coverage Guard works without touching your workflows — it reads your inbox directly and tells you what nothing touched.

## Quick start

```bash
# Clone repo
git clone https://github.com/awiseguy88/AgentWiseAI.git
cd AgentWiseAI/inbox-agent-coverage-guard

# Install dependencies
npm install

# Offline smoke test (no network, no OAuth required)
npm test

# Start dashboard
npm start
# Then open http://localhost:3400
```

### Offline smoke test

The bundled smoke test runs entirely offline using mock Gmail fixtures:

1. Starts with 20 mock emails, 15 marked PROCESSED by a mock agent.
2. Runs a reconciliation sweep → finds 5 untouched emails in the review queue.
3. Enqueues a simulated 503 failure → retries → resolves in the audit log.
4. Dashboard shows "15 processed, 5 untouched, 0 failed".

```bash
npm test
```

Expected output:

```
=== Inbox Coverage Guard Smoke Test ===

--- Acceptance 1: Reconciliation sweep ---
  Sweep result: total=20, touched=15, untouched=5, failed=0
  ...
--- Acceptance 2: Dead-letter queue ---
  ...
--- Acceptance 3: Coverage dashboard ---
  ...
=== ALL SMOKE TESTS PASSED ===
```

### Connecting Gmail / Outlook

```bash
# Gmail
node src/cli.js connect --provider gmail --gmail-client-id YOUR_ID --gmail-client-secret YOUR_SECRET
# Then open http://localhost:3400 and use /api/dashboard?inbox=default

# Outlook
node src/cli.js connect --provider outlook --outlook-client-id YOUR_ID --outlook-client-secret YOUR_SECRET
```

For real accounts, configure OAuth credentials in `.env` (copy `.env.example`) and run:

```bash
node src/cli.js serve --provider gmail --data-dir ./data
```

Dashboard exposes JSON API endpoints under `/api/*` (dashboard, review, sweep, dlq, audit, agents, webhook).

### Agent webhooks

Custom AI agents can report processed emails via:

```http
POST /api/webhook/<agent-id>
X-Webhook-Token: <your-token>

{
  "processed": [ { "message_id": "...", "action": "replied", "payload": {...} } ],
  "failed": [ { "message_id": "...", "action": "...", "error": { "status": 503, "message": "..." } } ]
}
```

Processed IDs subtract from the review queue. Failed actions enter the dead-letter queue with retry/reprocess support.

## Docker

```bash
cp .env.example .env
docker compose up --build
# Dashboard: http://localhost:3400
```

Services: `app` (dashboard on port 3400). Data persisted in `./data` volume. Uses the mock provider by default; set `ICG_PROVIDER=gmail` or `outlook` and OAuth env vars for real accounts.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/config` | GET | Provider/OAuth config status |
| `/api/dashboard?inbox=<id>` | GET | Coverage counts, trend sweeps, latest sweep |
| `/api/review?inbox=<id>` | GET | Untouched emails (review queue) |
| `/api/sweep` | POST | Run reconciliation sweep |
| `/api/dlq?inbox=<id>` | GET | Dead-letter queue entries |
| `/api/dlq/enqueue` | POST | Manually enqueue a failure |
| `/api/dlq/retry` | POST | Retry a DLQ entry `{ id }` |
| `/api/dlq/resolve` | POST | Manually resolve a DLQ entry `{ id }` |
| `/api/audit?inbox=<id>` | GET | Audit log |
| `/api/agents` | GET/POST | List/register agents |
| `/api/webhook/<agent-id>` | POST | Agent webhook (processed/failed reporting) |

## CLI

```bash
node src/cli.js serve          # start dashboard
node src/cli.js sweep          # run one reconciliation sweep
node src/cli.js review         # list untouched emails
node src/cli.js retry          # retry pending DLQ entries
node src/cli.js agents         # list registered agents
node src/cli.js connect        # print OAuth connect URL
node src/cli.js smoke          # run offline smoke tests
```

## Acceptance criteria (issue #119)

1. **Given** a Gmail inbox with 20 test emails and a mock agent that processes 15, **the** reconciliation sweep finds 5 untouched emails and displays them in the review queue with message-IDs and timestamps. ✓ Verified by smoke test Acceptance 1.
2. **Given** a failing agent action (simulated 503), **the** dead-letter queue captures the failure with payload, allows retry, and shows resolution in the audit log. ✓ Verified by smoke test Acceptance 2.
3. **The** coverage dashboard shows "15 processed, 5 untouched, 0 failed" with per-email detail and refreshes on sweep, all offline after initial OAuth. ✓ Verified by smoke test Acceptance 3.

## Project layout

- `package.json` — manifest: name `inbox-agent-coverage-guard`, bin → `src/cli.js`, homepage https://aaronwiseai.com/, license MIT, `npm test` runs offline smoke
- `LICENSE` — MIT license text
- `PLAN.md` — goal, users, files, milestones, test strategy, acceptance checks
- `src/cli.js` — CLI entry: `serve`, `sweep`, `review`, `retry`, `agents`, `connect`, `smoke`, `help`
- `src/config.js` — env/args config
- `src/storage.js` — SQLite-backed state (messages, processed, dead_letter, agents, audit_log, sweeps)
- `src/providers/index.js` — provider registry (mock/gmail/outlook)
- `src/providers/mock.js` — fixture-based email provider (offline)
- `src/providers/gmail.js` — Gmail API adapter via stored OAuth tokens
- `src/providers/outlook.js` — Microsoft Graph adapter via stored OAuth tokens
- `src/reconcile.js` — reconciliation sweep engine
- `src/deadletter.js` — DLQ enqueue/retry/resolve
- `src/server.js` — HTTP service + JSON API + static web UI
- `web/index.html`, `web/app.js`, `web/styles.css` — browser dashboard
- `tests/fixtures/` — mock inbox, agent-processed, failed-actions fixtures
- `tests/smoke.js` — offline smoke test covering all 3 acceptance criteria
- `docker-compose.yml` — app service + volume
- `Dockerfile` — Node runtime image
- `.env.example` — example env

## License

MIT (see [LICENSE](LICENSE)).