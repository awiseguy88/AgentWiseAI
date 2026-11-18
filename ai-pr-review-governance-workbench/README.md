# AI PR Review Governance Workbench

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/)**

AI PR Review Governance Workbench is a self-hosted GitHub App that governs AI-generated pull-request sprawl. It ingests pull requests via webhook, computes diff size (additions + deletions) and changed-file count against configurable thresholds, flags oversized PRs as "sprawl" on a reviewer dashboard, and lets a reviewer send one back to rescope with a comment and a `needs-rescope` label.

## Problem

AI coding agents now produce pull requests with thousands of lines across dozens of files. Reviewers skim, rubber-stamp, or lower the bar because diffs are too large to read well. Local tools catch this only per-developer; this workbench adds team-level governance with a shared dashboard, webhook ingestion, and an explicit rescope workflow.

## MVP features (Milestone 1)

- **GitHub webhook ingestion**: `POST /api/webhooks/github` for `pull_request` events (`opened`, `reopened`, `synchronize`), verified with `X-Hub-Signature-256`.
- **Sprawl detection**: computes total changed lines (additions + deletions) and changed-file count; flags as sprawl when either exceeds configurable thresholds (`MAX_LINES`, default 500; `MAX_FILES`, default 10).
- **Reviewer dashboard**: lists flagged PRs (repo, number, title, author, lines, files, status) with a "Send back to rescope" action.
- **Send back to rescope**: posts a comment on the PR and adds the `needs-rescope` label (real GitHub API when `GITHUB_TOKEN` is set; action recorded locally in mock mode for tests/demos).
- **Safety**: invalid or missing webhook signature returns HTTP 401, request is rejected and logged, and no dashboard item is created. PRs within limits are not flagged and create no dashboard item.
- **Self-hosted**: Node.js + Express + SQLite (`node:sqlite`), Dockerfile and Docker Compose included.

## Quick start

Requirements: Node.js >= 22.

```bash
cd ai-pr-review-governance-workbench
npm install
WEBHOOK_SECRET=your-secret MAX_LINES=500 MAX_FILES=10 npm start
# open http://localhost:3000
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/app.db` | SQLite database path |
| `WEBHOOK_SECRET` | (required for webhooks) | GitHub App/webhook secret used for `X-Hub-Signature-256` verification |
| `MAX_LINES` | `500` | Sprawl threshold: total additions + deletions |
| `MAX_FILES` | `10` | Sprawl threshold: changed file count |
| `GITHUB_TOKEN` | (unset = mock mode) | Token with permission to comment and label PRs; when unset, rescope actions are recorded locally without calling GitHub |

## Webhook payload

The webhook handler reads standard GitHub `pull_request` payload fields: `pull_request.number`, `pull_request.title`, `pull_request.user.login`, `pull_request.html_url`, `pull_request.additions`, `pull_request.deletions`, `pull_request.changed_files`, and `repository.full_name`. For test fixtures, a `diff` array (file entries with `additions`/`deletions`) may also be provided and is used to compute totals.

## Docker Compose

```bash
cd ai-pr-review-governance-workbench
docker compose up --build
# service: http://localhost:3000
```

The compose service sets `WEBHOOK_SECRET=compose-webhook-secret`, persists the SQLite database in a named volume, and exposes `/api/health` for health checks.

### Docker smoke test

With the service running:

```bash
bash test/docker-smoke.sh
```

The script waits for `/api/health`, then exercises the three acceptance scenarios over HTTP (oversized PR flagged, within-limits PR not flagged, invalid signature rejected with 401).

## Tests

```bash
npm test
# runs: node --test test/smoke.mjs
```

Fixtures live in [`fixtures/pr-oversized.json`](fixtures/pr-oversized.json) (~2,400+ lines across 38 files) and [`fixtures/pr-within-limits.json`](fixtures/pr-within-limits.json). The smoke test uses a temporary SQLite database and covers:

1. **Oversized PR**: ingested via signed webhook, flagged as sprawl on the dashboard; "send back to rescope" records comment + `needs-rescope` label action.
2. **Within-limits PR**: not flagged, no dashboard item created.
3. **Invalid/missing signature**: HTTP 401, rejected and logged, no dashboard item created.

## API overview

- `POST /api/webhooks/github` — GitHub webhook (requires valid `X-Hub-Signature-256`)
- `GET /api/sprawl` — list flagged/rescoped PR items
- `POST /api/sprawl/:id/rescope` — send back to rescope (comment + `needs-rescope` label)
- `GET /api/config` — active thresholds and integration status
- `GET /api/webhook-log` — recent webhook activity (including rejections)
- `GET /api/health` — health check

## Files

- [`PLAN.md`](PLAN.md) — goal, users, files, test strategy, acceptance checks, future milestones
- [`src/server.js`](src/server.js) — Express server and API
- [`src/db.js`](src/db.js) — SQLite schema and persistence (`node:sqlite`)
- [`src/github.js`](src/github.js) — webhook signature verification, sprawl computation, rescope action
- [`public/`](public/) — reviewer dashboard UI
- [`test/smoke.mjs`](test/smoke.mjs) — automated acceptance smoke tests
- [`test/docker-smoke.sh`](test/docker-smoke.sh) — Docker Compose smoke script
- [`fixtures/`](fixtures/) — oversized and within-limits PR fixtures
- [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml)

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).

Part of the AaronWiseAI open-source tool collection — [https://aaronwiseai.com/](https://aaronwiseai.com/)
