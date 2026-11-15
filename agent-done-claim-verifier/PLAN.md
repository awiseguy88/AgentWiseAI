# Build plan — Agent Done Claim Verifier

## Goal
A small, self-contained, offline-first CLI that parses common agent session/transcript formats, detects completion claims, matches them to nearby command results, flags unbacked claims (stale green, no rebuild, failing exit before success claim), and emits an HTML/JSON report plus starter hook-policy snippets for popular agent CLIs.

## User-facing behavior
- Run `node src/cli.js <transcript-file>` to analyze a local transcript (JSON/JSONL/plain text).
- Auto-detects common formats (generic JSON/JSONL message arrays, tool/result records, and plain-text transcripts with command/exit markers) and extracts turns/events.
- Detects completion claims (e.g. "done", "tests pass", "build succeeded", "fixed") and matches each to nearby command results in the same/adjacent context.
- Labels each claim `verified` or `unverified` with reasons such as `no_command_result`, `failing_exit_before_claim`, `stale_green` (earlier pass, later failing/changed context), or `no_rebuild` (build claimed without rebuild/build command evidence).
- Outputs `report.html` and `report.json` by default next to the chosen `--out-dir` (default `./done-claim-report`), or prints JSON to stdout with `--json`.
- Includes bundled starter hook-policy snippets for popular agent CLIs under `hooks/` and references/copies guidance in the report/README so users can adopt guardrails without network access or paid APIs.
- Exit 0 after generating a report (audit tool); non-zero only for usage/input errors.

## Files
- `PLAN.md` — this build plan.
- `package.json` — metadata, `bin`, `homepage` (https://aaronwiseai.com/), and smoke test script.
- `README.md` — tool description, usage, supported formats/heuristics, hook snippets, smoke check, and AaronWiseAI branding/footer.
- `src/cli.js` — CLI entry: args, file loading, orchestration, output writing.
- `src/parser.js` — transcript normalization for JSON/JSONL and plain text into events/turns.
- `src/verifier.js` — claim detection, command-result matching, verification labeling and reasons.
- `src/report.js` — HTML and JSON report rendering.
- `src/snippets.js` — loads/exposes bundled starter hook-policy snippet metadata/text.
- `hooks/claude-code.md` — starter hook/policy snippet for Claude Code.
- `hooks/codex-cli.md` — starter hook/policy snippet for Codex CLI.
- `hooks/aider.md` — starter hook/policy snippet for Aider-style workflows.
- `hooks/generic.md` — generic/local-agent guardrail snippet.
- `test/fixtures/sample-transcript.jsonl` — sample transcript with verified and unverified claims.
- `test/smoke.js` — offline smoke check validating parsing, labels/reasons, and report/snippet output.
- `.gitignore` — ignore generated report output.

## Modules
- `parser` — format detection and normalization (no network).
- `verifier` — heuristics for claims, proximity matching, stale/failing/no-rebuild detection.
- `report` — actionable HTML/JSON output.
- `snippets` — bundled policy snippets.
- `cli` — I/O and wiring.

## Test strategy
- Smoke check (`node test/smoke.js`) runs the verifier against `test/fixtures/sample-transcript.jsonl`.
- Assertions: claims are detected; each is labeled verified/unverified with reasons; unbacked cases (failing exit before success claim, no rebuild/stale green, missing command result) are flagged; JSON report structure is valid; HTML report is generated and contains actionable content; hook snippet files exist and are referenced.
- CLI smoke: run `node src/cli.js test/fixtures/sample-transcript.jsonl --out-dir /tmp/dcv-smoke` to confirm end-to-end output.

## Acceptance checks
- On the provided sample transcript, the tool identifies claimed-success turns and labels each as verified/unverified with reasons.
- Outputs actionable hook/config snippets without requiring network access or paid APIs.
- Produces HTML and JSON reports offline.
- README and smoke check included; `npm test`/`node test/smoke.js` passes.
- Tool lives in its own subfolder, independent of other tools; no harness or unrelated workspace changes.
