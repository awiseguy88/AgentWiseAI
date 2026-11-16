# Agent Governance Control Plane

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

Agent Governance Control Plane is a self-hosted Node.js web service plus agent middleware/SDK that enforces least-privilege tool calling for AI agents at runtime. It wraps a fixture coding agent, intercepts every tool call against a configurable policy (allow / block / require-approval per tool and per risk class), routes high-risk actions to a pending-approval queue, and records every decision in a tamper-evident append-only audit log. A small Express + SQLite dashboard lists pending approvals and recent decisions with pass/block/approved status.

## Problem

Teams deploying coding or operational agents have no way to enforce which tools an agent may call at runtime, require human approval before a high-risk action fires, or produce an audit trail that proves which agent did what. Today this is enforced ad-hoc or with full tool access. This tool enforces least-privilege for AI agents as one product: runtime policy gating, per-action approvals, and an immutable audit log.

## MVP features

- **Fixture coding agent**: calls tools (SELECT, INSERT, UPDATE, DELETE) against a fixture database.
- **Agent middleware/SDK**: wraps the fixture agent; intercepts each tool call and applies policy before execution.
- **Least-privilege policy**: allow / block / require-approval per tool and per risk class, loaded from `config/policy.json`.
- **Approval queue**: `require-approval` decisions are queued as pending approvals; an approver can approve or reject. Rejected writes apply no side effect to the fixture database.
- **Tamper-evident audit log**: append-only SQLite log; each entry is chained by the hash of the previous entry, so a deliberately altered entry is flagged as tamper-evident.
- **Web dashboard**: lists pending approvals and recent decisions with pass/block/approved status; approve/reject via API.
- **Fixtures**: destructive DELETE blocked while read-only SELECT passes (issue #110 acceptance 1); rejection leaves no side effect (acceptance 2); tamper-evident audit (acceptance 3).
- **Docker Compose + Dockerfile**: self-hosted deployment (app + SQLite).
- **Smoke test**: Node test runner + Docker Compose smoke script exercising acceptance criteria over HTTP.

## Quick start

Requirements: Node.js >= 22.

```bash
cd agent-governance-control-plane
npm install
npm start
# or: DB_PATH=./data/app.db npm start
```

Open <http://localhost:3000>. The dashboard lists pending approvals and recent decisions.

## Docker Compose

```bash
cd agent-governance-control-plane
docker compose up --build
# service: http://localhost:3000
```

### Docker smoke test

With the service running (`docker compose up --build -d`):

```bash
bash test/docker-smoke.sh
```

The script waits for `/api/health`, then exercises acceptance criteria 1–3 (blocked destructive delete appearing in pending approvals, rejected write with no side effect, tamper-evident audit log) via HTTP.

## Tests

```bash
npm test
# runs: node --test test/smoke.mjs
```

Fixtures live in [`fixtures/acceptance.json`](fixtures/acceptance.json). The smoke test uses a temporary SQLite database and covers:

1. **Blocked destructive delete**: fixture agent policy denies deletes; DELETE tool call is blocked and appears in the pending-approvals dashboard while a read-only SELECT passes and is logged.
2. **Rejected write has no side effect**: an approver rejects a pending write; the agent receives a denial and no side effect is applied to the fixture database.
3. **Tamper-evident audit log**: every allowed, blocked, approved tool call is retrievable by agent ID and timestamp; a deliberately altered audit entry is flagged as tamper-evident.

## API overview

- `GET /api/health`
- `GET /api/agents` — registered agents
- `GET /api/policy` — current least-privilege policy
- `GET /api/decisions` — recent decisions (pass/block/approved), filterable by agent
- `GET /api/approvals` — pending approvals
- `POST /api/approvals/:id/approve` — approve a pending tool call
- `POST /api/approvals/:id/reject` — reject a pending tool call (no side effect)
- `POST /api/agents/:agentId/call` — SDK-style tool call entry point `{tool, args}`
- `GET /api/audit` — audit log entries (filterable by agent, action, decision)
- `GET /api/audit/verify` — verify hash-chain tamper evidence

## Configuration

- `PORT` (default `3000`)
- `DB_PATH` (default `./data/app.db`)
- `CONFIG_PATH` (default `config/policy.json`)

## Files

- [`PLAN.md`](PLAN.md) — goal, users, files, test strategy, acceptance checks
- [`package.json`](package.json) — `"homepage": "https://aaronwiseai.com/"`, MIT license
- [`src/server.js`](src/server.js) — Express server, dashboard API, static serving
- [`src/db.js`](src/db.js) — SQLite schema and persistence (`node:sqlite`)
- [`src/audit.js`](src/audit.js) — append-only audit log with hash-chain tamper evidence
- [`src/policy.js`](src/policy.js) — least-privilege policy engine (allow/block/require-approval)
- [`src/approvals.js`](src/approvals.js) — pending-approval queue + approve/reject
- [`src/middleware.js`](src/middleware.js) — intercepts tool calls, applies policy, logs decisions
- [`src/sdk.js`](src/sdk.js) — agent-side SDK entrypoint wrapping the fixture agent
- [`src/fixture-agent.js`](src/fixture-agent.js) — fixture coding agent calling tools on fixture DB
- [`src/seed.js`](src/seed.js) — fixture agent, default policy, demo data
- [`config/policy.json`](config/policy.json) — default least-privilege policy
- [`public/`](public/) — web dashboard UI
- [`test/smoke.mjs`](test/smoke.mjs) — automated acceptance smoke tests
- [`test/docker-smoke.sh`](test/docker-smoke.sh) — Docker Compose smoke script
- [`fixtures/acceptance.json`](fixtures/acceptance.json) — acceptance fixtures
- [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml)

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).

Part of the AaronWiseAI open-source tool collection — [https://aaronwiseai.com/](https://aaronwiseai.com/).
