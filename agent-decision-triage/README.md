# Agent Decision Triage

Local Node.js/TypeScript web app plus CLI/webhook bridge for triaging decisions from parallel coding agents. Agents or wrappers submit structured decision items (question, approval, review, done-claim) with context links/diff snippets; an operator uses a prioritized numbered inbox to resolve/snooze/mark needs-info in one batch, and each waiting caller receives the chosen structured response via callback, file, or socket.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Features (Milestone 1)

- **Structured intake**: HTTP API (`POST /api/items`) and CLI submit question/approval/review/done-claim items with context (summary, links, diff snippets, session/agent metadata).
- **Response channels**: deliver operator decisions back to waiting callers via `callback` (HTTP POST), `file` (JSON written to path), or `socket` (JSON line to unix socket).
- **Prioritized numbered inbox**: web UI lists actionable items with queue numbers, type, session, full context, and per-item actions (resolve, snooze, needs-info).
- **Deduplication/linking**: duplicate clarification questions (same normalized question/context key) are linked to a primary inbox item so the operator answers once; the same resolution is delivered to every linked waiting caller.
- **Batch resolve**: resolve multiple numbered items in one pass; each waiting fixture/caller receives the correct structured response.
- **Persistence & audit**: local SQLite (`.local/triage.db`) stores items and audit history; every resolution records timestamp and responder. Export JSON/HTML audit reports.
- **Failure handling**: malformed payloads rejected with actionable diagnostics (HTTP 400); unreachable callbacks/files/sockets marked failed after bounded retries with diagnostics, without blocking other queued decisions; audit history remains intact.

## Requirements

- Node.js >= 20

## Install

```bash
cd agent-decision-triage
npm install
```

## Run

```bash
# dev (tsx)
npm run dev

# or build + start
npm run build
npm start
```

Open [http://localhost:3457](http://localhost:3457) (or `PORT` env).

## API

- `GET /api/inbox` — numbered queue and completed items (with linked duplicates).
- `POST /api/items` — submit a decision item.
- `POST /api/items/:id/resolve` — resolve one item/group `{ "response": ..., "responder": "name" }`.
- `POST /api/batch/resolve` — resolve multiple `{ "resolutions": [{ "id": 1, "response": ..., "responder": "op" }, ...] }`.
- `POST /api/items/:id/snooze` — snooze `{ "until": "ISO8601", "reason": "..." }`.
- `POST /api/items/:id/needs-info` — mark needs info `{ "question": "..." }`.
- `GET /api/export.json` / `GET /api/export.html` — audit report download.

### Submit payload example

```json
{
  "type": "approval",
  "context": {
    "summary": "Approve running migration 004_add_audit.sql?",
    "agent": "claude-code",
    "session": "session-1",
    "links": [{ "label": "migration", "url": "file://migrations/004_add_audit.sql" }]
  },
  "channel": "callback",
  "channelTarget": "http://127.0.0.1:9000/decision-callback"
}
```

Channels: `callback` (http/https URL, POST JSON), `file` (absolute/local path written with JSON response), `socket` (unix socket path, JSON line).

## CLI

```bash
TRIAGE_URL=http://localhost:3457 npm run cli -- submit fixtures/scenarios/mixed-batch.json
npm run cli -- inbox
npm run cli -- export audit.json
```

(For single-item submission pass a JSON file containing one item payload.)

## Demo / fixtures

Fixtures in `fixtures/scenarios/mixed-batch.json` model 3 sessions emitting 5 items (2 duplicate clarification questions, 1 approval, 1 diff review, 1 completion claim). The demo script submits them, resolves a numbered batch in one pass, waits for fixture agents to receive responses, and exports an audit report:

```bash
npm run demo
```

## Tests

```bash
npm test
```

Covers payload validation diagnostics, dedupe/linking, delivery (callback/file/socket), bounded retries and unreachable callbacks without blocking, inbox numbering/batch resolve/audit recording, and the mixed-batch acceptance flow.

## Project layout

- `src/` — types, validation, dedupe, delivery, inbox/db, Express server, CLI
- `public/` — inbox web UI
- `fixtures/` — scenario payloads and fixture agent/demo helpers
- `test/` — unit/integration tests
- `PLAN.md` — goal, users, files, test strategy, acceptance checks

## Future milestones

Multi-user workspaces/auth, Claude Code/Codex/Cursor adapters and Slack integrations, background digests/reminders/escalation, policy controls and observability, Docker Compose deployment smoke test, and collaboration (claim/assign/comment/history).

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/