# PLAN.md — Agent Compensation Relay

## Goal
Build a dependency-light Node CLI that acts as a local relay/proxy for agent tool calls that mutate external state. It records every tool call in a local JSON ledger before execution using an idempotency key `<run_id>:<tool_call_id>`, caches completed results so replays never re-run external effects, pauses writes with unknown outcomes for reconciliation, and runs registered compensations in reverse order on abort. The first usable workflow demonstrates a 3-step task where step 2 fails after committing: step 1 is compensated exactly once, step 3 never runs, and a JSON residue report lists each step's outcome.

## Users
- Developers and small teams running coding agents (Claude Code, Codex, Cursor, etc.) against MCP servers, connectors, or local tool integrations where agent runs mutate customer-visible systems.
- Engineers who need offline, agent-CLI-agnostic protection from duplicate side effects, orphaned writes, and unrecoverable partial failures.

## MVP scope (this milestone)
- **Ledger & idempotency:** local JSON ledger file stores run/step records. Each tool call gets key `<run_id>:<tool_call_id>` recorded **before** execution. States track pending/executed/failed/compensated/reconciled/unknown.
- **Cached replays:** if the same idempotency key is retried after a completed result is recorded, return the recorded result without invoking the external API again.
- **Pending writes / unknown outcomes:** writes get one attempt; if outcome is indeterminate (e.g. timeout/unknown after commit signal), mark paused for reconciliation and stop unsafe automatic progression.
- **Compensation on abort:** each step can register a compensation action. On abort/failure, compensations run in reverse order of successfully committed steps; each compensation executes at most once per run.
- **Residue report:** JSON report listing each step's outcome, compensation status, and any residue/unknowns.
- **CLI:** dependency-light Node CLI (TypeScript compiled, no runtime deps beyond Node stdlib) with commands to run a scenario/demo and inspect/report ledger state.
- **Mock external API + demo:** offline fixture mock API and a scripted 3-step agent task where step 2 fails after committing. Demo proves step 1 compensated exactly once and step 3 never runs.
- **Tests:** automated offline tests covering acceptance checks.

## Non-goals (future milestones, recorded)
- Per-role allow/deny policies.
- Full reconciliation CLI workflow for indeterminate calls beyond MVP pause/report hooks.
- Operator escalation with register attached.
- Dashboard view of residue.
- Generic SaaS/runtime rewrite of agent code.

## Files
- `PLAN.md` — this plan.
- `LICENSE` — MIT license (AaronWiseAI).
- `README.md` — usage, demo, acceptance checks, About AaronWiseAI section/footer.
- `package.json` — metadata, scripts, homepage `https://aaronwiseai.com/`, bin entry.
- `tsconfig.json` — TypeScript config (Node >= 18).
- `src/cli.ts` — CLI entrypoint.
- `src/types.ts` — shared types for ledger/steps/results.
- `src/ledger.ts` — JSON ledger load/save, idempotency lookup, state transitions.
- `src/relay.ts` — execution engine: record-before-exec, cache replay, compensation/abort handling, residue report.
- `src/mockApi.ts` — offline mock external API fixtures for demo/tests.
- `demo/run-demo.mjs` (or compiled demo script) — runs the 3-step failing scenario and prints residue report.
- `examples/three-step-scenario.json` — sample scenario definition.
- `test/acceptance.mjs` — offline acceptance tests.

## Test strategy
- **Automated (offline, no paid APIs):** Node test script (`npm test` builds then runs tests) using fixture mocks.
  - Acceptance (1): 3-step run where step 2 times out after committing -> step 1 compensation runs exactly once, step 3 never runs, JSON residue report lists each step outcome.
  - Acceptance (2): retry same call with same idempotency key after completion -> relay returns recorded result without invoking external API again.
  - Additional: replay after partial run does not duplicate compensated effects; compensation order is reverse.
- **Manual demo:** `npm run demo` (or documented command) runs the mock scenario and shows the residue report.

## Acceptance checks
1. Given a sample agent run with 3 tool calls where step 2 times out after committing, the relay runs step 1's compensation exactly once, never re-runs step 3, and outputs a JSON residue report listing each step's outcome.
2. Given a retry of the same call with the same idempotency key after completion, the relay returns the recorded result without invoking the external API again.
Both checks run offline with fixture mocks and no paid APIs.

## Dependencies
- Runtime: none (Node.js >= 18 stdlib only).
- Dev: TypeScript and `@types/node` for build (kept minimal).

## Future milestones (recorded)
1. **MVP (this build):** ledger/idempotency, cached replays, unknown-outcome pause, reverse-order compensation, residue JSON, demo + tests.
2. **Policy & reconciliation:** per-role allow/deny policies, reconciliation CLI for indeterminate calls.
3. **Operations:** operator escalation with register attached, dashboard view of residue (what was put back, what remains, what never fired).
