# Build plan — Model API Watch

## Goal
A small, self-contained, offline-first CLI that scans a project for hard-coded model IDs in code and config, checks them against a bundled dated list of known price changes and deprecations, and prints a report of affected models with replacement recommendations and cost impact. Independent of other tools; no accounts, no paid APIs, no network calls.

## User-facing behavior
- Run `node src/cli.js <path>` (or `./src/cli.js <path>`) against any project.
- Prints a plain-text report to stdout listing each affected model: the model ID found, where it appears (file/line), the change date, the new price or failure mode, a suggested replacement, and a cost impact note.
- `--json` prints the raw scan result as JSON to stdout instead of the text report.
- `-h, --help` shows usage.
- Exits 0 on success (reporting/audit-only tool); exit 2 when the target is missing or not a directory.

## Files
- `package.json` — manifest + `bin` pointing at `src/cli.js`; `npm test`/`npm run smoke` run the smoke check; `homepage` set to `https://aaronwiseai.com/`.
- `README.md` — usage, registry contents, smoke check instructions, AaronWiseAI branding.
- `PLAN.md` — this file (goal, behavior, files, modules, test strategy, acceptance checks).
- `src/cli.js` — CLI entry: arg parsing, directory validation, scanner invocation, text/JSON output, exit code.
- `src/scanner.js` — file walking with ignore rules, model-ID regex extraction from source and config files.
- `src/registry.js` — bundled, dated list of known price changes and deprecations, with replacement recommendations and cost impact.
- `tests/smoke.js` — offline smoke test using a bundled sample fixture; verifies report output, affected-model coverage, file/line references, replacement recommendations, and cost impact notes.
- `tests/fixtures/sample-project/` — small fixture with intentional hard-coded model IDs (Gemini 4 Carbon, Claude Sonnet 4.5, gpt-5.6-sol, plus a stable one to show unaffected models).

## Modules
- `src/cli.js` — entry/orchestration.
- `src/scanner.js` — detection logic (file walk + model-ID extraction).
- `src/registry.js` — data only (known changes, replacements, cost impact).

## Test strategy
- Offline smoke test (`tests/smoke.js`): spawns the CLI on the bundled fixture, checks exit code, stdout contains each affected model ID, the change date, a replacement recommendation, and a cost impact note; confirms the unaffected model is not flagged.
- Manual verification: JSON mode output; error handling on missing directory; clean project with no model IDs.

## Acceptance checks
- Tool runs offline with zero runtime dependencies (Node.js stdlib only).
- CLI prints a report listing each affected model with change date, new price or failure mode, suggested replacement, and cost impact.
- Smoke check passes (`npm test`).
- README and smoke check present; independent of other tools; does not touch harness or unrelated workspaces.
- Commits use repository author identity (awiseguy88 / 18493653+awiseguy88@users.noreply.github.com).