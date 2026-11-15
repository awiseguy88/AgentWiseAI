# Build plan — Vibe-Coded App Doctor

## Goal
A small, self-contained, offline-first CLI that scans a codebase for common AI-generated ("vibe-coded") web app mistakes and emits a prioritized fix list as a single-file HTML report. Independent of other tools; no accounts, no paid services, no network calls.

## User-facing behavior
- Run `node src/cli.js <path>` (or `./src/cli.js <path>`) against any codebase.
- Produces a prioritized HTML report (`vibe-doctor-report.html` by default in the scanned project; `--out` to choose a path).
- Report lists each detected issue with category, severity (High/Medium/Low), file/line reference, description, and suggested fix.
- `--json` prints the raw scan result to stdout instead of writing HTML.
- Exits 0 after generating the report (reporting/audit-only tool).

## Files
- `package.json` — manifest + `bin` pointing at `src/cli.js`; `npm test`/`npm run smoke` run the smoke check.
- `README.md` — usage, category table, smoke check instructions.
- `PLAN.md` — this file (goal, behavior, files, modules, test strategy, acceptance checks).
- `src/cli.js` — CLI entry: arg parsing, directory validation, scanner invocation, HTML/JSON output, exit code.
- `src/scanner.js` — static/heuristic scanner: file walking, ignore rules, per-category detectors.
- `src/report.js` — self-contained single-file HTML report renderer with styling, severity badges, category badges.
- `tests/smoke.js` — offline smoke test using a bundled sample fixture; verifies report creation, title, category coverage (>=5 of 6), file/line references, fix suggestions.
- `tests/fixtures/sample-app/` — small vibe-coded fixture with intentional mistakes (hardcoded secret, missing env validation, unhandled async error, wildcard CORS, 0.0.0.0 bind, debug route, unpinned dep, no test script, no lockfile).

## Modules
- `src/cli.js` — entry/orchestration.
- `src/scanner.js` — detection logic for 6 categories.
- `src/report.js` — HTML rendering only (no DOM/browser dependency).

## Test strategy
- Offline smoke test (`tests/smoke.js`): spawns the CLI on the bundled fixture, checks exit code, report existence, HTML title, presence of all 6 category keys, file/line references, and fix-suggestion markers.
- Manual verification: JSON mode output; error handling on missing directory; clean-repo (0 issues) behavior.

## Acceptance checks
- Tool runs offline with zero runtime dependencies (Node.js stdlib only).
- CLI + single-file HTML report produced from a sample vibe-coded repo.
- Report lists each detected issue with file/line references and suggested fixes.
- Report flags at least five of the six documented recurring categories.
- README and smoke check present; smoke check passes (`npm test`).
- Independent of other tools; does not touch harness or unrelated workspaces.
- Commits use repository author identity (awiseguy88 / 18493653+awiseguy88@users.noreply.github.com).
