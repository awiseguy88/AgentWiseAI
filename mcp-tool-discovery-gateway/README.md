# MCP Tool Discovery Gateway

Local Node.js gateway/service and CLI that connects to configured stdio/HTTP MCP servers, builds a searchable local tool index (name, description, schema hash, server, tags), and exposes a proxy interface where agents search/list matching tools first and only fetch full schemas or invoke selected tools on demand.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Why

Teams connecting multiple MCP servers to coding agents often load every tool schema up front, consuming large context budgets before work begins and degrading tool selection. This gateway moves from static loading to dynamic discovery: search, fetch only requested schemas, then invoke.

## Features (first workflow)

- Connect to configured **stdio** and **HTTP** MCP servers.
- Searchable local tool index: name, description, schema hash, server, tags.
- Proxy operations: `search`/`list`, `schema` (fetch full schema on demand), `invoke`.
- Policy controls: allow/deny by server/tool and max schema/results budget hooks.
- Audit/report output: JSON (and HTML) with tool usage, requested schemas loaded, estimated tokens avoided, and failures.
- Fixture servers and smoke demo proving schemas are not preloaded.

## Install / build

Requires Node.js >= 18.

```bash
cd mcp-tool-discovery-gateway
npm install
npm run build
```

## CLI

```bash
node dist/cli.js --help
node dist/cli.js index --config fixtures/config.demo.json
node dist/cli.js search --config fixtures/config.demo.json --query "failed ci"
node dist/cli.js schema --config fixtures/config.demo.json --tool github_ci.list_failed_runs
node dist/cli.js invoke --config fixtures/config.demo.json --tool github_ci.list_failed_runs --args '{"repo":"acme/app"}'
node dist/cli.js serve --config fixtures/config.demo.json --port 8787
node dist/cli.js demo --config fixtures/config.demo.json --out examples/demo-output
```

## Demo (before/after accounting)

Run the deterministic smoke demo against 3 fixture MCP servers (>=20 tools total):

```bash
npm run smoke
```

This discovers and invokes 2 tools for a realistic task ("find recent failed CI runs and post summary"), writes captured request/session payloads and an audit report under `examples/demo-output/`, and prints before/after accounting showing only requested schemas were loaded (not all indexed schemas).

## Tests

```bash
npm test
```

## Project layout

- `src/` — CLI, config, MCP clients, index, proxy gateway, audit/reporting.
- `fixtures/` — demo config and fixture MCP servers.
- `examples/` — demo outputs.
- `tests/` — automated tests.
- `PLAN.md` — goal, users, files, test strategy, acceptance checks.

## License

MIT. See [LICENSE](LICENSE).

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
