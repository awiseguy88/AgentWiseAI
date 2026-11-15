# Build plan — Agent Capability Auditor

## Goal
A small, self-contained, offline-first local CLI (`agent-cap-audit`) that scans common agent configs/wrappers (Codex config/features, Claude/Cursor MCP configs, mcp.json, project scripts) to enumerate available tools/connectors, classifies actions by risk (read, write, impersonate-user, external-post), compares them against a per-role policy file, and emits an HTML/JSON report with fix snippets (disable connector features, strict MCP config, least-privilege allowlists). Includes a sample incident fixture from the Slack-as-me case.

## User-facing behavior
- `node src/cli.js <scan-root> [options]` scans a local directory for agent configs/wrappers:
  - Codex: `~/.codex/config.toml` / `~/.codex/features.toml` and project `codex.json`/`codex.features.json` (or nearest parent `CODE_X_CONFIG` paths); this release scans the scan root and common home-config lookalikes present under it.
  - Claude Code: `CLAUDE.md`-referenced MCP config and `~/.claude/claude_code_mcp.json`/project `.claude/mcp.json`/desktop MCP config.
  - Cursor: `~/.cursor/mcp.json` / project `.cursor/mcp.json`.
  - Generic: `mcp.json` anywhere under the scan root; `package.json` scripts referencing agents/MCP/connectors.
- Detects connector invocations in scripts and config (`slack`, `gmail`, `drive`, `calendar`, `contacts`, `github`, `figma`, `notion`, `mcp-server-*`, `@modelcontextprotocol/*`).
- Classifies each detected capability by risk tag: `read`, `write`, `impersonate-user`, `external-post` (multi-tag supported).
- Loads an optional per-role policy file (`--policy`, default `agent-cap-audit-policy.json` in the scan root) listing per-role allowed/denied capabilities; default policy denies nothing (audit-only) unless configured.
- Compares capabilities against policy: flags violations (capability present but not allowed for the scanned role, or explicitly denied).
- Emits `report.json` and `report.html` (default `./agent-cap-audit-report/`) plus `--json` stdout; includes fix snippets per violation (disable connector feature, strict MCP config allowlist, least-privilege allowlist, revoke OAuth scope).
- Includes bundled sample fixtures: `test/fixtures/incident/` (Slack-as-me case: connectors active, impersonation path) and `test/fixtures/disabled/` (connectors disabled, passes).
- Exit code: 0 = audit completed; 1 = policy violations found (useful in CI gates); 2 = usage/input error.
- Runs offline on local files with no paid APIs and no external dependencies (plain Node.js).

## Files
- `PLAN.md` — this build plan.
- `package.json` — metadata, `bin: agent-cap-audit -> src/cli.js`, homepage https://aaronwiseai.com/, license MIT, smoke script.
- `README.md` — About AaronWiseAI section with required line, footer line, usage, fixtures, smoke check, and Part-of-AaronWiseAI footer.
- `LICENSE` — MIT license text.
- `src/cli.js` — CLI entry: args, scan orchestration, policy load, comparison, output writing, exit codes.
- `src/scanners.js` — scanner modules for codex/claude/cursor/mcp.json/package-scripts (config parsing + capability extraction).
- `src/classifier.js` — risk classification rules per connector/tool.
- `src/policy.js` — policy file loading, defaults, per-role allow/deny matching.
- `src/report.js` — HTML and JSON report rendering with fix snippets.
- `test/fixtures/incident/*.json` — Slack-as-me incident fixture (connectors active, impersonation/external-post capabilities present).
- `test/fixtures/disabled/*.json` — second fixture with connectors disabled; expected to pass cleanly.
- `test/smoke.js` — offline smoke check: run CLI against both fixtures, assert violations flagged on incident, none flagged on disabled, HTML/JSON outputs exist and contain fix snippets.
- `examples/strict-mcp/mcp.json` — example strict MCP config.
- `examples/allowlist/*.json` — example least-privilege allowlist policies.
- `.gitignore` — ignore generated report output.

## Modules
- `scanners` — config discovery and capability extraction (no network).
- `classifier` — risk tag assignment per capability/connector.
- `policy` — role-scoped allow/deny matching.
- `report` — HTML/JSON rendering with remediation snippets.
- `cli` — I/O and wiring.

## Test strategy
- Smoke check (`node test/smoke.js`) runs offline:
  - Run `node src/cli.js test/fixtures/incident --role executor --out-dir /tmp/cap-audit-incident`; expect non-zero exit with violations flagged for slack impersonation/external-post capabilities; assert JSON report structure and HTML report contain `slack`, `impersonate-user`, `external-post`, and fix snippets.
  - Run `node src/cli.js test/fixtures/disabled --role executor --out-dir /tmp/cap-audit-disabled`; expect exit 0 with zero violations.
  - Assert `--json` stdout emits valid JSON and `report.html`/`report.json` files are written.
- CLI smoke: end-to-end runs against both fixtures.

## Acceptance checks
- Tool lives in its own subfolder `agent-cap-audit/`, independent of other tools; no harness/workspace changes; no paid APIs.
- Given sample configs where an executor role can reach Slack/Gmail/Drive connectors, the tool flags impersonating/external-post capabilities, fails (exit 1) when policy forbids them, and outputs concrete remediation snippets.
- A second fixture with connectors disabled passes (exit 0, zero violations).
- Runs offline on local files with no paid APIs.
- README and smoke check included; `node test/smoke.js` passes.
- Root README tool table updated with folder link, one-line description, and merged PR link.
- PR merged into `main`, branch deleted; only `main` remains locally.
