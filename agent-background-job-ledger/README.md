# Agent Background Job Ledger

Durable background job ledger (SQLite/Postgres) that registers a background job owned by a tenant/thread/turn, runs a command, captures exit status and bounded scrubbed output, delivers the completion notice at-least-once to the owning turn (steer into active run or surface as a prompt), replays unacknowledged notices after a crash, and reaps orphan jobs whose owner turn is gone.

Between a coding agent (Claude Code, Codex CLI, OpenCode) and the long background commands it delegates to, this ledger is the clean way back when the spawning sub-agent turn ends — without modifying the agent and without any paid APIs.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## Why

Coding agents routinely spawn sub-agents that launch long background commands (builds, test suites, package installs, fetch loops). When the spawning sub-agent turn ends, completion notifications never surface to the parent session, results become unretrievable ("No task found with ID"), and the work is silently orphaned — sitting unmerged, un-reviewed, or re-run by hand. This tool binds background job completions to the owning turn with at-least-once delivery and orphan reaping for coding agents.

## MVP behavior

- **Durable job ledger**: local SQLite ledger at `.local/agent-background-job-ledger.sqlite` (configurable via `--ledger`). Each job is registered with an owner (tenant/thread/turn), runs a command, and records exit status and bounded scrubbed output.
- **Exit-status fidelity**: commands run under `bash -c`. Use `--pipefail` to wrap with `set -o pipefail` so pipelines like `cargo test | tail` report the failing stage's exit code, not the last command's 0.
- **Bounded scrubbed output**: stdout/stderr are redacted for common secret patterns (API keys, tokens, private keys) and capped at 16KB by default.
- **At-least-once notice delivery**: a completion notice is recorded before delivery. It can be delivered (steer into active run or surface as a prompt), acked by the owning turn, and replayed after a crash.
- **Crash replay**: on restart, unacknowledged notices are replayed; jobs are not re-run.
- **Orphan reaping**: jobs whose owning turn is gone are reaped and surfaced in the reap records (dashboard reads this table) rather than silently lost.

## Install / build

Requires Node.js >= 22 (uses `node:sqlite` and `node:crypto` built-ins). No external runtime dependencies.

```bash
# From inside this folder
npm install          # devDependencies (TypeScript) only
npm run build        # compile src/ to dist/
npm test             # build + run offline acceptance checks
```

Then run:

```bash
node dist/cli.js --help
```

## Run the demo

The demo runs 3 background jobs (success, pipefail failure, secret scrubbing), delivers notices, acks one, simulates a crash (turn goes away), reaps orphans, and replays unacked notices:

```bash
npm run demo
```

## Commands

```bash
# Register and run a command (pipefail recommended for pipelines)
agent-background-job-ledger register --command "npm run build" --pipefail

# List jobs (filterable)
agent-background-job-ledger list --status running
agent-background-job-ledger list --tenant t1 --thread th1 --turn tu1

# List notices
agent-background-job-ledger notices

# Acknowledge a notice
agent-background-job-ledger ack --notice <id>

# Replay unacknowledged notices (after crash)
agent-background-job-ledger replay
agent-background-job-ledger replay --tenant t1 --thread th1 --turn tu1

# Reap orphan jobs whose owning turn is gone
agent-background-job-ledger reap
```

## Programmatic API

```ts
import { LedgerDb } from "./dist/db.js";
import { registerAndRunJob } from "./dist/runner.js";
import { NoticeService } from "./dist/notice.js";
import { Reaper } from "./dist/reaper.js";

const db = new LedgerDb(".local/agent-background-job-ledger.sqlite");
const { job, noticeId } = await registerAndRunJob(
  db,
  { tenant: "t1", thread: "th1", turn: "tu1" },
  "npm run build",
  [],
  { capturePipefail: true }
);

const service = new NoticeService(db);
service.deliver(noticeId);
service.ack(noticeId);

const reaper = new Reaper(db);
const { reaped, kept } = reaper.reapOrphans();
```

## Files

- `package.json` — package manifest (homepage: https://aaronwiseai.com/).
- `LICENSE` — MIT.
- `PLAN.md` — goal, users, files, test strategy, acceptance checks, remaining milestones.
- `README.md` — this file.
- `src/types.ts` — shared ledger/notice/job types.
- `src/db.ts` — SQLite schema (jobs, notices, turns, reaps), CRUD, migrations.
- `src/scrub.ts` — bounded output scrubbing (PII/secret redaction, size limit).
- `src/runner.ts` — spawn command, capture exit status + scrubbed stdout/stderr.
- `src/notice.ts` — at-least-once delivery: record notice, ack, replay unacked on startup.
- `src/reaper.ts` — reap orphan jobs (turn gone) to dashboard/surface.
- `src/cli.ts` — CLI entrypoint: register, run, list, notice-replay, reap, demo.
- `examples/demo-scenario.json` — sample 3-job scenario definition.
- `fixtures/sample-build-output.txt` — sample build output fixture.
- `test/acceptance.mjs` — offline acceptance tests.
- `dist/` — compiled output (gitignored).

## Smoke check / tests

```bash
npm test
```

Runs `tsc` then `node test/acceptance.mjs`, which exercises all acceptance checks offline with fixture mocks and no paid APIs:

1. Crash recovery: launch a background job, kill and reload the host mid-run; after restart the completion still arrives at the owning turn and the job is not re-run.
2. Exit-status fidelity: a failing command such as `cargo test | tail` that masks tail's exit status reports the failing test stage, not tail's 0, with bounded scrubred output.
3. Orphan reaping: an orphan job whose owning turn no longer exists is reaped and surfaced in the dashboard rather than silently lost.
4. At-least-once notice delivery: notice recorded before completion, acked by turn, unacked notices replayed on startup.
5. Secret scrubbing: bounded output, secrets redacted (API keys, tokens), size capped.
6. Job lifecycle state machine: registered → running → completed/failed → reaped.
7. Multi-owner isolation: jobs isolated by tenant/thread/turn.
8. Reaper keeps jobs with active owner turns.

## License

MIT License. Copyright (c) 2026 AaronWiseAI.

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/