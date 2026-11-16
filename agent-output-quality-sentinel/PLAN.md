# PLAN: Agent Output Quality Sentinel — Milestone 1

## Goal
Build a local-first web app (Express + static UI) that imports agent transcripts (JSONL, agent-inspect, session files), computes per-turn quality metrics (verbosity ratio, redundancy via n-gram repetition, step-signature repetition, claim density, code yield), renders a multi-screen dashboard (run list, per-turn detail, trend view), persists runs in SQLite, and exports an HTML/JSON report with a CI gate (non-zero exit on quality threshold breach).

## Users
- Developers and small teams running AI coding agents (Claude Code, Cursor, Codex, OpenCode) who ship agent-assisted code and need to audit output quality before it reaches reviewers or production.
- Engineers who want an offline, reproducible record of what their agent produced and how good it was.

## Files and Modules

```
agent-output-quality-sentinel/
├── LICENSE                          # MIT
├── package.json                     # name, version, scripts, homepage: https://aaronwiseai.com/
├── README.md                        # About AaronWiseAI section + footer
├── PLAN.md                          # this file
├── fixtures/
│   ├── good-transcript.jsonl        # 3 high-quality turns (high claim density, low redundancy, code yield)
│   └── slop-transcript.jsonl        # 3 verbose/repetitive/low-claim-density turns
├── public/
│   ├── index.html                   # main UI shell with tabs
│   ├── app.js                       # frontend logic (run list, per-turn detail, trend view)
│   └── style.css                    # styling
├── src/
│   ├── parser.js                    # transcript format detection/normalization into turns
│   ├── metrics.js                   # per-turn quality metrics + slop score
│   ├── db.js                        # SQLite schema + CRUD for runs/turns (node:sqlite)
│   ├── import.js                    # orchestrate import → compute metrics → persist
│   ├── report.js                    # HTML/JSON report export
│   ├── cli.js                       # CLI with CI gate (non-zero exit on slop threshold breach)
│   └── server.js                    # Express static + API endpoints
├── test/
│   ├── metrics.test.js              # metric unit tests on synthetic turns
│   ├── parser.test.js               # parser format detection tests
│   ├── import.test.js               # import pipeline + CI gate exit codes
│   └── fixtures.test.js             # fixture-driven acceptance tests (good vs slop)
└── reports/                         # generated at runtime (gitignored)
```

## Metric Definitions

Each turn is one assistant message (plus its tool calls/results) or one agent-inspect step.

| Metric | Definition | Range |
| --- | --- | --- |
| verbosity_ratio | prose_chars / total_chars (prose = text minus fenced code blocks) | 0–1 |
| redundancy | 1 − (unique_4grams / total_4grams) over the turn text | 0–1 |
| step_signature_repetition | fraction of turns whose step signature repeats an earlier one in the run | 0–1 |
| claim_density | claims per 1000 chars (claims = regex-matched completion/verification phrases) | 0+ |
| code_yield | code_chars / total_chars | 0–1 |

**Slop score** (0–100), weighted sum:
```
slop = 100 * (0.25*verbosity + 0.25*redundancy + 0.20*stepRepetition
             + 0.15*(1 − clamp(claimDensity/2, 0, 1))
             + 0.15*(1 − codeYield))
```

**CI gate**: `--gate <threshold>` (default 60). Exits non-zero when the run's aggregate slop score (mean of per-turn scores) exceeds the threshold, or when any single turn exceeds the threshold.

## Test Strategy

- Unit tests for each metric on synthetic turns (high/low values).
- Parser tests for JSONL, agent-inspect, and session JSON formats.
- Import pipeline tests: import fixture → verify metrics → verify gate exit codes.
- Fixture-driven acceptance: good transcript passes gate (exit 0), slop transcript breaches gate (exit non-zero).
- Determinism: same input → same metrics.

## Acceptance Checks

1. **Fixture slop breach**: Given `fixtures/slop-transcript.jsonl` (3 verbose/repetitive/low-claim-density turns), the tool scores each turn, the CI gate exits non-zero, and the aggregate slop score exceeds the default threshold.
2. **Fixture clean pass**: Given `fixtures/good-transcript.jsonl` (3 high-quality turns), the CI gate exits 0.
3. **Per-turn breakdown**: The web UI displays per-turn metrics for every turn in a run.
4. **Multi-screen dashboard**: Run list, per-turn detail, and trend view all render.
5. **Persistence**: Imported runs survive a server restart (SQLite).
6. **Report export**: HTML and JSON reports export from a run.

## Milestones (remaining)

- **M2**: Agent hook integration (PreToolUse/Stop) that feeds recent quality scores back to the agent as "lessons learned" context injection, plus team-shared lesson library with outcome marks (applied/held/did-not-hold).
- **M3**: CI/CD integration (GitHub Actions, GitLab CI), multi-project team dashboard, trend alerting on quality regression, reproducible Docker deployment with smoke test.