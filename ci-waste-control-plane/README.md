# CI Waste Control Plane

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

CI Waste Control Plane is a self-hosted Node.js web service with a GitHub App that backfills the last 100 GitHub Actions runs per repo, computes per-workflow/per-repo cost, categorizes waste (superseded runs, push+PR duplicates, zombie crons, flaky jobs, missing timeouts), and shows a dashboard of top wasteful workflows with estimated recoverable minutes. It also generates one-line YAML remediation PRs (e.g. concurrency blocks) with estimated minutes saved.

## Problem

AI coding agents (Claude Code, Codex, Cursor, Copilot cloud) push more often than humans, and each push runs the full CI suite. Without concurrency cancellation, superseded runs finish anyway. The same commit runs twice when both `push` and `pull_request` triggers are set. Agent-authored PRs inflate bills. No self-hosted, product-scale control plane ties these patterns to budgets and automated fixes.

## MVP features

- **GitHub App install + OAuth scaffolding**: App auth helpers and OAuth URL generation (dry-run by default; live mode via `GITHUB_TOKEN`).
- **Backfill last 100 runs per repo**: `src/backfill.js` fetches workflow runs via the GitHub API and stores them in SQLite.
- **Per-workflow/per-repo cost**: sums `duration_minutes` per workflow and repo; `src/cost.js` estimates `$` cost at a configurable per-minute rate.
- **Waste categorization** (`src/waste.js`):
  - **superseded**: non-latest runs on the same `(workflow, head_branch)` for push/PR sequences.
  - **push_pr_duplicate**: the same `head_sha` runs twice (push + pull_request) within a workflow.
  - **zombie_cron**: scheduled workflow with no successful runs in the last N days while runs continue.
  - **flaky_job**: retry-proven flakiness (attempt > 1, or failure then success on the same commit).
  - **missing_timeout**: workflow/job lacks `timeout-minutes`.
- **Dashboard** (`src/server.js` + `public/`): top wasteful workflows with estimated recoverable minutes, per-repo breakdown, per-category totals, and a remediation action.
- **Fixtures**: 3 repos' run data (`test/fixtures/repos.json`) covering wasteful (agent-app), mixed (tools), and clean (stable-lib) cases.
- **Docker Compose + Dockerfile**: self-hosted deployment.
- **Smoke test**: Node test runner + Docker Compose smoke script exercising acceptance criteria over HTTP.

## Quick start

Requirements: Node.js >= 22 (uses `node:sqlite`).

```bash
cd ci-waste-control-plane
npm install
npm start
# or: DB_PATH=./data/ci-waste.db npm start
```

Open <http://localhost:3000>. The dashboard lists per-repo waste with recoverable minutes and a "Generate remediation PR" action.

## Docker Compose

```bash
cd ci-waste-control-plane
docker compose up --build
# service: http://localhost:3000
```

### Docker smoke test

With the service running (`docker compose up --build -d`):

```bash
bash test/docker-smoke.sh
```

The script waits for `/api/health`, then exercises acceptance criteria 1–3 (dashboard categories with recoverable minutes, clean repo with zero recoverable minutes and no remediation PRs, concurrency remediation PR with estimated minutes saved) via HTTP.

## Tests

```bash
npm test
# runs: node --test test/smoke.mjs
```

Fixtures live in [`test/fixtures/repos.json`](test/fixtures/repos.json). The smoke test uses a temporary SQLite database and covers:

1. **Acceptance 1**: Given fixture run data from 3 repos, the dashboard lists each waste category with recoverable minutes and shows the top wasteful workflow per repo.
2. **Acceptance 2**: A repo with no wasteful patterns shows zero recoverable minutes and no false-positive remediation PRs.
3. **Acceptance 3**: For a repo missing concurrency cancellation, the system opens a PR adding the concurrency block and reports estimated minutes saved.

## API overview

- `GET /api/health`
- `GET /api/repos` — list repos with total runs and total recoverable minutes
- `GET /api/repos/:id` — repo detail + dashboard (analyzes if no findings)
- `GET /api/repos/:id/waste` — findings + dashboard for a repo
- `POST /api/repos/:id/analyze` — (re)analyze a repo
- `GET /api/dashboard` — global dashboard: total recoverable minutes, per-category totals, top repos with their top wasteful workflow
- `POST /api/repos/:id/remediate` — generate remediation PRs (dry-run by default) for a repo
- `GET /api/remediations` — list generated remediation PRs

## Configuration

- `PORT` (default `3000`)
- `DB_PATH` (default `./data/ci-waste.db`)
- `GITHUB_TOKEN` (optional; enables live mode for remediation PRs)

## Files

- [`PLAN.md`](PLAN.md) — goal, users, files, test strategy, acceptance checks
- [`package.json`](package.json) — `"homepage": "https://aaronwiseai.com/"`, MIT license
- [`src/server.js`](src/server.js) — Express server, dashboard API, static serving
- [`src/db.js`](src/db.js) — SQLite schema and persistence (`node:sqlite`)
- [`src/waste.js`](src/waste.js) — waste categorization and dashboard aggregation
- [`src/remediation.js`](src/remediation.js) — remediation PR generation + `GitHubClient`
- [`src/seed.js`](src/seed.js) — fixture seeding
- [`src/github.js`](src/github.js) — GitHub App auth helpers + OAuth scaffolding
- [`src/backfill.js`](src/backfill.js) — last-100-runs backfill helper
- [`src/cost.js`](src/cost.js) — per-minute cost estimation
- [`public/`](public/) — web dashboard UI
- [`test/smoke.mjs`](test/smoke.mjs) — automated acceptance smoke tests
- [`test/docker-smoke.sh`](test/docker-smoke.sh) — Docker Compose smoke script
- [`test/fixtures/repos.json`](test/fixtures/repos.json) — acceptance fixtures (3 repos)
- [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml)

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).

Part of the AaronWiseAI open-source tool collection — [https://aaronwiseai.com/](https://aaronwiseai.com/).