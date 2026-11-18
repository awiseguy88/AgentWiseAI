# Agent Decision Triage — PLAN

## Goal
Build a local-first, open-source decision triage app for developers supervising multiple coding agents. It provides a structured inbox where agents/wrappers submit decisions (question, approval, review, done-claim) with context, an operator resolves them in one numbered batch pass, and responses are posted back to waiting callers via callback URL, file, or local socket.

## Users
- Solo developers / small teams running multiple long-running coding agents (Claude Code, Codex, Cursor, custom harnesses).
- Need to handle permission prompts, clarification questions, completion claims, and diff reviews without constant terminal context switching.

## Milestone 1 (MVP, this ticket)
Local Node.js/TypeScript web app plus CLI/webhook bridge:
- **Submit** structured decision items via HTTP API or CLI (question, approval, review, done-claim) with context links/diff snippets and a response channel (`callback` URL, `file` path, or `socket` path).
- **Normalize & dedupe**: link duplicate clarification questions (same normalized question/context key) instead of creating separate unresolved work; present linked duplicates in queue.
- **Prioritized numbered inbox UI** showing per-item context, type, session/agent, status, and actions: resolve, snooze, needs-info.
- **Batch resolve** in one pass: operator selects/enters responses for numbered items and submits; each waiting fixture agent receives the correct structured response and continues or stops accordingly.
- **Delivery**: post chosen response back via callback (HTTP POST), file (write JSON response), or socket (write JSON line/response). Bounded retries for transient delivery failures; unreachable/malformed delivery marked failed with actionable diagnostics without blocking other queued decisions.
- **Persistence & audit**: persist items/resolutions/audit history in local SQLite (`.local/triage.db`), record timestamp and responder for every resolution, export JSON/HTML audit report.
- **Failure handling**: malformed decision payload rejected with actionable diagnostics (400); unreachable callback marked failed after bounded retries; existing audit history remains intact.
- **Fixtures & demo**: fixtures for Claude Code/Codex-style prompts proving 3 sessions / 5 items (2 duplicate clarification questions, 1 approval, 1 diff review, 1 completion claim), dedupe/linking, batch resolve, delivery, and exported audit report.

## Files / structure
```
agent-decision-triage/
├── PLAN.md
├── LICENSE                         # MIT
├── README.md                       # About AaronWiseAI + footer
├── package.json                    # homepage https://aaronwiseai.com/
├── tsconfig.json
├── src/
│   ├── types.ts                    # decision item/response/audit types
│   ├── db.ts                       # SQLite schema + CRUD + audit log
│   ├── dedupe.ts                   # normalization and duplicate linking
│   ├── validate.ts                 # payload validation + diagnostics
│   ├── deliver.ts                  # callback/file/socket delivery with bounded retries
│   ├── inbox.ts                    # queue prioritization/numbering/state transitions
│   ├── server.ts                   # Express API + static UI + export endpoints
│   └── cli.ts                      # CLI submit/wait helper for fixtures/agents
├── public/
│   ├── index.html                  # inbox UI
│   ├── style.css
│   └── app.js                      # client: fetch queue, batch resolve, export
├── fixtures/
│   ├── scenarios/
│   │   └── mixed-batch.json        # 3 sessions, 5 items incl. duplicates
│   ├── agents/
│   │   ├── fixture-agent.ts        # waits for response via file/socket/callback server
│   │   └── run-demo.ts             # submits fixtures, waits for operator batch, verifies responses, exports report
│   └── expected/
│       └── mixed-batch-notes.md    # human-readable demo expectations
├── test/
│   ├── dedupe.test.ts
│   ├── validate.test.ts
│   ├── delivery.test.ts            # callback/file/socket + unreachable + bounded retries
│   ├── inbox.test.ts               # numbering, batch resolve, audit recording, no blocking
│   └── integration.test.ts         # API-level acceptance flow (malformed payload, mixed batch)
└── .gitignore
```

## Test strategy
- **Unit tests** (node --test via tsx): dedupe normalization/linking; payload validation diagnostics; delivery modes (file/socket/mock HTTP callback), unreachable callback bounded retries and failure marking; inbox transitions and batch resolve audit records.
- **Integration tests**: start server in-process/on ephemeral port, submit mixed batch fixtures, verify dedupe/numbering/context, resolve batch in one pass, confirm each caller/response record correct, malformed payload rejected, failed callback does not block others, audit history intact, JSON/HTML export contains resolutions with timestamp/responder.
- **Demo script**: `npm run demo` runs fixture agents end-to-end (operator resolves via UI/API) and produces exported audit report artifact path.

## Acceptance checks (issue #65)
1. Three fixture sessions emit five items (2 duplicate clarification questions, 1 approval, 1 diff review, 1 completion claim): inbox dedupes/links duplicates, presents numbered queue with attached context, records each human resolution with timestamp and responder.
2. Operator resolves a numbered batch in one pass and each waiting fixture agent receives the correct structured response and continues or stops accordingly, producing an exported JSON/HTML audit report.
3. Malformed decision payload or unreachable callback is rejected or marked failed with actionable diagnostics, retries are bounded, no other queued decisions are blocked, and existing audit history remains intact.

## Future milestones (not in this ticket)
- Multi-user accounts/workspaces with auth and roles.
- Import/export and integrations (Claude Code hooks, Codex/Cursor adapters, Slack).
- Background jobs for digests/reminders/escalation.
- Policy controls and observability dashboards.
- Deployment packaging (Docker Compose smoke test).
- Collaboration (claim/assign/comment/history UI).
