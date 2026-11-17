# Agent Job Durability & Resume — PLAN

## Goal
Build a practical, open-source web service plus small CLI shim that captures an agent job’s objective, acceptance criteria, outstanding steps, and per-step checkpoints as it runs, persists them to a database (SQLite via `node:sqlite`), marks the job suspended on interruption, and on resume revalidates the workspace (`git status`, file hashes, test results context) against the checkpoint and replans stale steps without replaying completed effects.

## Users
- Developers using AI coding-agent CLIs (Codex, Claude Code, OpenCode) for multi-hour engineering work who experience interruptions and need durable job state and safe resume.

## Files
- `package.json`, `LICENSE` (MIT), `PLAN.md`, `README.md`
- `src/types.ts`, `src/db.ts`, `src/workspace.ts`, `src/revalidate.ts`, `src/replan.ts`, `src/acceptance.ts`, `src/server.ts`, `src/cli.ts`
- `test/acceptance.mjs`
- `dist/` (generated)

## Test Strategy
- Offline acceptance tests (Node 22+, built-in `node:sqlite`, no paid APIs).
- Start the HTTP service in a temp git repo, exercise:
  1. Create a 2-step job, checkpoint after step 1 complete, suspend → persisted with completed edit and pending build identifiable after “restart”.
  2. Externally modify a file after suspension; on resume, workspace revalidation detects change and plan is revised (stale steps / actions).
  3. Completion only when acceptance criteria pass (otherwise blocked); effect ledger deduplicates external effects.

## Acceptance (from issue #127)
1. Fixture: a 2-step job (file edit plus build) interrupted after step 1; after restart the same Job ID exists marked unfinished with the completed edit and pending build identifiable.
2. Failure case: externally modify a file the next step depends on during suspension; on resume the service detects the change and revises the plan instead of overwriting.
3. Pass or fail: Job reaches completed only after acceptance criteria are checked; otherwise blocked with a specific reason; no duplicate external effects.

## Milestones
- M1 (this ticket): SQLite persistence, checkpoint capture, suspend/resume, workspace revalidation (git status + file hashes), replan marking stale steps, acceptance-gated completion, effect dedup, CLI `serve` + acceptance tests.
- Future: multi-agent child ownership/recovery, richer effect ledger semantics, auth/audit, Docker deploy + smoke test, richer step executors.