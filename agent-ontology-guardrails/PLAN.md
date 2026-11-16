# PLAN — agent-ontology-guardrails

## Goal
Build a local, framework-agnostic Node.js service and CLI that enforces machine-checkable domain rules on proposed agent actions before side effects execute. First usable workflow gates refund/order actions via a validator proxy with deterministic pass/block decisions, structured violations, and replayable audit records.

## Users
- Developers and small teams shipping tool-using AI agents for support, operations, billing, CRM, or internal automation.
- Maintainers who need portable rule packs, fixture replay, and human-reviewable violation/audit evidence for risky actions.

## Files (MVP / first release in this milestone)
- `PLAN.md` — goal, users, files, test strategy, acceptance checks (this file).
- `LICENSE` — MIT license.
- `package.json` — metadata, `homepage`, CLI bin, scripts (`test`, `demo`).
- `README.md` — usage, About AaronWiseAI section, footer, examples.
- `src/schema.js` — JSON schema-style rule pack validation and normalization (entities, relations, action constraints).
- `src/dsl.js` — lightweight rule DSL parser/loader producing the normalized rule-pack model.
- `src/validator.js` — deterministic action validator returning machine-readable pass/fail with rule/field/message violations.
- `src/proxy.js` — HTTP validator proxy that forwards valid actions to a target agent endpoint and blocks invalid ones with structured reports.
- `src/audit.js` — append/write audit log entries and render HTML/JSON audit reports.
- `src/cli.js` — CLI (`validate`, `proxy`, `replay`, `audit-report`) with actionable diagnostics and non-zero exit on failures.
- `fixtures/rules/refund-order.json` — bundled refund/order rule pack (refund requires delivered order, amount <= order total, approver has role).
- `fixtures/actions/valid-refund.json`, `fixtures/actions/invalid-undelivered.json`, `fixtures/actions/invalid-amount.json` — action fixtures.
- `fixtures/traces/recorded-5-actions.json` — recorded trace for replay/audit acceptance.
- `demo/agent-endpoint.js` — demo HTTP agent endpoint that would execute side effects when actions are forwarded.
- `demo/run-demo.js` — scripted demo: start endpoint+proxy, send valid/invalid fixtures, print decisions, emit audit.
- `test/smoke.test.js` — acceptance-focused smoke tests (valid pass/forward marker, invalid blocked with violations, replay report, malformed rule diagnostics, unchanged packs).

## Test strategy
- Use Node.js built-in test/assert APIs (`node --test` or `node test/smoke.test.js`) with no network dependencies.
- Unit/integration-style smoke checks over real fixtures and rule packs:
  - Validate bundled valid refund fixture => pass/executable.
  - Validate invalid refund (undelivered order, amount above total) => blocked with machine-readable violations naming `rule`, `field`, `message`.
  - Replay recorded 5-action trace offline => audit report with pass/fail decisions, violated rules, and suggested corrective fields.
  - Malformed rule file / unknown entity reference => fail fast with actionable diagnostics and non-zero CLI exit code; existing rule packs left unchanged.
  - Proxy integration: valid action forwarded to demo endpoint; invalid action not forwarded and returns structured violation report.
- Run tests locally before each commit-sized checkpoint in this session.

## Acceptance checks
1. Given bundled order/refund fixtures, a valid proposed action passes validation and is forwarded or marked executable, while an invalid action (undelivered order or amount above total) is blocked with machine-readable violations naming `rule`, `field`, and `message`.
2. Realistic fixture: replay a recorded 5-action agent trace and produce an audit report showing pass/fail decisions, violated rules, and suggested corrective fields with no network dependency.
3. Failure case: malformed rule files or unknown entity references fail fast with actionable diagnostics and a non-zero CLI exit code, leaving existing rule packs unchanged.

## Milestones / remaining work
- **Current milestone (this ticket):** end-to-end MVP with rule schema/DSL loader, validator, proxy, audit HTML/JSON, CLI, fixtures, demo, tests, docs, and root README entry.
- **Later milestones (not in scope now):** rule pack editor/import-export UI, richer CI mode, policy simulation UX, multi-agent/project workspaces with permissions, Docker compose packaging, adapters for more tool-call payload formats.
