# Vibe App Launch Gate

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/)**

Vibe App Launch Gate is a self-hosted Node.js web service that provides governance for internal vibe-coded tools: an app registry (owner, current release, intended audience, data access scope), an approval workflow that blocks new releases until a designated reviewer approves, and a minimal audit log recording every approval, rejection, and ownership change. It also detects shadow IT via CI webhooks and blocks deployment until an unregistered tool is registered or formally retired.

## Problem

Teams ship vibe-coded internal tools that become production dependencies without ownership, review, or data controls. This tool enforces a lightweight production boundary: who owns the app, who can use it, what data it touches, and which release is actually approved to reach users.

## MVP features

- **User accounts**: developer/reviewer/admin roles with session-based login.
- **App registry**: records name, owner, reviewer, intended audience, data access scope, and current approved (live) release.
- **Approval workflow**: submitting a release creates a pending release; it does **not** reach users until a designated reviewer (or admin) approves it. Rejections keep the release blocked.
- **Governance checklist**: generated per app; launch is blocked until the owner confirms the data scope and the designated reviewer signs off.
- **Audit log**: append-only records for app registration, release submission/approval/rejection, ownership changes, checklist confirmations/sign-offs, and shadow-IT detection/resolution (including who, when, and scope-change details).
- **CI webhook / shadow IT**: `POST /api/ci/report` flags unregistered apps as shadow IT and returns `deploymentBlocked: true`; deployment remains blocked until the report is resolved by registering the app or retiring it.
- **Web UI**: browse apps, view release history and launch-gate status, submit/approve/reject releases, confirm/sign off checklist, and inspect audit log.

## Quick start

Requirements: Node.js >= 22.

```bash
cd vibe-app-launch-gate
npm install
npm start
# or: DB_PATH=./data/app.db SEED_DEMO=1 npm start
```

Open <http://localhost:3000>. Seeded demo users (password `password`): `dev-a` (developer), `dev-b` (developer), `reviewer-1` (reviewer), `admin` (admin).

## Docker Compose

```bash
cd vibe-app-launch-gate
docker compose up --build
# service: http://localhost:3000
```

The compose service sets `SEED_DEMO=1` and persists the SQLite database in a named volume.

### Docker smoke test

With the service running (`docker compose up --build -d`):

```bash
bash test/docker-smoke.sh
```

The script waits for `/api/health`, then exercises the three acceptance scenarios (scope expansion approval gate, governance checklist gating, shadow-IT detection/resolution) via HTTP.

## Tests

```bash
npm test
# runs: node --test test/smoke.mjs
```

Fixtures live in [`fixtures/acceptance.json`](fixtures/acceptance.json). The smoke test uses a temporary SQLite database and covers:

1. **Scope expansion blocked**: registered app (`dev-a`, `team-b`, scope `read-only reports`) with a live release; submitting a release expanding scope to `write billing records` keeps it pending/blocked and does not change the live scope until the designated reviewer approves; audit log records who approved, when, and the requested scope change.
2. **Governance checklist**: registering a new app (`dev-b`, `team-c`, `read-only`) generates a checklist that blocks launch until the owner confirms data scope and the reviewer signs off.
3. **Shadow IT via CI webhook**: unregistered app reported to `/api/ci/report` is flagged as shadow IT with `deploymentBlocked: true`; audit captures detection and resolution when registered or retired.

## API overview

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET/POST /api/apps`, `GET /api/apps/:id`
- `GET/POST /api/apps/:id/releases` — submit release (`{version, data_scope}`)
- `POST /api/releases/:id/approve`, `POST /api/releases/:id/reject`
- `GET /api/apps/:id/checklist`, `POST /api/apps/:id/checklist/confirm`, `POST /api/apps/:id/checklist/signoff`
- `POST /api/apps/:id/owner` — ownership change (`{owner_id}`)
- `POST /api/ci/report` — shadow IT report (`{app_name, changed_files, ...}`) → `{shadowIt, deploymentBlocked, reportId}`
- `GET /api/shadow-it`, `POST /api/shadow-it/:id/resolve` — `{action: "register"|"retire", app_id?}`
- `GET /api/audit` — filterable audit log
- `GET /api/health`

## Configuration

- `PORT` (default `3000`)
- `DB_PATH` (default `./data/app.db`)
- `SEED_DEMO=1` — seed demo users on first run
- `SEED_FIXTURE=1` — seed a live fixture app (useful for demos/smoke setups)

## Files

- [`PLAN.md`](PLAN.md) — goal, users, files, test strategy, acceptance checks
- [`src/server.js`](src/server.js) — Express server and API
- [`src/db.js`](src/db.js) — SQLite schema and persistence (`node:sqlite`)
- [`src/auth.js`](src/auth.js) — password hashing and sessions
- [`src/policy.js`](src/policy.js) — registry, release approval gate, checklist, shadow IT, audit
- [`src/seed.js`](src/seed.js) — demo/fixture seeding
- [`public/`](public/) — web UI
- [`test/smoke.mjs`](test/smoke.mjs) — automated acceptance smoke tests
- [`test/docker-smoke.sh`](test/docker-smoke.sh) — Docker Compose smoke script
- [`fixtures/acceptance.json`](fixtures/acceptance.json) — acceptance fixtures
- [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml)

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).

Part of the AaronWiseAI open-source tool collection — [https://aaronwiseai.com/](https://aaronwiseai.com/).
