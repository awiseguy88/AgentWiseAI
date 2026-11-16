# Agent Regression Suite

**Dependency-light Node CLI that replays frozen agent scenarios, extracts behavioral fingerprints, and uses Sequential Probability Ratio Tests (SPRT) to declare Pass/Fail/Inconclusive regression verdicts with CI-gated reports.** It helps teams shipping stochastic AI agents detect prompt, tool, model, or orchestration regressions before the next real run — offline, with fixture mocks and no paid APIs.

## Why it exists

AI agents are inherently non-deterministic: the same prompt, tools, and model can produce divergent behavior across runs. A prompt edit that works Monday can silently regress by Wednesday, and traditional binary pass/fail tests are a poor fit for stochastic systems. `agent-regression-suite` applies SPRT-based verdicts to behavioral fingerprints so CI can gate changes with principled confidence.

## What it does

- Loads frozen agent scenarios (turn sequences with expected tool calls/args, captured fields, and forbidden phrases).
- Replays them against a local mock agent config (offline fixture replay) across multiple runs.
- Extracts behavioral fingerprints from traces and scores each trial against scenario expectations.
- Applies SPRT (Sequential Probability Ratio Test) per scenario to declare **Pass**, **Fail**, or **Inconclusive** with reported confidence.
- Emits CI-gated JSON/HTML reports and exits non-zero on Fail verdicts.

## Requirements

- Node.js >= 18
- No npm dependencies (standard library only)

## Install / run

```bash
cd agent-regression-suite
npm test
```

Run the CLI directly:

```bash
# Unchanged agent (demo pass): 10 runs, SPRT Pass with >=95% confidence
node bin/agent-regression-suite.js \
  --fixtures fixtures/scenarios.json \
  --agent fixtures/mock-agent-baseline.json \
  --baseline fixtures/mock-agent-baseline.json \
  --runs 10 \
  --out reports/demo-pass

# Regressed agent (demo fail): flags Fail with >=90% confidence, CI exit non-zero
node bin/agent-regression-suite.js \
  --fixtures fixtures/scenarios.json \
  --agent fixtures/mock-agent-regressed.json \
  --baseline fixtures/mock-agent-baseline.json \
  --runs 10 \
  --out reports/demo-fail
```

Or use package scripts:

```bash
npm run demo:pass
npm run demo:fail
```

## CLI options

| Flag | Description |
| --- | --- |
| `--fixtures, -f <path>` | Frozen scenario suite JSON (default: `fixtures/scenarios.json`) |
| `--agent, -a <path>` | Agent to test (mock agent config JSON) |
| `--baseline, -b <path>` | Baseline agent config (optional, for comparison demos) |
| `--runs, -n <number>` | Max runs/trials per scenario (default: `10`) |
| `--out, -o <dir>` | Output directory for `report.json`/`report.html` (default: `reports/latest`) |
| `--alpha <n>` | SPRT false-pass risk α (default: `0.05`, Pass confidence ≥ 95%) |
| `--beta <n>` | SPRT false-fail risk β (default: `0.10`, Fail confidence ≥ 90%) |
| `--p0 <n>` | Acceptable pass probability under H0 (default: `0.99`) |
| `--p1 <n>` | Pass probability under regression H1 (default: `0.50`) |
| `-h, --help` | Show help |

## Fixture format

A scenario suite is JSON with a `scenarios` array. Each scenario includes:

- `id`, `description`
- `turns`: user messages / turn sequence for replay
- `expected`: assertions scored per trial
  - `exit`: expected final exit/outcome
  - `toolCalls`: array of `{ name, args }` that must appear in the trace
  - `captured`: fields the agent must capture
  - `forbiddenPhrases`: phrases that must not appear in agent replies

Mock agent configs map scenario IDs to deterministic turn responses (`reply`, `toolCalls`, `captured`, `exit`, `done`) so regressions can be demonstrated offline.

## Behavioral fingerprints & SPRT verdicts

Each replay produces a behavioral fingerprint (tool-call signatures, captured fields, exit, turn count, reply hash). A trial passes when the transcript satisfies all scenario assertions.

SPRT accumulates log-likelihood evidence across runs and stops early when it can declare:

- **Pass** — sufficient evidence the agent meets the acceptable behavior rate (default confidence ≥ 95%).
- **Fail** — sufficient evidence of regression (default confidence ≥ 90%).
- **Inconclusive** — not enough evidence within the run budget.

The CLI exits **non-zero** on any Fail verdict for CI gating.

## Output

- `report.json` — machine-readable summary with per-scenario SPRT verdicts, confidence, history, and trial fingerprints/failures.
- `report.html` — readable offline report for humans.

## Tests / demo

```bash
npm test
```

Acceptance coverage (offline, fixture mocks only):

1. Given a fixture agent that regresses after a one-line prompt change, the suite flags a **Fail** verdict with **≥90% confidence** using SPRT, and a CI run exits non-zero.
2. Given the same agent unchanged across 10 runs, the suite declares **Pass** with **≥95% confidence** and never flakes.
3. The run produces readable HTML/JSON reports from bundled fixtures with no account or paid service.
4. `npm run demo:pass` exits 0; `npm run demo:fail` exits 1.

## Limitations

- Current replay path is mock/fixture-driven for deterministic offline verification; live local agent CLI/HTTP adapters can be added as follow-on work.
- Assertion scoring is exact-match for tool args and captured fields; semantic/fuzzy matching is not included in this milestone.
- SPRT parameters should be tuned to your scenario tolerance and flake profile; defaults are chosen for the bundled deterministic acceptance demos.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
