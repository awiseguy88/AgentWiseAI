# Agent Cloud Sandbox

A local cloud-emulator harness for AI coding agents building AWS cloud-native code (Lambda, DynamoDB, SQS, Step Functions, etc.). It bundles a small local emulator stub so agents can run deterministic smoke tests against curated fixture catalogs — without live AWS, network access, or credentials — and emits structured pass/fail JSON/HTML reports the agent can act on.

Replace manual deployment to live AWS dev accounts, ad-hoc LocalStack scripts, and guesswork about cloud behavior with a repeatable local execution loop:

```
agent writes a small serverless app
  → sandbox deploy
  → sandbox test
  → agent reads report
  → iterate
```

## What it does

- Bundled local AWS Emulator stub: DynamoDB table CRUD, Lambda invoke, SQS queues/messages, Step Functions executions. Offline by design — zero network calls.
- Fixture catalog of realistic multi-service app templates:
  - Lambda + DynamoDB CRUD
  - SQS + Lambda fan-out
  - Step Functions workflow
  - IAM permission-error failure fixture (for negative testing)
- Deterministic smoke tests run against the local emulator and record pass/fail per test.
- Agent-ready validation that corrects hallucinated parameters to real emulator-supported values (region, endpoints, table names, queue URLs, state machine ARNs, etc.).
- Structured JSON report: `pass`, per-test `tests[]` with pass/fail, and `errors[]` naming missing permissions and resource ARNs for failure cases.
- Optional HTML report next to the JSON.
- Offline mode (`--offline`) forces the stub backend with no external dependencies.
- Dry-run mode against a stubbed emulator process produces the report format with no network.
- Docker Compose smoke test for offline deployment of the harness.

## Usage

```bash
# Install/run from the tool folder
npm install
npm test

# Run smoke tests (Lambda+DynamoDB CRUD, SQS fan-out, Step Functions) offline
node src/cli.js test --offline

# Run the failure fixture (deliberate IAM permission error)
node src/cli.js test --fixture test/fixtures/iam-permission-error.json --offline

# Validate/correct hallucinated parameters for an agent
node src/cli.js validate --params '{"service":"dynamodb","table":"my-table","region":"us-west-2","endpoint":"https://localhost:4566"}' --offline

# Dry-run against a stubbed emulator (no external dependencies)
node src/cli.js dry-run --offline
```

### CLI commands

- `test [--fixture <path>] [--offline] [--report <out.json>]` — start the emulator, deploy the fixture, run smoke tests, emit a JSON report.
- `validate --params <json> [--offline]` — correct hallucinated parameters to emulator-supported values.
- `dry-run [--offline]` — produce the report format against a stubbed emulator process with no external dependencies.

## Test strategy

`npm test` runs offline against the bundled stub emulator:

- Lambda + DynamoDB fixture: create/read/update/delete smoke tests, JSON report `pass: true`, `networkCalls: 0`.
- SQS + Lambda fan-out fixture: messages are queued and consumed; tests pass.
- Step Functions fixture: workflow execution completes; tests pass.
- IAM permission-error fixture: `pass: false` with a structured error naming the missing permission and resource ARN.
- Dry-run: report format produced against a stubbed emulator, zero external dependencies.

## Files

- `PLAN.md` — build plan (goal, users, files, test strategy, acceptance checks).
- `package.json` — metadata, `bin`, `homepage` (https://aaronwiseai.com/), smoke test script.
- `LICENSE` — MIT license.
- `src/emulator.js` — bundled local emulator stub + process wrapper (no network).
- `src/validator.js` — agent-ready parameter validation/correction.
- `src/harness.js` — fixture deployment + deterministic smoke test execution + pass/fail recording.
- `src/report.js` — structured JSON/HTML report rendering.
- `src/cli.js` — CLI entrypoint (`test`, `validate`, `dry-run`).
- `test/smoke.test.js` — deterministic smoke tests against the local emulator stub.
- `test/dry-run.test.js` — dry-run against a stubbed emulator process.
- `test/fixtures/` — fixture catalog (Lambda+DynamoDB, SQS+Lambda, Step Functions, IAM failure).
- `docker-compose.yml` — Docker Compose smoke test for offline deployment.
- `.dockerignore` — exclude node_modules and generated outputs.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/