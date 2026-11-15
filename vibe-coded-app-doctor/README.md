# Vibe-Coded App Doctor

Offline CLI that scans a codebase for common AI-generated ("vibe-coded") web app mistakes and emits a **prioritized, single-file HTML report** with file/line references and suggested fixes.

- **Offline:** no paid APIs, no accounts, no network calls — runs entirely locally.
- **Self-contained:** zero runtime dependencies (Node.js standard library only).
- **Output:** one portable HTML file you can open in any browser.

## What it checks

The scanner flags recurring problem categories seen in AI-generated apps:

| Category | Examples |
| --- | --- |
| Hardcoded secrets | API keys/tokens/passwords committed in source |
| Missing env validation | `process.env`/env reads without startup validation or `.env.example` |
| Missing tests | No test files or no real `test` script |
| Unhandled errors | Async route/handler/server code without visible `try/catch` or `.catch` |
| Dependency issues | Floating/unpinned deps, missing lockfile, unpinned requirements |
| Exposed endpoints | Wildcard CORS, binding to `0.0.0.0`, debug/admin routes in app code |

Issues are prioritized by severity (High / Medium / Low) with a concrete fix suggestion for each finding.

## Requirements

- Node.js 16+ (no npm install required)

## Usage

From this folder:

```bash
node src/cli.js /path/to/project
# or
./src/cli.js /path/to/project
```

Options:

- `--out <file>`: write the report to a specific path (default: `<project>/vibe-doctor-report.html`)
- `--json`: print the raw scan result as JSON to stdout instead of writing HTML
- `-h, --help`: show usage

Example:

```bash
node src/cli.js ../my-vibe-app --out report.html
```

The command prints a short summary and exits `0` after generating the report (it is a reporting/audit tool).

## Smoke check

Run the included offline smoke check (scans a bundled sample fixture and verifies the report covers the documented categories):

```bash
npm test
# or
node tests/smoke.js
```

## Notes

- Heuristic/static scan: it surfaces likely issues and may produce false positives/negatives. Review findings in context.
- Scans common source extensions (`.js/.jsx/.ts/.tsx/.mjs/.cjs/.py/.rb/.go/.java/.php`) and skips common build/vendor directories (`node_modules`, `dist`, `.git`, etc.).
