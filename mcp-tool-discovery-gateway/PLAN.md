# MCP Tool Discovery Gateway — PLAN

## Goal
Build a local Node.js gateway/service and CLI that connects to configured stdio/HTTP MCP servers, maintains a searchable local tool index (name, description, schema hash, server, tags), and exposes a proxy interface where agents first search/list matching tools and only then fetch full schemas or invoke selected tools. Reduce upfront schema/context loading while preserving access to downstream tool capabilities.

## Users
- Developers and small teams running coding agents (Claude Code, Codex, Cursor, IDE/custom harnesses) against multiple MCP servers who hit context limits, token cost, or unreliable tool choice.
- Engineers who want dynamic tool discovery, basic policy/budget controls, and auditable proxy behavior without vendor lock-in.

## First usable workflow (this milestone)
1. Configure 3+ MCP servers (fixtures for demo/tests) in a config file.
2. Start the gateway (`mcp-tool-discovery-gateway serve ...`).
3. An agent/client discovers tools via search/list, fetches only selected schemas, and invokes 2 tools on demand through the proxy.
4. Produce recorded/captured demo output showing before/after context accounting from request payloads (all schemas vs only requested schemas) proving schemas were not preloaded.
5. Export JSON (and/or HTML) audit/report including tool usage, requested schemas loaded, tokens/context avoided estimate, and failures.

## Files and components
- `PLAN.md` — goal, users, files, test strategy, acceptance checks.
- `LICENSE` — MIT.
- `README.md` — usage, architecture, demo, About AaronWiseAI section/footer.
- `package.json` — manifest, scripts, `homepage: https://aaronwiseai.com/`.
- `tsconfig.json` — TypeScript build config.
- `src/cli.ts` — CLI entrypoint (`serve`, `search`, `schema`, `invoke`, `demo`, `index`).
- `src/config.ts` — config schema/loading (stdio and HTTP MCP server definitions, policy/budget defaults).
- `src/index/toolIndex.ts` — searchable local index (name, description, schema hash, server, tags), cache/persistence helpers.
- `src/clients/stdioClient.ts` — stdio JSON-RPC MCP client transport.
- `src/clients/httpClient.ts` — HTTP MCP client transport.
- `src/proxy/gateway.ts` — proxy interface: search/list, fetch schema, invoke; policy checks; budget tracking; audit hooks.
- `src/audit/report.ts` — audit log and JSON/HTML report generation (usage, cache/index hits, schemas loaded, tokens avoided estimate, failures).
- `src/utils/hash.ts`, `src/utils/tokenEstimate.ts` — schema hashing and simple token/context estimation.
- `src/types.ts` — shared types.
- `fixtures/servers/*.mjs` — 3+ fixture MCP servers (stdio/HTTP-like via stdio JSON-RPC where simplest) totaling >=20 tools, including GitHub-like and chat-like tools for realistic demo.
- `fixtures/config.demo.json` — demo config.
- `examples/demo.mjs` / CLI demo command — recorded demo session: discover+invoke 2 tools and print/save before/after accounting and audit report.
- `tests/*.test.mjs` — automated tests (node test runner) covering index/search, proxy behavior, policy denial, unavailable server handling, and schema-not-preloaded accounting.

## Acceptance checks
1. **No upfront full-schema preload**: Given fixture config with 3 MCP servers totaling >=20 tools, gateway starts and a client can find and call a target tool without receiving all 20 full schemas up front; captured session log/report shows only requested schemas loaded.
2. **Realistic task fixture**: "find recent failed CI runs and post summary" task uses GitHub-like and chat-like fixture tools discovered via search and completes end-to-end with exported JSON/HTML audit report.
3. **Failure handling**: denied-by-policy or unavailable downstream server returns structured error, records it in audit log, and session remains usable for other allowed tools (no crash, no full schema dump fallback).
4. **Artifacts**: `PLAN.md`, `LICENSE` (MIT), `README` with About/footer and homepage metadata, tests pass, smoke demo runnable, root README tool table updated.

## Test strategy
- **Unit/integration tests (node:test)**: config loading, schema hashing/indexing, search ranking/filtering, proxy search/list/fetch/invoke flows against fixture servers.
- **Policy/failure tests**: allow/deny rules and max-budget enforcement; downstream unavailable/denied returns structured error and audit entry while other tools remain usable.
- **Accounting tests**: verify total indexed schema size/count vs actually returned schema payloads; assert requested-only schemas loaded for demo scenario.
- **Smoke demo**: deterministic fixture run via CLI/script that starts gateway, performs discovery/invocation of 2 tools, writes captured payload/accounting output and audit report files for inspection.

## Risks / notes
- MCP transports/protocol details vary; implement pragmatic JSON-RPC stdio and HTTP support sufficient for fixtures and documented adapters.
- "Tokens" are estimated from payload size/heuristic when exact tokenizer unavailable; report states estimation method.
- Scope managed to deliver complete first workflow + core acceptance behavior in this milestone; advanced client adapters/UI/presets can be iterated in follow-ups if time remains.
