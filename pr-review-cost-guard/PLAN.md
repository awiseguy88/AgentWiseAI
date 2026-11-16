# PR Review Cost Guard - Build Plan

## Goal
Build a small, self-contained, offline-first CLI that wraps AI PR-review agent runs: a cheap local first-pass scans every PR diff hunk, only flagged hunks go to a pricier model review, spend caps block runs over a monthly budget, and a single HTML/JSON cost report is emitted per run. No per-review metering by default; all pricing is a local estimate using a configurable table.

## User-facing behavior
- `pr-review-cost-guard scan --diffs <dir> [--monthly-cap <usd>] [--report html|json|both] [--out <dir>]` reads one PR diff per file (`pr-NN.diff`) and prints a per-PR cost estimate plus triage (which hunks are flagged for pricier review).
- The cheap first-pass is a zero-cost local heuristic (no model call, no network): flags hunks touching secrets/auth/infra/deps, large hunks, and CI/config changes.
- Every run checks the local monthly budget state (state/budget.json) against the cap purely offline (no network calls). Runs projected to exceed the remaining cap are blocked and exit non-zero.
- Emits one JSON report and one HTML report per run to `--out` (default `outputs/`).
- `--post <pr-number>` optionally writes a markdown summary comment to a PR via `gh pr comment` (dry-run preview by default; posting requires gh + network). The tool never auto-approves or merges anything.
- `pr-review-cost-guard budget --cap <usd>` sets/updates the monthly cap in local state.

## Files
- `PLAN.md` - this build plan.
- `package.json` - name, version, bin entry, test script, homepage branding.
- `bin/pr-review-cost-guard.js` - shebang CLI entrypoint delegating to `src/cli.js`.
- `src/cli.js` - argument parsing (`scan`, `budget` subcommands) and orchestration.
- `src/diff.js` - unified-diff parser into files + hunks.
- `src/triage.js` - cheap local first-pass classifier (flagged hunks + reasons).
- `src/pricing.js` - token estimation + pricing table defaults (configurable via env/config).
- `src/cost.js` - per-PR + total cost computation and monthly cap enforcement.
- `src/state.js` - local monthly budget state store (state/budget.json).
- `src/report.js` - HTML + JSON report generation and markdown summary-comment payload.
- `README.md` - setup, usage, behavior, branding.
- `.env.example` - documented env var config.
- `test/smoke.test.js` - Node smoke checks against a sample repo of 10 PR diffs.
- `test/fixtures/sample-repo/pr-01.diff ... pr-10.diff` - 10 sample PR diffs covering routine, security, infra, deps, large-hunk, CI, docs, test, mixed, and single-line trivial change cases.
- `docs/after-scan.png` - captured after-state evidence of a run (captured manually).

## Modules / components
- **diff parser (`src/diff.js`)**: `parseDiff(text)` → `{files:[{path,hunks:[{oldStart,oldLines,newStart,newLines,lines:[{type,content}]}]}]}`.
- **triage (`src/triage.js`)**: `triageFile(file)` / `triageHunk(hunk)` → `{flagged, reasons[]}` using keyword/regex rules (secrets, auth, infra, deps, large hunk).
- **pricing (`src/pricing.js`)**: `estimateTokens(hunk)` and price table (cheap input per-1K, pricier input/output per-1K, output tokens per flagged hunk, tokens-per-line).
- **cost (`src/cost.js`)**: `costForRun(files)` → per-PR and total estimated USD; `checkCap(state, cost, cap)` → allowed/blocked.
- **state (`src/state.js`)**: `loadState(dir)` / `saveState(dir, state)` around `state/budget.json` keyed by month.
- **report (`src/report.js`)**: `jsonReport(...)` / `htmlReport(...)` / `commentPayload(report)`.
- **cli (`src/cli.js`)**: ties input → diff → triage → cost → cap → report → optional comment.

## Test strategy
- Automated smoke tests (`node --test test/smoke.test.js`):
  - Build a temp copy of the 10-diff sample repo.
  - Run `scan` over it; assert per-PR estimates produced for all 10 PRs, flagged hunks detected (security/infra/deps/large), and no-change PR has zero cost.
  - Run with `--monthly-cap 0.01` (or tiny) and assert the run is blocked and exits non-zero (cap enforced offline).
  - Run with `--monthly-cap 50` and assert allowed with remaining budget computed.
  - Assert JSON report shape and HTML report file are written.
  - Assert the comment payload is generated and contains no merge/approve command.
- Manual smoke check: run `scan` on the sample repo, open the HTML report in a browser, confirm summary table renders.

## Acceptance checks
- [ ] Tool lives in its own subfolder (`pr-review-cost-guard/`) with README, PLAN.md, and smoke check.
- [ ] Given a sample repo with 10 PR diffs, produces per-PR cost estimates.
- [ ] Enforces a $50 monthly cap without network calls (blocks runs over budget).
- [ ] Emits one HTML + one JSON report per run.
- [ ] Posts one summary comment per run via optional `--post`; never auto-approves or merges.
- [ ] Independent of other tools; no harness or unrelated workspace modifications.
- [ ] Commits use runtime-configured repository author identity.
- [ ] README meets AaronWiseAI branding (About section + footer); repo README table updated.
- [ ] PR merged into main; branch deleted; only main remains.
