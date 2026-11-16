# PLAN: AgentWise Studio — Milestone 1

## Goal
Build a local-first, open-source desktop/web app for inspecting agent runs. This milestone creates the core analysis shell:
- Import an agent transcript (JSON/JSONL/plain text)
- Show verified vs unverified completion claims using `agent-done-claim-verifier` logic
- Show slow or repeated steps using `agent-drift-monitor` logic
- Persist runs in SQLite (local file)
- Reopen the app and load a previous run
- Compare a previous run with the current run
- Include a regression fixture for the false verification case

No cloud dependencies; everything runs locally.

## Users
- AI agent developers and researchers who run local agents (Claude Code, Codex, Aider, custom)
- Engineers debugging agent reliability and drift
- Anyone wanting an offline record of what their agent actually did vs claimed

## Files and Modules

```
agentwise-studio/
├── LICENSE                          # MIT
├── package.json                     # name, version, scripts, homepage: https://aaronwiseai.com/
├── README.md                        # About AaronWiseAI section + footer
├── PLAN.md                          # this file
├── fixtures/
│   ├── sample-transcript.jsonl      # from verifier (verified + unverified claims)
│   └── false-positive.json          # regression: git status ≠ test evidence
├── public/
│   ├── index.html                   # main UI
│   ├── style.css                    # styling
│   └── app.js                       # frontend logic
├── src/
│   ├── db.js                        # SQLite schema + CRUD for runs
│   ├── verifier.js                  # claim detection/labeling (adapted from agent-done-claim-verifier)
│   ├── drift.js                     # step timing/loop/drift analysis (adapted from agent-drift-monitor)
│   ├── parser.js                    # transcript format detection/normalization (adapted)
│   ├── import.js                    # orchestrate import → analyze → persist
│   ├── compare.js                   # run-to-run comparison logic
│   └── server.js                    # Express static + API endpoints
├── test/
│   ├── smoke.test.js                # import → analyze → verify claims
│   ├── regression-false-positive.test.js  # git status does not verify test claim
│   ├── drift-smoke.test.js          # drift alerts on sample trace
│   └── compare.test.js              # run comparison produces diffs
└── reports/                         # generated at runtime (gitignored)
```

## Reuse Strategy
- **Verifier logic**: Extract `analyze()`, `CLAIM_PATTERNS`, `detectClaims`, `evaluateClaim` from `agent-done-claim-verifier/src/verifier.js` into `src/verifier.js`
- **Parser logic**: Extract `readTranscript`, `normalizeStructured`, `parsePlainText` from `agent-done-claim-verifier/src/parser.js` into `src/parser.js`
- **Drift logic**: Extract `loadTrace`, `parseTrace`, `analyze`, `makeReport` from `agent-drift-monitor/src/lib.js` into `src/drift.js`
- **HTML report rendering**: Adapt for web UI instead of file output

## Database Schema (SQLite)
```sql
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_path TEXT,
  transcript_format TEXT,
  imported_at TEXT DEFAULT (datetime('now')),
  summary_json TEXT NOT NULL
);

CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  turn_index INTEGER,
  claim_text TEXT,
  claim_type TEXT,
  status TEXT,          -- 'verified' | 'unverified'
  reasons_json TEXT,
  evidence_json TEXT
);

CREATE TABLE drift_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT,
  severity TEXT,
  step_indices_json TEXT,
  message TEXT,
  metric_json TEXT
);

CREATE TABLE drift_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_index INTEGER,
  name TEXT,
  type TEXT,
  span TEXT,
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  quality REAL,
  input_preview TEXT,
  output_preview TEXT,
  signature TEXT,
  output_signature TEXT
);
```

## API Endpoints (Express)
- `POST /api/import` — multipart file upload → parse → analyze → persist → return run ID
- `GET /api/runs` — list all saved runs (id, name, imported_at, summary)
- `GET /api/runs/:id` — full run data (claims, drift steps, alerts, summary)
- `GET /api/compare/:id1/:id2` — comparison between two runs

## Test Strategy
- **Unit/integration** via `node --test` (Node built-in test runner, no deps)
- **Fixtures**: reuse `agent-done-claim-verifier/test/fixtures/sample-transcript.jsonl` and `test/false-positive.test.js` events
- **Drift fixture**: reuse `agent-drift-monitor/examples/sample-trace.json`
- **Smoke tests**: import transcript → analyze → verify claims labeled verified/unverified with reasons
- **Regression test**: false-positive case (git status near test claim → unverified)
- **Drift smoke**: parse trace → detect threshold/loop/drift alerts
- **Compare test**: import same transcript twice → compare → zero diffs; import different → non-zero diffs

## Acceptance Checks
1. **Import works**: A real agent transcript (sample JSONL) imports and shows parsed events
2. **Verified vs unverified**: Claims are clearly separated; verified show green/check, unverified show red/warning with reasons (`failing_exit_before_claim`, `stale_green`, `no_rebuild`, `no_matching_command_result`, `no_command_result`)
3. **Drift analysis**: Slow steps and repeated steps are flagged with alerts (threshold, runaway_loop, token_drift, latency_drift, quality_drift)
4. **Persistence**: After import, close/reopen app (or restart server) → run appears in list → load shows same data
5. **Comparison**: Select a previous run → compare with current → shows claim status changes, new/missing alerts, step metric deltas
6. **Regression**: False-positive fixture (`git status` + "tests pass" claim) stays unverified with `no_matching_command_result` reason
7. **Offline**: No network calls during any operation; all analysis local

## Scripts
- `npm test` → runs all test files via `node --test`
- `npm start` → starts Express server on `http://localhost:3456`
- `npm run dev` → same as start (no HMR needed for MVP)

## Constraints
- Node ≥ 20 (uses `node:sqlite`, `node:test`)
- Zero runtime deps for analysis (parser/verifier/drift are pure JS modules)
- Express only for the web server
- Local-first: no cloud, no auth, no telemetry