# CI Waste Control Plane — PLAN

## Goal

Build a self-hosted, open-source control plane for CI waste: a Node.js/Express web service plus Postgres (via SQLite for local/demo; production Postgres via env), GitHub App integration, and Docker Compose deployment. Milestone 1 delivers: GitHub App install + OAuth scaffolding, backfill of the last 100 runs per repo, per-workflow/per-repo cost computation, waste categorization (superseded runs, push+PR duplicates, zombie crons, flaky jobs, missing timeouts), a dashboard showing top wasteful workflows with estimated recoverable minutes, a fixture of 3 repos' run data, and a smoke test.

## Users

- Platform engineers and dev leads at teams running AI coding agents (Claude Code, Codex, Cursor, Copilot cloud) that open many PRs.
- Teams hitting rising GitHub Actions bills and stale/duplicate CI runs.
- Anyone self-hosting CI observability/remediation without a SaaS dependency.

## What it ships (Milestone 1)

- **GitHub App install + OAuth scaffolding** (`src/github.js`): App authentication helpers (webhook verification, installation token exchange placeholder), OAuth URL generation, and an injectable `GitHubClient` (dry-run vs live mode).
- **Backfill last 100 runs per repo** (`src/backfill.js`): fetches workflow runs per repo, stores in SQLite.
- **Per-workflow/per-repo cost** (`src/waste.js` / `src/cost.js`): sums duration_minutes per workflow and repo, estimates $ cost at configurable per-minute rate.
- **Waste categorization** (`src/waste.js`):
  - superseded: non-latest runs on same (workflow, head_branch) for push/PR sequences.
  - push_pr_duplicate: same head_sha runs twice (push + pull_request) within a workflow.
  - zombie_cron: scheduled workflow with no successful runs in last N days while runs continue.
  - flaky_job: retry-proven flakiness (attempt > 1, or failure then success on same commit).
  - missing_timeout: workflow/job lacks timeout-minutes.
- **Dashboard** (`src/server.js` + `public/`): top wasteful workflows with estimated recoverable minutes, per-repo breakdown, per-category totals, and a remediation action.
- **Fixtures**: 3 repos' run data (`test/fixtures/repos.json`) covering wasteful (agent-app), mixed (tools), and clean (stable-lib) cases.
- **Tests**: `test/smoke.mjs` (Node built-in runner, temp SQLite DB) covering acceptance 1–3; `test/docker-smoke.sh` exercising the same over HTTP against Docker Compose.
- **Dockerfile + docker-compose.yml**: self-hosted deployment.
- **Docs**: PLAN.md, README.md (About AaronWiseAI + footer), LICENSE (MIT), package.json (homepage https://aaronwiseai.com/), .gitignore.

## Files

```
ci-waste-control-plane/
  PLAN.md
  package.json
  LICENSE
  README.md
  .gitignore
  Dockerfile
  docker-compose.yml
  config/thresholds.json       staleCronDays, retry window, etc.
  src/
    server.js                  Express app, dashboard API, static serving
    db.js                      SQLite schema + persistence (node:sqlite)
    waste.js                   waste categorization + dashboard aggregation
    remediation.js             remediation PR generation + GitHubClient
    seed.js                    fixture seeding
    github.js                  GitHub App auth helpers + OAuth scaffolding
    backfill.js                last-100-runs backfill helper (GH API shape)
    cost.js                    per-minute cost estimation
  public/
    index.html                 dashboard UI
    app.js                     browser logic (fetch dashboard, trigger analyze/remediate)
    styles.css
  test/
    smoke.mjs                  automated acceptance smoke tests (temp SQLite DB)
    docker-smoke.sh            Docker Compose smoke script over HTTP
    fixtures/repos.json        3-repo fixture data
  data/                        (runtime SQLite DB; gitignored)
```

## Test strategy

- Node built-in test runner (`node --test test/smoke.mjs`) using a temporary SQLite DB:
  1. Health check.
  2. Acceptance 1: fixture dashboard lists each waste category with recoverable minutes and shows the top wasteful workflow per repo.
  3. Acceptance 2: a repo with no wasteful patterns shows zero recoverable minutes and no false-positive remediation PRs.
  4. Acceptance 3: for a repo missing concurrency cancellation, the system opens a PR adding the concurrency block and reports estimated minutes saved.
- Docker Compose smoke: builds image, starts service, runs `test/docker-smoke.sh` exercising acceptance 1–3 over HTTP.
- Local run: `npm start` serves the dashboard at http://localhost:3000.

## Acceptance checks (from issue #128)

1. Given fixture run data from 3 repos, the dashboard lists each waste category with recoverable minutes and shows the top wasteful workflow per repo.
2. Failure case: a repo with no wasteful patterns shows zero recoverable minutes and no false-positive remediation PRs.
3. Remediation: for a repo missing concurrency cancellation, the system opens a PR adding the concurrency block and reports estimated minutes saved.

## Remaining milestones (planned, not in this ticket)

- **Milestone 2**: per-team budgets with Slack/email alerts, automated remediation PRs (concurrency blocks, timeout-minutes, branches-ignore for merge queues), agent-PR tagging (runs triggered by Copilot/Claude actions), and a savings ledger.
- **Milestone 3**: multi-org support, chargeback reports by team/repo, policy enforcement (block merges over budget), historical trends, and production Postgres (instead of SQLite) with connection pooling.

## Footer / About requirement

README includes an "About AaronWiseAI" section and footer link matching repository conventions; package.json includes `"homepage": "https://aaronwiseai.com/"`.