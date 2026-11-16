# Agent Compensation Relay

Offline-first CLI relay for agent tool calls that mutate external state. Every tool call gets an idempotency key `<run_id>:<tool_call_id>` recorded in a local JSON ledger **before execution**; completed results are cached so replays never re-run external effects; writes with unknown outcomes are paused for reconciliation; compensations run in reverse order on abort, exactly once per committed step.

Between a coding agent (Claude Code, Codex, Cursor, or any CLI/tool integration) and the systems it writes to, this relay is the clean way back when a later step fails — without modifying the agent and without any paid APIs.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## Why

Agents run multi-step workflows that mutate customer-visible state — reserve stock, charge a card, create a ticket, send an email. When a later step fails, earlier effects stay in place. Retrying can double-charge; doing nothing leaves orphaned work. This tool records intent before execution, caches outcomes, and unwinds committed steps in reverse order when a run aborts, emitting a JSON residue report of what was put back, what remains unknown, and what never fired.

## MVP behavior

- **Idempotency ledger**: local JSON ledger at `.local/agent-compensation-relay-ledger.json` (configurable via `--ledger`). Each tool call is recorded with key `<run_id>:<tool_call_id>` before it runs.
- **Cached replays**: retrying a completed call with the same idempotency key returns the recorded result; the external API is not invoked again.
- **Unknown outcomes paused**: writes get one attempt; if the outcome is indeterminate (e.g. timeout after commit signal), the step is marked `unknown` and paused for reconciliation instead of being blindly retried or compensated.
- **Reverse-order compensation**: on abort, compensations for committed steps run in reverse order, each at most once per run.
- **Residue report**: JSON output listing each step's outcome, compensation status, and the run's aborted state.

## Install / build

Requires Node.js >= 18. No external runtime dependencies.

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

The demo runs a 3-step agent task against an offline mock external API where step 2 commits then times out with an unknown outcome:

```bash
npm run demo
```

Expected result:

1. Step 1 `reserveStock` executes (server-side committed).
2. Step 2 `chargeCard` commits server-side but times out; outcome unknown → paused for reconciliation.
3. On abort, step 1's compensation `releaseReservation` runs exactly once.
4. Step 3 `sendEmail` never runs.
5. A JSON residue report lists each step's outcome.

Demo output shows `mockExternalApiCalls` — `reserveStock`, `chargeCard`, `releaseReservation` only — proving step 3 was never invoked and step 1 was compensated exactly once.

## Replay / idempotency check

```bash
node dist/cli.js demo        # first run (records ledger)
node dist/cli.js replay-demo # replay of the same run id
```

The replay makes **no external API calls** and returns the recorded state (cache hit).

## Custom scenarios

Create a scenario JSON file (see `examples/three-step-scenario.json`):

```json
{
  "runId": "run-1",
  "ledger": ".local/agent-compensation-relay-ledger.json",
  "steps": [
    { "toolCallId": "tc-1", "tool": "reserveStock", "args": { "item": "widget", "qty": 1 }, "compensate": "releaseReservation" },
    { "toolCallId": "tc-2", "tool": "chargeCard", "args": { "reservationId": "res-1", "amount": 4999 }, "compensate": "reverseCharge" },
    { "toolCallId": "tc-3", "tool": "sendEmail", "args": { "to": "customer@example.com" } }
  ]
}
```

The CLI exposes:

- `demo` — built-in 3-step failing scenario vs the mock API.
- `report --ledger <path> --run <runId>` — dump a run's ledger record.

Programmatic API: `runWithRelay({ runId, ledgerPath, steps })` from `dist/relay.js`.

## Files

- `package.json` — package manifest (homepage: https://aaronwiseai.com/).
- `LICENSE` — MIT.
- `PLAN.md` — goal, users, files, test strategy, acceptance checks.
- `README.md` — this file.
- `src/cli.ts` — CLI entrypoint (`demo`, `replay-demo`, `report`).
- `src/types.ts` — shared ledger/step/report types.
- `src/ledger.ts` — JSON ledger load/save and record helpers.
- `src/relay.ts` — execution engine: record-before-execute, cached replays, reverse-order compensation, residue report.
- `src/mockApi.ts` — offline mock external API fixtures used by the demo and tests.
- `examples/three-step-scenario.json` — sample 3-step scenario definition.
- `test/acceptance.mjs` — offline acceptance tests.
- `dist/` — compiled output (gitignored).

## Smoke check / tests

```bash
npm test
```

Runs `tsc` then `node test/acceptance.mjs`, which exercises both acceptance checks offline with fixture mocks and no paid APIs:

1. 3-step run where step 2 times out after committing → step 1's compensation runs exactly once, step 3 never runs, JSON residue report lists each step's outcome.
2. Retry of the same call with the same idempotency key after completion → recorded result returned without invoking the external API again.

## License

MIT License. Copyright (c) 2026 AaronWiseAI.

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
