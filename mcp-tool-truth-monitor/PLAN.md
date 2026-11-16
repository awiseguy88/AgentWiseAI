# MCP Tool-Call Truth Monitor — Plan

## Goal
Build a local-first tool that ingests agent/MCP traces, matches each tool result (returned error, `isError`, empty, timeout) to the agent’s later claim about that call, flags mismatches, and exports replayable fixtures plus offline HTML/JSON reports.

## Users
- Developers and small teams running Claude Code, Codex, Cursor, or OpenCode against MCP servers, ChatGPT connectors, or local tool integrations.
- Anyone debugging cases where an agent claims success after a failed, empty, or timed-out tool call.

## Scope (this release)
- **Inputs**
  - Agent-inspect style JSONL traces (normalized event records).
  - MCP stdio/HTTP proxy capture logs (JSON-RPC request/response pairs, including `isError` tool results and error responses).
- **Analysis**
  - Pair each tool call with its result.
  - Classify problematic results: returned error, `isError: true`, empty result/content, timeout/aborted/no-response.
  - Scan subsequent agent/assistant messages for claims about that specific call/tool outcome (success/completion/action-done language).
  - Flag mismatches when a problematic result is followed by a success/affirmative claim.
  - Record clean matches (tool result matches claim / no false positive on clean traces).
- **Multi-screen offline UI (single self-contained HTML app)**
  - Trace timeline: ordered tool calls/results and related agent claims.
  - Mismatch table: each mismatch with tool, step/index, claim excerpt, result summary, and references.
  - Claim-vs-result pairs: side-by-side detail view for selected call.
  - Load trace/report JSON via file input; works fully offline (`file://`, no network).
- **CLI**
  - Parse/normalize traces, run analysis, emit `report.json` and `report.html`.
  - Export replayable normalized fixture JSON from an input trace.
- **Deliverables in folder**
  - `PLAN.md`, `LICENSE` (MIT), `README.md` (About AaronWiseAI + required lines/footer).
  - `package.json` with `homepage: https://aaronwiseai.com/`.
  - `tests/` and `fixtures/` with acceptance and clean-trace cases.
- **Repo integration**
  - Add root `README.md` tool table entry for `mcp-tool-truth-monitor/`.

## Non-goals (for this milestone)
- Live capture daemons or IDE-specific plugins beyond parsing captured stdio/HTTP/JSONL artifacts.
- Networked services, hosted backends, or paid APIs.
- Perfect natural-language claim attribution for every possible phrasing (use clear heuristics + explainable references).

## Files
- `PLAN.md` — this plan.
- `LICENSE` — MIT.
- `README.md` — usage, formats, acceptance examples, About/footer.
- `package.json` — CLI metadata, scripts, homepage.
- `.gitignore` — local outputs.
- `src/cli.js` — CLI entry (analyze, export fixture, report paths).
- `src/parser.js` — load/normalize agent-inspect JSONL and MCP capture formats.
- `src/analyzer.js` — pair calls/results, detect problematic outcomes, match claims, flag mismatches.
- `src/report.js` — render JSON + self-contained HTML report/app with timeline, mismatch table, claim-vs-result views.
- `src/index.js` — library exports for tests.
- `web/index.html` — standalone offline viewer (can load report/trace JSON); report embeds equivalent UI/data for generated HTML.
- `fixtures/is-error-mismatch.jsonl` — acceptance sample: `isError: true` result followed by success claim.
- `fixtures/clean-trace.jsonl` — clean trace, all results match claims.
- `fixtures/mcp-capture.json` — sample MCP stdio/HTTP capture format.
- `tests/smoke.test.js` — Node test verifying acceptance mismatch detection/report output and clean trace zero mismatches.

## Test strategy
- Unit/integration via Node’s built-in test runner (`node --test`), no external deps.
- **Acceptance (required):** given a sample trace containing a tool result with `isError: true` followed by an agent claim that the action succeeded, the tool lists that call as a mismatch with tool/step/claim references and produces an HTML/JSON report offline.
- **Failure/negative:** given a clean trace where all tool results match claims, report zero mismatches and does not invent problems.
- Verify replayable fixture export is valid JSON and re-analyzable to the same mismatch count.
- Run `npm test` in the tool folder.

## Acceptance checks
- [ ] `mcp-tool-truth-monitor/` contains PLAN.md, LICENSE (MIT), README with required About/footer, package.json (`homepage` = https://aaronwiseai.com/), tests, fixtures.
- [ ] CLI analyzes acceptance fixture -> mismatch listed with tool/step/claim references; writes HTML and JSON reports offline.
- [ ] Clean fixture -> zero mismatches.
- [ ] Offline HTML shows trace timeline, mismatch table, claim-vs-result pairs.
- [ ] Replayable fixture export produced.
- [ ] Root README tool table updated with folder link and one-line description (PR noted as pending until opened).
- [ ] Relevant tests pass.
