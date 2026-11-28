# Agent Job Durability & Resume

A local-first web service and small CLI shim that captures an AI coding agent job’s objective, acceptance criteria, outstanding steps, and per-step checkpoints, persists them to SQLite, marks jobs suspended on interruption, and on resume revalidates the workspace (`git status`, file hashes, test results context) against the checkpoint and replans stale steps without replaying completed effects.

Built for developers running long-running agent work (Codex, Claude Code, OpenCode) who need durable state across interruptions.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Features (MVP)

- **Durable job records**: objective, acceptance criteria, steps, status in a local SQLite database (`.local/agent-job-durability-resume.sqlite` by default).
- **Checkpoints**: capture file hashes (tracked files via `git ls-files`, with fallback), `git status --porcelain`, optional test notes/results.
- **Suspend/resume**: mark jobs suspended; resume revalidates the workspace against the latest checkpoint, flags changed files and marks affected pending steps stale, and produces a replan summary (completed steps preserved, no replay of completed effects). Resume marks stale steps and returns a plan; it does **not** automatically requeue or replace steps — apply the revised plan with `POST /jobs/:id/apply` (or `PATCH /steps/:id`) and re-run steps yourself. Acceptance checks run shell commands; bind the service to localhost (default `--host 127.0.0.1`) unless you trust all callers.
- **Acceptance-gated completion**: a job is completed only after all steps are complete and configured acceptance checks pass; otherwise it is marked blocked with a reason.
- **Effect ledger (dedup)**: record external effects with a stable `effectKey`; re-recording the same key is treated as a duplicate (no duplicate external effects).

## Requirements

- Node.js >= 22 (uses built-in `node:sqlite`)

## Install / build

```bash
cd agent-job-durability-resume
npm ci
npm run build
```

## Run the service

```bash
npm run start -- serve --port 8787 --repo /path/to/your/git/repo --db .local/agent-job-durability-resume.sqlite
```

## HTTP API (minimal)

- `POST /jobs` — create a job `{ objective, acceptanceCriteria: string[], steps: [...] }`
- `GET /jobs` — list jobs
- `GET /jobs/:id` — job + steps + latest checkpoint
- `POST /jobs/:id/checkpoint` — capture checkpoint `{ stepId?, testResults?, notes? }`
- `POST /jobs/:id/suspend` — mark suspended `{ reason? }`
- `POST /jobs/:id/resume` — revalidate + replan (marks stale steps)
- `POST /jobs/:id/complete` — complete only if steps done and `acceptanceCriteriaChecks` all pass
- `PATCH /steps/:id` — update step status (used by agent integration)
- `POST /jobs/:id/effects` — record external effect with `effectKey` dedup
- `POST /jobs/:id/replan` — regenerate the resume plan without marking steps stale
- `POST /jobs/:id/apply` — transition selected stale steps back to pending (apply revised plan)

## Tests

```bash
npm test
```

Runs an offline acceptance suite that covers the issue #127 acceptance cases (interruption after step 1, external file change detected on resume, completion gated by acceptance criteria, effect dedup).

## License

MIT — see `LICENSE`.

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/