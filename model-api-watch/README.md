# Model API Watch

Offline-first CLI for developers that scans a project for hard-coded LLM model IDs and reports affected models with dated price changes, deprecations, replacement recommendations, and cost impact—replacing manual checks of provider deprecation pages and rate-card spreadsheets.

- **Offline:** no paid APIs, no accounts, no network calls — runs entirely locally.
- **Self-contained:** zero runtime dependencies (Node.js standard library only).
- **Actionable output:** lists each affected model, where it appears, the change date, the new price or failure mode, a suggested replacement, and cost impact.

## What it checks

Model API Watch ships with a bundled, dated registry of known changes (updated offline by the tool author). Given a project, it scans source and config files for model IDs and reports any that appear in the registry.

Current bundled changes include examples such as:

| Model | Change | Effective | Replacement | Cost impact |
| --- | --- | --- | --- | --- |
| `claude-sonnet-4-5` | Retires | 2026-11-30 | `claude-sonnet-4-5-20261101` | Calls fail after Nov 30 unless replaced |
| `gemini-4-carbon` | Price doubles | 2026-12-01 | `gemini-4-carbon-20261201` | Input cost +$1.50/1M |
| `gemini-4-argon` | Price doubles | 2026-12-01 | `gemini-4-argon-20261201` | Input cost +$2.00/1M |
| `gpt-5` family | Shut down | 2026-12-11 | `gpt-5.6-sol` | All gpt-5/* calls fail Dec 11 |
| `o3` family | Shut down | 2026-12-11 | `o4-mini` | All o3/* calls fail Dec 11 |
| `gpt-5.6-sol` | Price doubles | 2027-01-01 | `gpt-5.6-sol-20270101` | Input cost +$1.25/1M |

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

- `--json`: print the raw scan result as JSON to stdout instead of the text report
- `-h, --help`: show usage

Example:

```bash
node src/cli.js ../my-llm-app
```

The report lists each affected model with the file/line where it was found, the change date, the new price or failure mode, a suggested replacement, and cost impact.

## Smoke check

Run the included offline smoke check (scans a bundled sample fixture and verifies affected models, replacements, and cost impact are reported):

```bash
npm test
# or
node tests/smoke.js
```

## Notes

- Heuristic/static scan: it surfaces likely hard-coded model IDs and may produce false positives/negatives. Review findings in context.
- Scans common source and config extensions and skips common build/vendor directories (`node_modules`, `dist`, `.git`, etc.).
- The registry is bundled for offline use; update `src/registry.js` to add or revise known changes.

## About AaronWiseAI

AaronWiseAI builds practical, offline-first tools for AI agents and developers. Visit https://aaronwiseai.com/

Part of the AaronWiseAI tool collection — https://aaronwiseai.com/
