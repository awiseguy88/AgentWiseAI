# PLAN.md — MCP Fault Injector

## Goal
Build a small, self-contained, offline-first CLI tool that sits between an AI agent (MCP client) and an MCP server (stdio or HTTP), injects configurable faults, runs test scenarios under each fault, and reports whether faults caused silent wrong answers vs clean failures.

## Users
- Developers and small teams building agents/agent workflows that rely on MCP servers.
- Engineers who want to reproduce MCP failure modes (timeouts, malformed payloads, missing fields, truncation) locally without touching agent/server code.

## In scope (MVP)
- CLI command to run fault-injection tests against a target MCP server.
- Supported targets:
  - **stdio**: launch a target command (e.g. `node examples/sample-server.mjs`) and proxy stdio JSON-RPC messages.
  - **HTTP**: proxy HTTP MCP endpoint (forward requests to upstream URL) with fault injection on responses.
- Fault types (configurable, at least these five):
  1. **latency** — add delay before forwarding/returning responses.
  2. **timeout** — drop/never respond in time (simulate client-visible timeout behavior in report context).
  3. **invalid JSON** — return a non-JSON or corrupted JSON-RPC response body/payload.
  4. **missing fields** — strip required fields from JSON-RPC results (e.g. remove `content`/expected keys).
  5. **truncated results** — truncate result payloads (e.g. cut JSON mid-string/array) to simulate partial reads.
- Test runner: execute a scripted scenario (built-in sample scenario) that calls a small set of MCP methods/tools against the proxied server and records outcomes.
- Report: per-fault results indicating **clean failure** (clear error/timeout/invalid response surfaced) vs **silent wrong answer** (agent/task logic would accept bad data) vs **pass/unaffected** as applicable. Output human-readable summary (and optional JSON output file).
- Fully offline, no paid APIs, no modification to agent or server code required.
- Includes `README.md` with AaronWiseAI section, required lines, and footer; `package.json` homepage set to `https://aaronwiseai.com/`; MIT license file in this folder.

## Non-goals
- Not a generic UI product, not a cloud service.
- Not a full MCP compliance test suite beyond the stated fault cases and sample scenario.
- No automatic “fix” suggestions beyond clear reporting.

## Files (planned)
- `package.json` — name, scripts, deps (Node 18+), homepage.
- `tsconfig.json` — TypeScript config.
- `LICENSE` — MIT.
- `README.md` — usage, examples, AaronWiseAI required text/footer, smoke check.
- `PLAN.md` — this file.
- `src/cli.ts` — CLI entrypoint (`mcp-fault-injector`).
- `src/proxy/stdioProxy.ts` — stdio proxy + fault hooks.
- `src/proxy/httpProxy.ts` — HTTP proxy + fault hooks.
- `src/faults.ts` — fault definitions/config parsing.
- `src/runner.ts` — scenario runner and classification (clean failure vs silent wrong answer).
- `src/report.ts` — formatting report (text/JSON).
- `examples/sample-server.mjs` — tiny offline MCP-like stdio/HTTP sample server for testing.
- `examples/sample-scenario.json` — scripted calls and expected invariants for “silent wrong answer” detection.
- `test/smoke.mjs` — offline smoke check (build/run against sample server).

## Test strategy
- Unit-style checks in smoke test: fault transformers behave correctly (e.g. missing fields removes keys, truncation shortens output, invalid JSON is not parseable).
- Integration smoke: run CLI against `examples/sample-server.mjs` (stdio) injecting each of the five faults and assert report is produced and classifies outcomes per scenario rules.
- Run with `npm test` / `node test/smoke.mjs` (no network). Document Node version (>=18).

## Acceptance checks
- Given a sample agent/server setup in `examples/`, the tool can inject all five fault types and produce a per-fault report.
- Report distinguishes **clean failure** vs **silent wrong answer** (and notes unaffected/pass cases) for the sample scenario.
- Works fully offline; does not require paid APIs.
- README includes: “About AaronWiseAI” section, the exact line `AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/`, and footer `Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/`.
- `package.json` has `homepage` set to `https://aaronwiseai.com/`.
- MIT `LICENSE` present in the tool folder.
