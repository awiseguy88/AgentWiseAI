# Agent Background Job Ledger — PLAN

## Goal
Build a durable job ledger (SQLite/Postgres) that registers a background job owned by a tenant/thread/turn, runs a command, captures exit status and bounded scrubbed output, delivers the completion notice at-least-once to the owning turn (steer into active run or surface as a prompt), replays unacknowledged notices after a crash, and reaps orphan jobs whose owner turn is gone.

## Users
- AI-agent builders and developers who run coding agents (Claude Code, Codex CLI, OpenCode) that delegate long work to background sub-agents
- Teams needing reliable delivery of background job completions to the originating turn

## Files
- `package.json` — package manifest (homepage: https://aaronwiseai.com/, type: module, bin: cli)
- `LICENSE` — MIT
- `PLAN.md` — this file
- `README.md` — with About AaronWiseAI section and required footer
- `tsconfig.json` — TypeScript config (NodeNext, outDir: dist, strict)
- `src/types.ts` — shared ledger/notice/job types
- `src/db.ts` — SQLite schema (jobs, notices, turns), CRUD, migrations
- `src/scrub.ts` — bounded output scrubbing (PII/secret redaction, size limit)
- `src/runner.ts` — spawn command, capture exit status + scrubbed stdout/stderr
- `src/notice.ts` — at-least-once delivery: record notice, ack, replay unacked on startup
- `src/reaper.ts` — reap orphan jobs (turn gone) to dashboard/surface
- `src/cli.ts` — CLI entrypoint: register, run, list, notice-replay, reap, demo
- `examples/demo-scenario.json` — sample 2-job scenario
- `test/fixtures/` — test fixtures (sample commands, expected outputs)
- `test/acceptance.mjs` — offline acceptance tests (npm test = build + run)
- `dist/` — compiled output (gitignored)

## Test Strategy
- All tests offline; no external services or paid APIs
- Use node:sqlite (built-in) for durable storage
- Use node:child_process.spawn for command execution
- Scenarios:
  1. **Crash recovery**: launch a background build, kill host mid-run, restart → completion still arrives at owning turn, job not re-run
  2. **Exit-status fidelity**: failing command like `cargo test | tail` (masks tail's 0) reports failing test stage exit code with bounded scrubbed output
  3. **Orphan reaping**: orphan job whose owning turn no longer exists is reaped and surfaced in dashboard rather than silently lost
  4. **At-least-once notice**: notice recorded before completion, acked by turn, unacked notices replayed on startup
  5. **Scrubbing**: bounded output, secrets redacted (API keys, tokens), size capped

## Acceptance Checks (from issue #88)
1. Launch a background build from a sub-agent, kill and reload the host mid-run; after restart the completion still arrives at the owning turn and the job is not re-run.
2. A failing command such as `cargo test | tail` that masks tail's exit status reports the failing test stage, not tail's 0, with bounded scrubbed output.
3. Failure case: an orphan job whose owning turn no longer exists is reaped and surfaced in the dashboard rather than silently lost.

## Milestones
- **M1 (this ticket, end-to-end now)**: SQLite job ledger, runner, scrubber, notice delivery/ack/replay, orphan reaper, CLI with demo, acceptance tests pass.
- **M2 (future)**: Postgres adapter, multi-tenant auth, team ownership
- **M3 (future)**: Observability dashboard (running/orphaned jobs, cost, retry counts)
- **M4 (future)**: Recovery/replay of orphaned jobs against same sandbox generation, Docker deploy + smoke test

## Git Discipline
- Branch: agent/agent-background-job-ledger-<ticket-suffix>
- Small logical commits with clear messages
- Run `npm test` for each commit
- Fetch and merge main before opening/merging PR
- Never force-push unless branch history requires it
- Delete branch after merge; leave only main

## Remaining Milestones Record
PLAN.md will be updated as milestones complete. M1 is the current scope.