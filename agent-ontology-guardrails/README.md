# Agent Ontology Guardrails (`agent-ontology-guardrails`)

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## What it does
`agent-ontology-guardrails` is a local, dependency-light Node.js service and CLI that enforces machine-checkable domain rules on proposed agent actions before side effects execute. Instead of relying on prompt-only policy, it defines domain entities, relations, and action constraints in a JSON rule pack, validates proposed actions deterministically, and blocks invalid ones with structured violation reports that agents can consume.

It helps prevent failures like refunding an undelivered order or issuing an amount above the order total, and it keeps an HTML/JSON audit log of every decision.

## Components
- `src/validator.js` — loads a rule pack, validates structure, and evaluates action constraints (`required`, `equals`, `min`, `max`, `enum`, `entityExists`, `entityFieldEquals`, `entityFieldMax`).
- `src/proxy.js` — HTTP validator proxy that forwards valid actions to a target agent endpoint and blocks invalid ones with structured reports.
- `src/audit.js` — append/write audit log entries and render HTML/JSON audit reports.
- `src/cli.js` — CLI commands: `validate`, `replay`, `proxy`, `audit-report`.

## Usage

```bash
# Validate a single proposed action
node src/cli.js validate fixtures/actions/valid-refund.json --rules fixtures/rules/refund-order.json

# Replay a recorded action trace and emit an audit report
node src/cli.js replay fixtures/traces/recorded-5-actions.json --rules fixtures/rules/refund-order.json --data fixtures/rules/refund-order.json --out-dir ./agent-ontology-guardrails-report

# Run the validator proxy (valid actions forwarded to a target agent endpoint)
node src/cli.js proxy --rules fixtures/rules/refund-order.json --target-host 127.0.0.1 --target-port 4001 --port 8080

# Render an HTML/JSON audit report from a saved audit log
node src/cli.js audit-report agent-ontology-guardrails-report/audit.json --out-dir agent-ontology-guardrails-report
```

Exit codes: `0` = pass, `1` = blocked/violations, `2` = usage/input error.

## Demo
```bash
node demo/run-demo.js
```
Starts a demo HTTP agent endpoint and a validator proxy, sends a valid refund fixture (forwarded/executable) and two invalid refund fixtures (blocked with structured violations), and writes `demo/output/audit.html` and `demo/output/audit.json`.

## Smoke check
```bash
node --test test/smoke.test.js
```
Valid refund passes; invalid refunds (undelivered order, amount above total) are blocked with machine-readable violations naming `rule`, `field`, and `message`; a recorded 5-action trace replays offline into an audit report; malformed rule files or unknown entity references fail fast with actionable diagnostics and a non-zero CLI exit code, leaving existing rule packs unchanged.

## License
MIT (see [LICENSE](LICENSE)).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
