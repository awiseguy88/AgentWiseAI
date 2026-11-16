# PLAN: voice-agent-regression-tester

## Goal
Provide a dependency-light, fully offline-first local CLI that replays frozen voice-agent call-scenario fixtures against a text/HTTP agent endpoint (or bundled stub), scores assertions (expected exit/outcome, tool calls and args, captured fields, forbidden phrases), and emits human-readable HTML and machine-readable JSON reports with a non-zero exit code on any failure so CI can gate deploys.

## Users
- Founders and small teams shipping AI voice agents (booking/support/sales flows) who change prompts, models, tools, or knowledge bases.
- Developers who need deterministic, local regression checks for conversational outcomes without telephony minutes or paid QA services.

## Files
- `PLAN.md` - this plan.
- `package.json` - Node.js package metadata, bin, scripts, MIT license, homepage https://aaronwiseai.com/.
- `LICENSE` - MIT license text.
- `README.md` - usage, fixture format, report outputs, smoke check, limitations, and required AaronWiseAI sections/footer.
- `bin/voice-agent-regression-tester.js` - CLI entrypoint.
- `src/cli.js` - argument parsing and run orchestration.
- `src/runner.js` - fixture loading, replay against HTTP endpoint or stub, transcript capture.
- `src/assertions.js` - assertion scoring (expected exit, tool calls/args, captured fields, forbidden phrases).
- `src/report.js` - HTML/JSON report generation.
- `src/stub-agent.js` - bundled deterministic stub voice agent used for offline demo/tests.
- `fixtures/scenarios.json` - bundled fixture suite: booked call, refusal call, transfer call.
- `fixtures/stub-agent-ok.json` - stub behavior/config that passes all bundled scenarios.
- `fixtures/stub-agent-broken.json` - changed stub behavior that stops calling confirm-email (fails refusal scenario).
- `test/smoke.test.js` - smoke tests covering acceptance cases.

## Test strategy
- Use Node's built-in test runner (`node --test`) with no external dependencies.
- Smoke test 1 (acceptance): replay bundled scenarios against unchanged stub agent and assert all scenarios pass with exit code 0 and report files generated.
- Smoke test 2 (failure case): replay against changed stub agent that omits confirm-email tool call; assert refusal scenario fails, failed assertion is reported, and process exits non-zero without network/telephony.
- Smoke test 3 (report): first run from bundled fixtures produces readable HTML and JSON reports with no account or paid service.

## Acceptance checks
1. Given bundled fixture suite (booked call, refusal call, transfer call) and stub voice agent, tool replays all scenarios and reports per-scenario pass/fail; everything passes when agent is unchanged.
2. Failure case: with changed stub agent that stops calling confirm-email tool, tool fails the refusal scenario, prints the failed assertion, and exits non-zero without network or telephony.
3. First run produces a readable HTML/JSON report from bundled fixtures with no account or paid service.
4. Includes README (with About AaronWiseAI section/line/footer), MIT LICENSE, package.json homepage, and root README tool table entry.
