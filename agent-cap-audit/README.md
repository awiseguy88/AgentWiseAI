# Agent Capability Auditor (`agent-cap-audit`)

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## What it does
`agent-cap-audit` is a small, dependency-light, offline-first local CLI that scans common agent configs and wrappers to inventory available tools/connectors, classify actions by risk, compare them against a per-role policy, and emit actionable HTML/JSON reports.

It helps prevent "confused deputy" incidents where a coding agent silently uses account-level connectors (Slack, Gmail, Drive, Calendar, Contacts, GitHub, etc.) to act in a human's name.

## Scans
- Generic `mcp.json` files (anywhere under the scan root)
- Claude/Cursor project configs: `.claude/mcp.json`, `.claude/claude_code_mcp.json`, `.cursor/mcp.json`
- Codex config lookalikes in the scan root: `.codex/config.toml`, `.codex/features.toml`, `codex.json`, `codex.features.json`
- `package.json` scripts that reference agents/MCP/connectors

Runs fully offline on local files. No paid APIs, no external dependencies (plain Node.js).

## Risk classification
Detected capabilities are tagged with one or more risks:
- `read` — can read data
- `write` — can modify data/state
- `impersonate-user` — can act as the authenticated human
- `external-post` — can send messages/content outside the local environment

## Per-role policy
Compare findings against a per-role policy file (default: `agent-cap-audit-policy.json` in the scan root, or pass `--policy <file>`). If no policy is provided, a safe default is used that denies `impersonate-user` and `external-post` for the `executor` role.

Example policy:
```json
{
  "version": 1,
  "roles": {
    "executor": { "deny": ["impersonate-user", "external-post"], "allow": ["read"] }
  }
}
```

## Usage
```bash
# Scan a directory (default role: executor)
node src/cli.js /path/to/project --out-dir ./agent-cap-audit-report

# Specify role and policy
node src/cli.js /path/to/project --role executor --policy ./examples/allowlist/executor-policy.json

# Print JSON report to stdout
node src/cli.js /path/to/project --json

# Or if installed/linked as a bin
agent-cap-audit /path/to/project
```

Exit codes: `0` = pass (no policy violations), `1` = policy violations found, `2` = usage/input error.

Outputs `report.json` and `report.html` with findings and fix snippets (disable connector features, strict MCP config, least-privilege allowlists).

## Sample incident fixture (Slack-as-me case)
`test/fixtures/incident/` contains a sample where an executor role can reach Slack/Gmail/Drive/Calendar/Contacts/GitHub connectors (including Codex feature flags and an MCP config). Auditing it flags impersonating/external-post capabilities and fails when policy forbids them, with concrete remediation snippets.

```bash
node src/cli.js test/fixtures/incident --role executor --out-dir /tmp/cap-audit-incident
# => exit 1, violations reported with fix snippets
```

## Disabled/pass fixture
`test/fixtures/disabled/` shows connectors disabled and a strict read-only MCP setup; it passes the executor policy.

```bash
node src/cli.js test/fixtures/disabled --role executor --out-dir /tmp/cap-audit-disabled
# => exit 0, no violations
```

## Smoke check
```bash
node test/smoke.js
```
Runs the CLI offline against both fixtures and asserts: incident flags Slack/Gmail/Drive impersonating/external-post violations and emits HTML/JSON with fix snippets; disabled fixture passes with zero violations.

## Examples
- `examples/strict-mcp/mcp.json` — strict MCP config example
- `examples/allowlist/executor-policy.json` — least-privilege executor allowlist policy

## License
MIT (see [LICENSE](LICENSE)).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
