# Agent Contract Observatory

Local Node.js CLI + web UI that loads **versioned tool contracts** (input and output JSON schemas per MCP server/tool), **validates tool-call inputs before execution** and **tool outputs after execution**, and emits **offline HTML + JSON violation reports naming the exact field**.

Built for AI-agent developers and small teams wiring agents to MCP servers, agent SDKs, or custom tool loops — people who treat model-produced tool arguments and tool-returned JSON as **untrusted input** and need a real code-level contract gate instead of a prompt patch.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## The problem this solves

- **Input before execution:** A model emits `createOrder` with an item missing its `sku`. A payment step starts anyway, the order write fails mid-flight, and cleanup takes longer than the order itself. Fix belongs in code, not the prompt.
- **Output after execution:** An MCP tool advertised `amount` as a `number` but returned `"12.50"` as a string under a renamed field `currency_code`. The agent acted on it because nothing compared the result to the schema. Quarkus MCP added per-server output validation (PR #1127, merged Nov 6, 2026) as a breaking change.
- **No shared record:** Teams have no registry of tool contracts, no pre-flight gate, and no audit trail of bad tool I/O that reached production.

This tool gives you the registry, the pre/post gate, and the offline violation report.

## Install / build

Requires **Node.js >= 18**. No runtime dependencies; no install needed.

```bash
cd agent-contract-observatory
node src/cli.js --help
```

## CLI

```bash
# List loaded contracts
node src/cli.js list

# Validate a tool-call input BEFORE execution (preflight)
node src/cli.js validate-input  --contract contracts/create-order.json \
  --payload fixtures/create-order-missing-sku.json

# Validate a tool result AFTER execution (postflight)
node src/cli.js validate-output --contract contracts/execute-payment.json \
  --payload fixtures/execute-payment-bad-output.json

# Full report: input (preflight) + optional output (postflight)
node src/cli.js report --contract contracts/create-order.json \
  --input fixtures/create-order-missing-sku.json \
  --output fixtures/create-order-valid.json

# Local web UI (offline, no network)
node src/cli.js serve --port 8787
```

Exit codes: `0` pass, `1` violations, `2` usage/input error.

## Fixtures proving the acceptance criteria

| Fixture | Scenario | Expected |
|---|---|---|
| `fixtures/create-order-missing-sku.json` | `createOrder` item without `sku` | exit `1`, field `items.0.sku` `required` |
| `fixtures/execute-payment-bad-output.json` | `{amount:"12.50", currency_code:"EUR"}` vs `{amount:number, currency:string}` | exit `1`, `amount` type + `currency` required |
| `fixtures/execute-payment-good-output.json` | Well-formed payment result | exit `0` |
| `fixtures/create-order-valid.json` | Valid `createOrder` payload | exit `0` |
| `fixtures/list-users-valid.json` | Valid read-only call | exit `0` |

## Offline HTML/JSON reports

`report.html` and `report.json` are written to `--out-dir` (default `./report-output`). Both name the exact field (`items.0.sku`, `amount`, `currency`), the keyword (`required`, `type`), the expected value, and the actual value. They open fully offline — no network, no paid API.

## Contract format

```json
{
  "server": "orders",
  "tool": "createOrder",
  "version": "1.0.0",
  "description": "Creates an order. Every item must include a SKU.",
  "sideEffect": "write",
  "input":  { "type": "object", "required": ["customerId","items"], "properties": { ... } },
  "output": { "type": "object", "required": ["orderId","status"],   "properties": { ... } }
}
```

Supported JSON Schema keywords: `type`, `required`, `properties`, `items`, `minItems`, `maxItems`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `enum`, `additionalProperties`, `minLength`, `maxLength`, `pattern`, `minProperties`, `maxProperties`, `oneOf`, `anyOf`, `allOf`, `format` (email/uri), `uniqueItems`, `contains`, `multipleOf`.

## Tests

```bash
npm test
```

Runs the end-to-end smoke suite (`test/smoke.js`) via `child_process` against the real CLI, covering the two acceptance fixtures, the happy paths, `--json` mode, and the local server.

## Project layout

```
agent-contract-observatory/
  PLAN.md
  LICENSE
  README.md
  package.json
  contracts/            # versioned tool contracts
    create-order.json
    execute-payment.json
    list-users.json
  fixtures/             # acceptance fixtures
  src/
    cli.js              # CLI entrypoint (validate-input / validate-output / report / serve / list)
    contracts.js        # contract loader + version resolution
    validator.js        # JSON Schema subset validator -> field-level errors
    reporter.js         # JSON + HTML report rendering
    server.js           # local HTTP server + embedded web UI
  test/
    smoke.js
```

## License

MIT — see [LICENSE](LICENSE).

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/