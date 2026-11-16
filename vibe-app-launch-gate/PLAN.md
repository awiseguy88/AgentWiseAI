# Vibe App Launch Gate — PLAN

## Goal

Build a self-hosted, open-source governance gate for internal vibe-coded tools so teams can track who owns each app, what release is live, who can use it, what data it touches, and ensure every release is approved before reaching users.

## Users

- Engineering managers / IT leads at small-to-medium teams with AI-generated internal tools.
- Tool owners who need to register apps and submit releases.
- Designated reviewers who approve or reject releases.
- Auditors who need a log of approvals, rejections, and ownership changes.

## What it ships (Milestone 1)

- User accounts (login via web UI).
- App registry storing: name, owner, current approved release, intended audience, data access scope.
- Release workflow: a new release draft cannot go live until a designated reviewer approves it; rejected releases stay blocked.
- Audit log: immutable append-only records for approval, rejection, ownership change, app creation, shadow-IT detection/resolution.
- Governance checklist: generated per app; launch blocked until owner confirms data scope and reviewer signs off.
- CI webhook endpoint: reports unregistered files/tools as shadow IT; blocks deployment until registered or retired.
- Docker Compose + Dockerfile for self-hosted deployment.
- Smoke test via Node test runner + Docker Compose fixture script.
- Fixtures for acceptance criteria (3 scenarios from issue #80).

## Files

```
vibe-app-launch-gate/
  PLAN.md
  package.json
  LICENSE
  README.md
  .gitignore
  Dockerfile
  docker-compose.yml
  src/
    server.js       Express app + routes + static serving
    db.js           SQLite persistence (node:sqlite)
    auth.js         session helpers
    policy.js       approval gate + governance logic
    seed.js         fixture/seed helpers
  public/
    index.html      Web UI
    app.js          Browser logic
    styles.css
  test/
    smoke.mjs       Automated acceptance + smoke tests
    docker-smoke.sh Docker Compose smoke script
  fixtures/
    acceptance.json Fixture data for acceptance criteria
  data/
    .gitkeep
```

## Test strategy

- Node built-in test runner (`node --test`) for unit + integration smoke:
  - registers users, apps, submits releases, verifies gate blocks unapproved release, verifies approval unblocks, rejection blocks, ownership change logged.
  - governance checklist blocks until confirmed + signed off.
  - CI webhook flags shadow IT and blocks deployment until registered.
  - audit log contains required entries (approver, timestamp, scope change).
- Docker Compose smoke: builds image, starts service, runs `docker-smoke.sh` which exercises the three acceptance scenarios over HTTP.

## Acceptance checks (from issue #80)

1. **Scope expansion blocked**: App owned by `dev-a` for `team-b`, current scope `read-only reports`; new release expanding to `write billing records` is blocked until designated reviewer approves; audit log records approver, timestamp, requested scope change.
2. **New app governance**: Developer registers new tool (`dev-b`, `team-c`, `read-only`); system generates governance checklist; launch blocked until owner confirms scope and reviewer signs off.
3. **Shadow IT detection**: CI webhook reports unregistered file modification; system flags as shadow IT and blocks deployment until registered with owner or formally retired; audit log captures detection and resolution.

All three must pass in automated smoke test and Docker Compose smoke.

## Footer / About requirement

README includes an "About AaronWiseAI" section and footer link, matching repository conventions; package.json includes `"homepage": "https://aaronwiseai.com/"`.