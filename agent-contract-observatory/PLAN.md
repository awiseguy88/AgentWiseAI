# Agent Contract Observatory — PLAN

## Goal
Give AI-agent developers and small teams a **local, offline-first, open-source tool** that treats model-produced tool arguments and tool-returned JSON as **untrusted input**: it loads versioned JSON-schema contracts for MCP servers/tools, validates tool-call inputs **before execution** and tool outputs **after execution**, and emits **HTML and JSON violation reports naming the exact field**. Built for devs wiring agents to MCP servers, agent SDKs, or custom tool loops who need a real code-level contract gate, not a prompt patch.

The product exists to make two real failure classes impossible to miss:
1. A model emits an incomplete tool call (`createOrder` with an item missing `sku`) that a payment step is already running behind.
2. A tool advertises `amount` as a number but returns `"12.50"` as a string under a renamed field `currency_code`, and the agent acts on it because nothing compared the result to the schema.

## Users
- **AI-agent developers** shipping customer-facing agents (support, booking, billing) over MCP servers, agent SDKs, or custom loops.
- **Small engineering teams** that need a shared contract registry, a pre-flight validation gate, and an audit trail of bad tool I/O — without accounts, cloud, or paid APIs.
- **CI pipelines** that want to block deploys whose tools lack registered passing contracts (M2).

## Scope (Milestone 1 — this ticket)
Local Node.js CLI plus a **local web UI** that:

1. **Loads versioned tool contracts** from a local directory (`contracts/`) — one file per MCP server/tool, each declaring:
   - `server` (MCP server name) and `tool` (tool name)
   - `version` (semver string)
   - `input` JSON Schema (validated before the tool runs)
   - `output` JSON Schema (validated after the tool returns)
   - `sideEffect` metadata (e.g. `write`, `payment`) so a failed pre-flight check clearly marks that execution was skipped.
2. **Validates a sample tool-call input** against the input schema **before execution** (pre-flight gate). On failure it does **not** execute; it records the violation with exact JSON-path (e.g. `items.0.sku`) and the keyword (`required`, `type`, `additionalProperties`, etc.).
3. **Validates a sample tool result** against the output schema **after execution** (post-flight check). On failure it records violations the same way (e.g. `amount` should be number, was string; `currency` required but missing because the result used `currency_code`).
4. **Emits an HTML and JSON violation report** naming the exact field, with per-field reasons, viewable **offline** — no network, no paid API, no account.

Fixtures baked into the repo (`fixtures/`):
- `createOrder` input with `items[0]` missing `sku` → must be rejected **before any side effect** and the report must name `items.0.sku: required`.
- `executePayment` result `{amount: "12.50", currency_code: "EUR"}` against contract `{amount: number, currency: string}` → the run must flag a schema violation and **exit non-zero** (naming `amount` type mismatch and `currency` required / `currency_code` as an unexpected field).

### Non-goals (M1)
No hosted registry, team accounts, CI-gate service, or MCP proxy (those are M2/M3). No network calls. No paid APIs. No UI polish beyond a usable local dashboard.

### Milestones (recorded here; continue in later sessions)
- **M1 (this ticket):** CLI + local web UI + versioned contract loader + pre/post validators + HTML/JSON reports + fixtures + tests + README/PLAN/LICENSE + root README entry.
- **M2:** Hosted registry service (team accounts, contract versioning), a CI gate that rejects deploys whose tools lack registered passing contracts, violation audit log.
- **M3:** MCP proxy that blocks off-schema calls at runtime, breach alerts, usage metering; npm package + self-hostable Docker image.

## Users' real workflow (M1, end-to-end)
1. Developer drops a contract file into `contracts/` (or uses the bundled example contracts).
2. Developer runs the **preflight** gate on a captured model-emitted tool call: `agent-contract-observatory validate-input --contract contracts/create-order.json --payload fixtures/create-order-missing-sku.json`. The CLI refuses the call, prints `items.0.sku: required`, and exits non-zero.
3. Developer runs the **postflight** gate on the raw tool result: `agent-contract-observatory validate-output --contract contracts/execute-payment.json --payload fixtures/execute-payment-bad-output.json`. The CLI flags `amount: expected number, got string` and `currency: required`, exits non-zero.
4. Developer (or CI) opens the emitted `report.html` / `report.json` **offline** to see exactly which field failed and why.
5. The **local web UI** (`agent-contract-observatory serve`) lists every loaded contract, lets you pick one, paste an input or output payload, and shows the violation report inline — no network.

## Files
```
agent-contract-observatory/
  PLAN.md
  LICENSE                  # MIT
  README.md                # About AaronWiseAI section, tagline, footer
  package.json             # homepage https://aaronwiseai.com/
  .gitignore
  contracts/               # versioned tool contracts (input+output JSON schemas)
    create-order.json
    execute-payment.json
    list-users.json        # happy-path contract for a read-only tool
  fixtures/
    create-order-missing-sku.json
    create-order-valid.json
    execute-payment-bad-output.json
    execute-payment-good-output.json
    list-users-valid.json
  src/
    cli.js                 # arg parser, commands: validate-input, validate-output, report, serve
    contracts.js           # load/parse/validate contract files, version resolution
    validator.js           # JSON Schema subset validator producing field-level errors
    reporter.js            # render JSON + HTML reports naming exact fields
    server.js              # local HTTP server + embedded web UI (zero-dep, offline)
    web/
      index.html           # single-page local dashboard
      app.js
      styles.css
  test/
    smoke.js               # end-to-end acceptance checks (uses child_process on the CLI)
    fixtures/              # (kept in repo fixtures/; tests reference ../fixtures)
```

### Dependencies
- **Zero runtime dependencies** (uses `ajv` if available, else a built-in JSON Schema subset validator). Offline, no paid API, no accounts.

## Test strategy
- **End-to-end smoke test** (`npm test`) drives the real CLI via `child_process.spawnSync`:
  1. **Acceptance #1** — `validate-input` on `create-order-missing-sku.json` exits non-zero and the JSON report contains a violation with `field: "items.0.sku"` and `keyword: "required"`.
  2. **Acceptance #2** — `validate-output` on `execute-payment-bad-output.json` exits non-zero; the JSON report flags `amount` (expected number) and `currency` (required) and the run is marked as a **post-execution** violation.
  3. **Acceptance #3** — the generated `report.html` and `report.json` open offline (no network) and include per-field reasons; the HTML contains the literal field paths (`items.0.sku`, `amount`, `currency`).
  4. **Happy path** — valid payloads exit 0 with zero violations.
  5. **CLI `report`** subcommand writes both files and prints the path; the files parse as JSON and contain non-trivial HTML.
  6. **Server smoke** — `serve` starts, `/` returns 200 HTML, `/api/contracts` returns JSON listing contracts, and a validation POST round-trips.
- Tests use only Node built-ins (`assert`, `child_process`, `fs`, `http`) so they run on a clean checkout with no install.

## Acceptance checks (mapped to issue #78)
1. Fixture `createOrder` with an item missing `sku` → tool **rejects the call before any side effect** and report names `items.0.sku: required`. ✅ (preflight path; no execution invoked)
2. Fixture result `{amount: "12.50", currency_code: "EUR"}` vs contract `{amount: number, currency: string}` → run **flags a schema violation and exits non-zero**. ✅
3. Violation report viewable **offline as HTML and JSON** with per-field reasons, no network / no paid API. ✅

## Out of scope / future
M2 + M3 as above. Not building hosted service, CI gate, MCP proxy, or billing.