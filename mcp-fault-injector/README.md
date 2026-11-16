# MCP Fault Injector

Offline-first CLI that injects configurable fault modes (latency, timeouts, invalid JSON, missing fields, truncated results) into MCP server responses, runs an agent task under each fault, and reports which faults caused **silent wrong answers** vs **clean failures**.

Between an agent (MCP client) and an MCP server (stdio or HTTP), this proxy records how your agent behaves when servers fail in subtle ways — without modifying the agent or server code and without any paid APIs.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## Why

MCP servers fail in subtle ways — timeouts, malformed schemas, missing fields — and agents often proceed silently or hallucinate fixes, with errors appearing late. This tool lets developers reproduce those failure modes locally and classify outcomes per fault.

## What it injects

| Fault | What happens |
| --- | --- |
| latency | Adds delay before forwarding a server response. |
| timeout | Drops the response so the client hangs / times out. |
| invalid JSON | Returns corrupted/non-JSON response body. |
| missing fields | Strips required fields (e.g. `content`) from results. |
| truncated | Shortens string results mid-payload. |

## Install / build

Requires Node.js >= 18. No external runtime dependencies.

```bash
# From inside this folder
npm install          # devDependencies (TypeScript) only
npm run build        # compile src/ to dist/
npm test             # build + run smoke check
```

Then run:

```bash
node dist/cli.js --help
```

## Run against the sample scenario

Included under `examples/` is a tiny offline MCP-like sample server and a scenario:

```bash
node dist/cli.js --run --scenario examples/sample-scenario.json
```

Output shows per-fault results and which steps are clean failures vs silent wrong answers. Example:

```
Fault: missingFields  (clean_failures=0 silent_wrong=1 ok=0)
  - call-echo [silent_wrong_answer]: Missing required fields: content (would be accepted as data)
```

## Write JSON report

```bash
node dist/cli.js --run --scenario examples/sample-scenario.json --json-out report.json
```

## API (programmatic)

Classes `StdioProxy` and `HttpProxy` (`src/proxy/`) forward MCP messages between client and server while applying faults from `src/faults.ts`. The runner/report logic lives in `src/runner.ts`.

## Files

- `package.json` — package manifest (homepage: https://aaronwiseai.com/).
- `LICENSE` — MIT.
- `PLAN.md` — goal, users, files, test strategy, acceptance checks.
- `README.md` — this file.
- `src/cli.ts` — CLI entrypoint.
- `src/faults.ts` — fault rules and response transforms.
- `src/proxy/stdioProxy.ts` — stdio (child-process) MCP proxy.
- `src/proxy/httpProxy.ts` — HTTP MCP proxy.
- `src/runner.ts` — scenario runner + clean-failure vs silent-wrong classification.
- `examples/sample-server.mjs` — offline sample MCP-like stdio server.
- `examples/sample-scenario.json` — scripted calls and required-field checks.
- `test/smoke.mjs` — offline smoke check.

## Smoke check / tests

```bash
npm test
```

Runs `tsc` then `node test/smoke.mjs`, which exercises the CLI end-to-end offline and asserts all fault types are reported with correct classifications.

## License

MIT License. Copyright (c) 2026 AaronWiseAI.

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
