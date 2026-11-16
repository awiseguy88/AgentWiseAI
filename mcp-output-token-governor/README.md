# MCP Output Token Governor

A local, offline-first MCP proxy that sits between an AI agent and each MCP server. It applies a per-server/tool token budget to tool results, truncates oversized results with a clear truncation marker, and emits a JSON/HTML report of bytes (and tokens) saved.

## Problem

MCP servers can return enormous raw JSON tool results (logs, search hits, API dumps) that hosts inject verbatim into the agent context. Tool-heavy agents pay this cost on every turn and can hit context-budget errors. This tool is a standalone, per-server tool-result budget you can run against your own MCP servers, offline.

## Who it helps

Developers and small teams using Claude Code, Cursor, Codex, or other coding agents with multiple MCP servers, especially when a search/list tool returns a large payload mid-task.

## Features (MVP)

- Local proxy that enforces a token budget on tool results.
- Clear truncation marker when output is trimmed.
- JSON and HTML reports of bytes/tokens saved (`report.json`, `report.html`).
- Offline operation; no paid APIs.
- No native dependencies (Node.js only).

## Install

```bash
cd mcp-output-token-governor
npm install
```

## Quick start

### HTTP mode

```bash
npm start
# or
node src/cli.js http --port 8787
```

The server exposes:
- `POST /call` with JSON `{"server":"default","tool":"search","args":{}}`
- `GET /report` (JSON)
- `GET /report.html`
- `GET /health`

### stdio mode (agent config)

Point your agent config at the proxy instead of the real MCP server:

```bash
node src/cli.js stdio --config ./config.json
```

The proxy reads JSON-RPC 2.0 messages from stdin, forwards them to the real MCP server, and intercepts `tools/call` results to apply the budget before writing the governed result to stdout.

### Trust model

The config drives which MCP server command is spawned (operator-supplied `command`/`args`). The tool runs locally and does not sandbox the spawned MCP server: it trusts the operator's configured servers. This is an intentional local-first trust model; do not point `command` at untrusted executables. No network calls are made to external services by the governor itself.

### Connection reuse

A shared server pool (one initialized MCP client per configured server) is reused across calls and HTTP requests instead of spawning a fresh subprocess per tool call.

### Verify (baseline vs governed)

Run the included verify flow against the recorded fake server:

```bash
npm run verify
# or
node src/cli.js verify --out ./outputs
```

This writes `report.json` and `report.html` and prints a JSON summary. A successful run means the post-governed token total is lower than the baseline.

### Generate a report from recorded runs

```bash
npm run report -- --out ./outputs
```

## Config

Create a JSON config file (example):

```json
{
  "defaultBudget": 2000,
  "servers": {
    "myserver": {
      "transport": "stdio",
      "command": "node",
      "args": ["./path/to/my-mcp-server.js"],
      "budget": 2000,
      "tools": {
        "search": 1500
      }
    }
  }
}
```

Then run:

```bash
node src/cli.js http --config ./config.json
```

## How budgets work

- Budgets are expressed as approximate token counts (a deterministic, dependency-free tokenizer).
- If a tool result is already under budget, it is passed through byte-identical (no false truncation).
- If it is over budget, the result is truncated and a clear truncation marker is appended so the agent knows the output is incomplete.

## Tests / smoke check

```bash
npm test
```

Runs `node --test test/smoke.test.js` (offline). The suite covers:
1. Over-budget recorded results are truncated under budget with a marker.
2. Under-budget results pass through byte-identical.
3. `verify` confirms post-governed totals are lower than the baseline for a sample five-tool config.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## License

MIT.