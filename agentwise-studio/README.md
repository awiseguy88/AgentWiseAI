# AgentWise Studio

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/)**

Local-first web app for inspecting agent runs. Import a transcript, see which completion claims are backed by evidence, spot slow or repeated steps, persist runs in SQLite, and compare runs over time.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## What it does (Milestone 1)

- **Import agent transcripts** — JSON, JSONL, or plain-text transcripts (commands, results, assistant messages).
- **Verified vs unverified completion claims** — uses agent-done-claim-verifier–style analysis to detect "done/tests pass/build succeeded" claims and label each as `verified` or `unverified` with reasons (e.g. `failing_exit_before_claim`, `stale_green`, `no_rebuild`, `no_command_result`, `no_matching_command_result`). Includes a regression guard: an unrelated nearby result (like `git status`) does not verify a test claim.
- **Slow or repeated steps (drift)** — uses agent-drift-monitor–style analysis to flag threshold breaches, runaway loops (repeated step/output signatures), and token/latency/quality drift trends.
- **Persist runs in SQLite** — runs are stored locally in `.local/studio.db` so they survive app restarts.
- **Reopen and load previous runs** — the runs list loads from SQLite on startup.
- **Compare runs** — select a previous run and compare it with the current run to see claim status changes, new/missing alerts, and step metric deltas.
- **Offline, local-first** — no cloud dependency required.

## Requirements

- Node.js >= 20 (uses built-in `node:sqlite` and `node:test`)

## Install & run

```bash
cd agentwise-studio
npm install
npm start
```

Open [http://localhost:3456](http://localhost:3456) in your browser.

## Usage

1. Click **Import** and choose a transcript file (`.json`, `.jsonl`, `.txt`, `.md`).
2. The run is analyzed and saved. Claims appear under **Verified** or **Unverified** with evidence/reasons; drift alerts and step metrics appear below.
3. Close and reopen the app (or restart the server) — saved runs remain in the list.
4. Use **Compare Runs** to pick a previous run (A) and current run (B) and view differences.

## Tests

```bash
npm test
```

Includes smoke tests for import/analysis, a regression test for the false-verification case, drift smoke checks, and run comparison checks. Fixtures live in `fixtures/`.

## Files

- `PLAN.md` — goal, users, files, test strategy, acceptance checks
- `src/parser.js` — transcript parsing/normalization
- `src/verifier.js` — completion-claim detection and evidence matching
- `src/drift.js` — step timing, loop and drift analysis
- `src/db.js` — SQLite schema and persistence
- `src/import.js` — import → analyze → persist pipeline
- `src/compare.js` — run-to-run comparison
- `src/server.js` — Express server and API
- `public/` — web UI
- `fixtures/` — sample transcript and regression fixtures
- `test/` — automated tests

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
