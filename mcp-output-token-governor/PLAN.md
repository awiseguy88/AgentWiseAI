# MCP Output Token Governor - Build Plan

## Goal
Build a small, self-contained, offline-first tool in its own subfolder: a local stdio/HTTP MCP proxy that sits between an AI agent and each MCP server, applies a per-server/per-tool token budget to tool results, truncates oversized results with a clear truncation marker, and emits a JSON/HTML report of bytes (and tokens) saved.

## Problem
MCP servers can return enormous raw JSON tool results (logs, search hits, API dumps) that hosts inject verbatim into the agent context. Tool-heavy agents pay this on every turn of a loop, and context-budget errors can appear without any tool execution. There is no standalone per-server tool-result budget that developers can run against their own MCP servers.

## Users
Developers and small teams using Claude Code, Cursor, Codex, or other coding agents with multiple MCP servers, especially when a search/list tool returns a large payload mid-task.

## Files
- `PLAN.md` - this build plan.
- `package.json` - metadata and scripts (`start`, `test`, `verify`).
- `README.md` - setup, usage, config, behavior, report format, and About AaronWiseAI section.
- `LICENSE` - MIT (matches repository license).
- `src/tokenizer.js` - deterministic, dependency-free token counter (approximate GPT-style tokenization).
- `src/config.js` - load/normalize config (per-server and per-tool budgets, default budget, truncation marker).
- `src/budget.js` - apply token budget to a tool result, truncate with a clear marker, return savings.
- `src/reporter.js` - accumulate savings and emit JSON and HTML reports.
- `src/mcp-client.js` - JSON-RPC 2.0 client over a child MCP server process (newline-delimited stdio).
- `src/governed-server.js` - wraps a child MCP server, exposes `callTool` with budget enforcement and savings tracking.
- `src/stdio-proxy.js` - stdio JSON-RPC relay: agent <-> proxy <-> real MCP server, intercepting `tools/call` results.
- `src/http-server.js` - HTTP mode: POST `/call`, GET `/report` (JSON), GET `/report.html`, GET `/health`.
- `src/cli.js` - CLI entry (`stdio`, `http`, `verify`, `report`).
- `test/fake-mcp-server.js` - recorded fake MCP server returning over-budget JSON for smoke/verification.
- `test/smoke.test.js` - `node --test` smoke checks covering acceptance criteria.

## Modules / components
- **Tokenizer (`src/tokenizer.js`)**: deterministic regex tokenizer counting words + punctuation. Approximate but stable, no native deps.
- **Budget engine (`src/budget.js`)**: binary-search character truncation to fit a token budget while reserving room for a clear truncation marker; returns `{result, saved}` and passes through byte-identical when under budget.
- **Governed server (`src/governed-server.js` + `src/mcp-client.js`)**: spawns a real MCP server, performs the `initialize` handshake, forwards `tools/list`, and intercepts `tools/call` to apply per-tool/per-server budgets.
- **Proxies (`src/stdio-proxy.js`, `src/http-server.js`)**: two transports the agent can point at; both share the governed server core.
- **Reporter (`src/reporter.js`)**: accumulates per-call and per-tool savings, writes JSON (`report.json`) and a self-contained HTML report with totals.
- **CLI (`src/cli.js`)**: `stdio`/`http` run modes, `verify` for baseline-vs-governed comparison, `report` for emission.

## Test strategy
- Automated smoke tests (`node --test test/smoke.test.js`):
  - Start the fake MCP server returning a >2,000-token JSON result; run the governed server in-process; assert the result is under budget, contains the truncation marker, and runs offline.
  - Assert a small result passes through byte-identical (no false truncation).
  - Run `verify` against a sample five-tool config and assert post-change total tokens are lower than the baseline.
  - Exercise the stdio proxy end-to-end by piping a scripted JSON-RPC session.
  - Exercise the HTTP `/call` and `/report` endpoints.
- Manual smoke check: recorded stdio replay demo confirming truncated output with a marker and a JSON/HTML report of bytes saved.

## Acceptance checks
- [ ] (1) Given a recorded MCP tool result larger than a 2,000-token budget, the proxy returns truncated output under budget with a truncation marker and runs offline.
- [ ] (2) A result already under budget passes through byte-identical (no false truncation).
- [ ] (3) `--verify` on a sample five-tool config confirms the post-change reported token total is lower than the baseline.
- [ ] Tool lives in its own subfolder (`mcp-output-token-governor/`) with README and tests/smoke check.
- [ ] Independent of other tools; no harness or unrelated workspace modifications.
- [ ] No paid APIs; Node.js tokenizer only; no native dependencies.
- [ ] Commits use runtime-configured repository author identity.