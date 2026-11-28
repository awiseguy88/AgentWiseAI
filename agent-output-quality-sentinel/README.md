# Agent Output Quality Sentinel

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/)**

Local-first web app that scores agent output quality per turn — verbosity ratio, redundancy (n-gram repetition), step-signature repetition, claim density, and code yield — with an Express + static UI, SQLite persistence, HTML/JSON report export, and a CI gate that exits non-zero on quality threshold breach.

## What it does (Milestone 1)

- **Import agent transcripts** — JSONL, JSON, agent-inspect step files, and plain-text transcripts.
- **Per-turn quality metrics** — verbosity ratio, redundancy via 4-gram repetition, step-signature repetition, claim density, code yield, plus a weighted slop score (0–100).
- **Multi-screen dashboard** — run list, per-turn detail table, and trend view with a gate-threshold line.
- **Persist runs in SQLite** — runs and turns are stored locally in `.local/sentinel.db` and survive restarts.
- **HTML/JSON report export** — per-run reports from the CLI or UI.
- **CI gate** — `--gate <threshold>` (default 60) exits non-zero when the aggregate slop score or any turn exceeds the threshold.
- **Offline, local-first** — no cloud dependency required.

## Requirements

- Node.js >= 22 (uses built-in `node:sqlite` and `node:test`)

## Install & run

```bash
cd agent-output-quality-sentinel
npm install
npm start
```

Open [http://localhost:3458](http://localhost:3458) in your browser.

## Usage

1. Click **Import** and choose a transcript file (`.json`, `.jsonl`, `.txt`, `.md`).
2. The run is analyzed and saved. Per-turn metrics and slop scores appear under **Per-turn**; the trend view charts slop over turns with the gate threshold line.
3. Close and reopen the app (or restart the server) — saved runs remain in the list.
4. Export an HTML/JSON report via the CLI or UI.

## CLI gate (CI)

```bash
# slop fixture should fail (exit 1)
node src/cli.js --input fixtures/slop-transcript.jsonl --gate 60

# clean fixture should pass (exit 0)
node src/cli.js --input fixtures/good-transcript.jsonl --gate 60

# with report export
node src/cli.js --input fixtures/slop-transcript.jsonl --out reports/smoke --json --html --gate 60
```

## Tests

```bash
npm test
```

Includes unit tests for metrics and parser, plus fixture-driven acceptance tests (good transcript passes gate, slop transcript fails gate). Fixtures live in `fixtures/`.

## Files

- `PLAN.md` — goal, users, files, test strategy, acceptance checks
- `package.json` — scripts, homepage: https://aaronwiseai.com/
- `README.md` — this file
- `LICENSE` — MIT
- `src/parser.js` — transcript format detection/normalization into turns
- `src/metrics.js` — per-turn quality metrics + slop score + CI gate
- `src/db.js` — SQLite schema + CRUD for runs/turns
- `src/import.js` — import → compute metrics → persist pipeline
- `src/report.js` — HTML/JSON report export
- `src/cli.js` — CLI with CI gate
- `src/server.js` — Express static + API endpoints
- `public/` — web UI (index.html, app.js, style.css)
- `fixtures/` — good and slop transcripts
- `test/` — automated tests
- `reports/` — generated at runtime (gitignored)

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/