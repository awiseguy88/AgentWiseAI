# Voice Agent Regression Tester

**Offline-first CLI that replays frozen voice-agent call scenarios against a text/HTTP endpoint, scores assertions, and emits HTML/JSON reports with CI-gating exit codes.** It gives teams deterministic regression coverage for conversational outcomes — no telephony minutes, no paid QA platform, no account.

## Why it exists

Voice agents have no deterministic replay. Editing a single prompt line is a global, silent production change: nothing errors, no diff exists, and no test suite goes red. A one-line prompt tweak broke an unrelated voice-agent flow, so teams now batch every prompt edit because each change feels risky. In production, a "more helpful about pricing" line made an agent answer questions it was supposed to decline, and a tighter confirmation step made callers hang up mid-flow — silent behavior shifts visible only days later in unwatched metrics.

`voice-agent-regression-tester` replaces manual transcript review and per-minute voice QA platforms with a free, local, offline regression suite that plugs into CI.

## What it does

- Loads frozen call-scenario fixtures (turn sequences with expected exit, tool calls and args, captured fields, and forbidden phrases).
- Replays them against a voice agent's text/HTTP endpoint, or against a bundled deterministic stub agent for offline demo and testing.
- Scores every assertion per scenario: exit code, tool calls with exact arguments, captured state fields, and forbidden phrases.
- Emits a readable HTML report and a machine-readable JSON report.
- Exits non-zero on any failure, so CI can gate deploys.

## Install / run

Requires Node.js >= 18 (standard library only; optional `fetch` for HTTP agent endpoints). No npm dependencies.

```bash
cd voice-agent-regression-tester
npm install
npm run smoke
```

Or run the CLI directly:

```bash
# Offline replay against the bundled stub agent (all scenarios pass)
node bin/voice-agent-regression-tester.js \
  --fixtures fixtures/scenarios.json \
  --agent fixtures/stub-agent-ok.json \
  --out reports/smoke

# Replay against a live HTTP voice-agent endpoint
node bin/voice-agent-regression-tester.js \
  --fixtures fixtures/scenarios.json \
  --endpoint https://your-agent.example.com/reply \
  --out reports/prod
```

### Options

| Flag | Description |
| --- | --- |
| `--fixtures <path>` | Fixture suite JSON (default: `fixtures/scenarios.json`) |
| `--agent <path>` | Stub agent config JSON for offline replay |
| `--endpoint <url>` | HTTP endpoint to replay against instead of the stub |
| `--out <dir>` | Output directory for `report.json` and `report.html` (default: `reports/latest`) |
| `-h, --help` | Show help |

## Fixture format

A fixture suite is a JSON object with a `scenarios` array (or a bare array). Each scenario has:

- `id` and optional `description`.
- `turns`: an array of user messages, or objects with `user` plus optional `toolCalls`, `captured`, `reply`, `exit`, and `done`.
- `expected`: assertions to score against the replayed transcript:
  - `exit` — expected final exit code of the call.
  - `toolCalls` — array of `{ name, args }` that must appear in the transcript.
  - `captured` — fields the agent must capture and return.
  - `forbiddenPhrases` — phrases that must not appear in any agent reply.

## Output

- `report.json` — machine-readable summary with per-scenario pass/fail and transcript.
- `report.html` — offline, readable report with scenario verdicts, failed assertions, and transcripts.

## Tests / smoke check

```bash
npm test
```

The smoke tests cover the acceptance cases:

1. Given the bundled fixture suite (booked call, refusal call, transfer call) and the unchanged stub agent, the tool replays all scenarios and reports per-scenario pass/fail; everything passes when the agent is unchanged.
2. With a changed stub agent that stops calling the `confirm_email` tool, the tool fails the refusal scenario, prints the failed assertion, and exits non-zero without network or telephony.
3. The first run produces a readable HTML/JSON report from bundled fixtures with no account or paid service.

## Limitations

- Stub replay is deterministic by design; it does not exercise model inference, ASR, or telephony behavior.
- HTTP endpoint replay requires the agent to accept the payload shape described in `src/runner.js`.
- Assertion scoring is exact-match on tool args and captured fields; fuzzy or semantic matching is not supported.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/