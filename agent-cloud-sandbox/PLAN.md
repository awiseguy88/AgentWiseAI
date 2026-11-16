# Build plan — Agent Cloud Sandbox

## Goal
A local, offline-first cloud-emulator harness for AI coding agents building AWS cloud-native code (Lambda, DynamoDB, SQS, Step Functions, etc.). It bundles a small local emulator stub so agents can run deterministic smoke tests against fixture catalogs without live AWS, network access, or credentials, and emits structured pass/fail JSON/HTML reports the agent can act on.

## Users
- Developers and small teams using AI coding agents (Claude Code, Codex, Cursor, OpenCode) for cloud-native AWS applications.
- Agents themselves (via CLI/JSON output) that need a local execution loop: write serverless app → sandbox deploy → sandbox test → read report → iterate.

## Files
- `PLAN.md` — this build plan.
- `package.json` — metadata (`name: agent-cloud-sandbox`, `homepage: https://aaronwiseai.com/`, `license: MIT`, `bin`, `npm test` script).
- `LICENSE` — MIT license text.
- `README.md` — tool description, usage, fixtures, smoke checks, Docker Compose, agent validation, About AaronWiseAI section + footer.
- `src/emulator.js` — bundled local AWS Emulator stub: managed local process wrapper, DynamoDB table CRUD, Lambda invoke, SQS queues/messages, Step Functions executions. Offline by design (no network calls). Selectable backend (`stub` default for offline determinism; hooks for real emulator/LocalStack).
- `src/validator.js` — agent-ready parameter validation: detects hallucinated/invalid parameters and corrects them to emulator-supported values (region, service endpoints, table names, queue URLs, state machine ARNs, etc.), emitting structured correction reports.
- `src/harness.js` — test harness: starts emulator, deploys fixtures, runs deterministic smoke tests (create/read/update/delete for Lambda+DynamoDB, SQS fan-out, Step Functions), records pass/fail per test.
- `src/report.js` — emits JSON report (`pass`, `tests[]` with pass/fail, structured errors incl. missing permission + resource ARN) and optional HTML.
- `src/cli.js` — CLI entry: `deploy`, `test`, `validate`, `dry-run` subcommands; `--offline` flag forces stub backend with zero network.
- `test/smoke.test.js` — deterministic smoke tests run against the local emulator stub.
- `test/fixtures/` — fixture catalog: Lambda+DynamoDB CRUD, SQS+Lambda fan-out, Step Functions workflow, plus an IAM-permission-error failure fixture.
- `test/dry-run.test.js` — dry-run against a stubbed emulator process producing the report format with no external dependencies.
- `docker-compose.yml` + `.dockerignore` — Docker Compose smoke test for offline deployment of the harness.
- `.gitignore` — local state artifacts.

## Modules
- `emulator` — local emulator process wrapper + service stubs (no network).
- `validator` — parameter correction/validation for agents.
- `harness` — fixture deployment + deterministic smoke test execution + pass/fail recording.
- `report` — structured JSON/HTML pass/fail reports.
- `cli` — command wiring.

## Test strategy
- `npm test` runs `node --test test/*.test.js` offline against the bundled stub emulator.
- Acceptance 1 (Lambda+DynamoDB): emulator starts, fixture deploys, CRUD smoke tests run, JSON report has `pass: true` and `networkCalls: 0`.
- Acceptance 2 (IAM failure): deliberate IAM permission error fixture yields `pass: false` with a structured error naming the missing permission and resource ARN.
- Acceptance 3 (dry-run): `dry-run` against a stubbed emulator process yields the report format with zero external dependencies/network calls.
- Additional: SQS fan-out and Step Functions fixtures pass; validator corrects hallucinated parameters to emulator-supported values.

## Acceptance checks
- `npm test` passes fully offline; reports contain `networkCalls: 0`.
- JSON report structure is consumable by agents (`pass`, `tests[]`, `errors[]` with `permission`/`resourceArn`).
- Fixture catalog covers Lambda+DynamoDB CRUD, SQS+Lambda fan-out, Step Functions workflow.
- `npm test` runs without network access; dry-run works against a stubbed emulator.
- Tool lives in its own subfolder, independent of other tools; no unrelated workspace changes.
- Root README.md tool table updated with folder link, one-line description, and merged PR link.
- PR merged into `main`; branch deleted; only `main` remains locally.

## Milestones (current = this one)
- M1 (this session): bundled stub emulator, fixture catalog, deterministic smoke tests, validator, JSON reports, dry-run, offline mode, PLAN.md, LICENSE, README, package.json homepage, Docker Compose smoke test, root README entry, tests pass, PR merged to main.
- Future (recorded only): fixture authoring SDK, CI/CD GitHub Action, cost simulation reports, multi-emulator support (real AWS Emulator / LocalStack), HTML report polish.