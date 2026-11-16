# Agent Governance Control Plane — PLAN

## Goal

Build a self-hosted, open-source enforcement layer for AI agents: a web service plus agent middleware/SDK that wraps a fixture coding agent, intercepts its tool calls against a configurable least-privilege policy (allow / block / require-approval per tool and per risk class), records every decision in a tamper-evident append-only audit log, and serves an Express + SQLite dashboard listing pending approvals and recent decisions with pass/block/approved status.

Milestone 1 (this ticket) delivers the full first usable workflow: fixture agent, policy engine, audit log, dashboard, Docker Compose smoke test, tests, and README.

## Users

- AI-engineering teams running coding agents (Claude Code, Codex, Cursor) or operational agents calling databases, CI, cloud APIs, SaaS connectors.
- Platform-security teams who must enforce least-privilege at runtime and prove agent activity with an audit trail.
- Approvers who review high-risk agent actions before they fire.

## What it ships (Milestone 1)

- Fixture coding agent (`src/fixture-agent.js`) that calls tools (SELECT, INSERT, UPDATE, DELETE against a fixture database).
- Agent middleware/SDK (`src/middleware.js`, SDK entry `src/sdk.js`) wrapping the fixture agent; intercepts every tool call and applies policy before execution.
- Least-privilege policy engine (`src/policy.js`): allow / block / require-approval per tool and per risk class, loaded from `config/policy.json`.
- Append-only audit log (`src/audit.js`): SQLite-backed, each entry chained by hash of previous entry so a deliberately altered entry is flagged as tamper-evident.
- Approval queue (`src/approvals.js`): pending approvals for require-approval decisions; approver can approve or reject; rejections apply no side effect.
- Express + SQLite web dashboard (`src/server.js`, `public/`): lists pending approvals and recent decisions with pass/block/approved status; approve/reject actions via API.
- Seeding (`src/seed.js`): default fixture agent, default policy (deletes denied, writes require approval, reads allowed), demo data.
- Dockerfile + docker-compose.yml for self-hosted deployment.
- Tests: `test/smoke.mjs` (Node built-in runner, temp DB) covering acceptance criteria 1–3 from issue #110; `test/docker-smoke.sh` exercising the same over HTTP against compose.
- Fixtures: `fixtures/acceptance.json`.
- PLAN.md, package.json, LICENSE (MIT), README.md (About AaronWiseAI + footer), .gitignore.

## Files

```
agent-governance-control-plane/
  PLAN.md
  package.json
  LICENSE
  README.md
  .gitignore
  Dockerfile
  docker-compose.yml
  config/policy.json           default least-privilege policy
  src/
    server.js                  Express app, dashboard API, static serving
    db.js                      SQLite schema + persistence (node:sqlite)
    audit.js                   append-only audit log with hash-chain tamper evidence
    policy.js                  allow/block/require-approval per tool + risk class
    approvals.js               pending-approval queue + approve/reject
    middleware.js              intercepts tool calls, applies policy, logs decisions
    sdk.js                     agent-side SDK entrypoint (wraps fixture agent)
    fixture-agent.js           fixture coding agent calling tools on fixture DB
    seed.js                    fixture agent, default policy, demo data
  public/
    index.html                 dashboard UI
    app.js                     browser logic (pending approvals, decisions, approve/reject)
    styles.css
  test/
    smoke.mjs                  automated acceptance smoke tests (temp SQLite DB)
    docker-smoke.sh            Docker Compose smoke script over HTTP
  fixtures/
    acceptance.json            fixture data for acceptance criteria
  data/
    .gitkeep
```

## Test strategy

- Node built-in test runner (`node --test test/smoke.mjs`) using a temporary SQLite DB:
  1. DELETE tool call on fixture agent is blocked, appears in pending-approvals dashboard; read-only SELECT passes and is logged.
  2. Approver rejects a pending write: agent receives denial, no side effect applied to fixture database.
  3. Audit log: every allowed/blocked/approved tool call retrievable by agent ID and timestamp; deliberately altered audit entry detected as tamper-evident via hash-chain mismatch.
- Docker Compose smoke: builds image, starts service, runs `test/docker-smoke.sh` exercising acceptance 1–3 over HTTP.
- Local run: `npm start` serves http://localhost:3000 dashboard.

## Acceptance checks (from issue #110)

1. Fixture agent policy denies deletes and requires approval for writes: destructive DELETE tool call is blocked and appears in pending-approvals dashboard; read-only SELECT passes and is logged.
2. Approver rejects a pending write: agent receives a denial; no side effect is applied to the fixture database.
3. Audit log: every allowed, blocked, approved tool call retrievable by agent ID and timestamp; deliberately altered audit entry flagged as tamper-evident.

## Remaining milestones (planned, not in this ticket)

- Milestone 2: per-agent policy versioning, multi-user accounts/roles, approval escalation, review queue with approve/reject UI actions.
- Milestone 3: CI gate failing on policy violation, recovery (revoke connector token on confirmed breach), npm SDK for agent frameworks.

## Footer / About requirement

README includes an "About AaronWiseAI" section and footer link matching repository conventions; package.json includes `"homepage": "https://aaronwiseai.com/"`.
