# AI PR Review Governance Workbench — PLAN

## Goal

Build a self-hosted, open-source GitHub App that governs AI-generated pull-request sprawl: it ingests PRs via webhook, computes diff size (additions + deletions) and file count against configurable thresholds, flags oversized PRs as "sprawl" on a reviewer dashboard, and lets a reviewer send one back to rescope with a comment + `needs-rescope` label.

Milestone 1 (this milestone, implemented end-to-end now): end-to-end webhook ingestion, sprawl detection, reviewer dashboard, send-back-to-rescope action with GitHub comment + label, SQLite persistence, webhook signature verification (HTTP 401 on invalid/missing signature), test fixtures, Docker Compose smoke test, README, MIT license, PLAN.md, and root README tool table entry.

Milestone 2 (deferred, recorded below): reviewer capacity caps (max open reviews and max lines per reviewer), chunk-by-seam suggestions, author-explanation checklist, audit log, Slack/email alerts, GitHub Marketplace listing.

## Users

- Engineering teams whose developers use AI coding agents (Claude Code, Cursor, Codex, OpenCode) and need team-level policy that local-only tools like Reflektor cannot enforce.
- Reviewers who must triage oversized PRs and send them back to rescope.
- Repo admins who configure diff-size/file-count thresholds per installation.

## What it ships (Milestone 1)

- Self-hosted GitHub App (Node.js + Express + SQLite via `node:sqlite`)
- Webhook endpoint `POST /api/webhooks/github` verifying `X-Hub-Signature-256`; invalid/missing signature returns HTTP 401 and is logged, no dashboard item created
- `pull_request` (opened/synchronize) ingestion: fetches PR diff, computes total changed lines (additions + deletions) and changed-file count
- Configurable thresholds: `MAX_LINES` (default 500), `MAX_FILES` (default 10); exceeding either flags the PR as sprawl
- Reviewer dashboard listing sprawl PRs (repo, number, title, author, lines, files, status, created at)
- "Send back to rescope" action: posts a comment on the PR and adds the `needs-rescope` label (real GitHub API when `GITHUB_TOKEN` is set; mock-records the action otherwise for tests/demos)
- Within-limits PRs are not flagged and create no dashboard item
- Config via env (`PORT`, `WEBHOOK_SECRET`, `GITHUB_TOKEN`, `MAX_LINES`, `MAX_FILES`, `DB_PATH`)
- Dockerfile + Docker Compose for self-hosted deploy
- Automated smoke tests with `node --test` covering all issue #124 acceptance criteria
- Fixtures: oversized PR (~2,400 lines / ~38 files) and within-limits PR
- Docker Compose smoke script exercising acceptance scenarios
- PLAN.md, MIT LICENSE, README.md with About AaronWiseAI section and footer, package.json `homepage: https://aaronwiseai.com/`

## Files

```
ai-pr-review-governance-workbench/
  PLAN.md
  package.json
  LICENSE
  README.md
  .gitignore
  Dockerfile
  docker-compose.yml
  src/
    server.js       Express app, routes, static serving
    db.js           SQLite schema + persistence
    github.js       webhook signature verification + GitHub client (real or mock)
  public/
    index.html      Reviewer dashboard (sprawl list, send back to rescope)
    app.js          Browser logic
    styles.css
  test/
    smoke.mjs       Automated acceptance + smoke tests (node --test)
    docker-smoke.sh Docker Compose smoke script
  fixtures/
    pr-oversized.json   ~2,400 lines across ~38 files fixture
    pr-within-limits.json within-limits fixture
  data/
    .gitkeep
```

## Test strategy

- Node built-in test runner (`node --test test/smoke.mjs`), temporary SQLite DB:
  1. Oversized fixture (~2,400 lines / ~38 files): webhook ingests, flags as sprawl, dashboard lists it; send-back-to-rescope records comment + `needs-rescope` label action.
  2. Within-limits fixture: not flagged, no dashboard item created.
  3. Invalid/missing webhook signature: HTTP 401, rejected and logged, no dashboard item.
  4. Default thresholds: PR within limits not flagged; PR exceeding either threshold flagged.
- Docker Compose smoke: builds image, starts service, runs `test/docker-smoke.sh` against `http://localhost:3000` exercising the three acceptance scenarios over HTTP (with mock GitHub, since no real GitHub token is available in the smoke environment).

## Acceptance checks (from issue #124)

1. **Realistic fixture**: PR with ~2,400 lines across ~38 files -> tool ingests within 60s and flags it as oversized on the dashboard; reviewer clicks "send back to rescope" and the PR receives a comment and `needs-rescope` label (recorded action in mock mode; real GitHub API when token configured).
2. **Failure case**: PR within limits -> not flagged, no dashboard item, reviewer proceeds normally.
3. **Invalid/missing signature**: HTTP 401, request rejected and logged; no dashboard item created.

## Milestones (recorded, not implemented in M1)

- M2: reviewer capacity caps (max open reviews, max lines per reviewer), chunk-by-seam suggestions, author-explanation checklist, audit log, Slack/email alerts.
- Distribution: GitHub Marketplace listing plus self-hosted Docker deploy.

## Footer / About requirement

README includes an "About AaronWiseAI" section and footer link matching repository conventions; package.json includes `"homepage": "https://aaronwiseai.com/"`.
