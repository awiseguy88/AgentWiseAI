# Agent Rule Linter (`agent-rule-linter`)

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## What it does

`agent-rule-linter` is a small, dependency-light, offline-first local CLI that parses `AGENTS.md` / `CLAUDE.md` / rule files, classifies each rule as **machine-checkable** or **vague/manual**, and generates enforcement snippets (pre-commit hooks, CI checks, and agent-hook snippets) for the checkable ones.

It helps teams turn written agent rules (e.g. "never force push", "always run tests", "use pnpm") into enforceable checks instead of leaving them as suggestions agents can ignore.

## Scans

Looks for these rule files under the given directory (or current working directory):

- `AGENTS.md`
- `CLAUDE.md`
- `CLAUDE-CODE.md`
- `RULES.md`
- `AGENT-RULES.md`

Runs fully offline on local files. No paid APIs, no external dependencies (plain Node.js).

## Classification

Rules are heuristically classified as:

- **Machine-checkable** — patterns like "never force push", "run tests" (`npm test` / `pnpm test`), "use pnpm", "prettier", "eslint", file/branch restrictions, etc. The tool emits enforcement snippets for these.
- **Vague / manual review** — advisory language like "write clean code", "follow best practices", "consider", "try to", or rules that are too ambiguous to enforce automatically. These are flagged for manual review.

## Usage

```bash
# Lint rule files in the current directory
node src/cli.js .

# Scan a specific project
node src/cli.js /path/to/project

# Output JSON to stdout
node src/cli.js /path/to/project --json

# Write reports and enforcement artifacts
node src/cli.js /path/to/project --out ./rule-report --hooks --ci --agent-hooks
```

Exit code: `0` on success (advisory — does not fail builds by default), `2` on usage/input error.

Outputs `report.json` and `report.html` summarizing each rule, its classification, and the reason. With `--hooks`, `--ci`, and `--agent-hooks`, it also writes generated pre-commit hooks, CI snippets, and agent-hook snippets for checkable rules.

## Example

```bash
node src/cli.js examples --out reports/smoke --hooks --ci --agent-hooks
```

Given a sample `AGENTS.md` with five rules, the tool identifies which rules are machine-checkable, emits working enforcement snippets for the checkable ones, and flags vague rules for manual review.

## Testing

```bash
npm test
```

## License

MIT
