# Local Model Coding Fit Checker

Offline-first CLI that runs a small coding task suite against one local model and one cloud model, records pass/fail, token cost, and estimated electricity cost, and emits a routing report recommending which tasks go local vs API.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## What it does
- Runs **bundled mini SWE-style tasks** plus **tasks extracted from a local repo's own tests** (scans `test/`, `tests/`, `__tests__/`, `spec/`).
- Compares **one local model** and **one cloud model** per task: pass/fail, token usage, cloud token cost, and estimated local electricity cost.
- Writes an offline **HTML/JSON routing report** recommending `local` or `api` per task with rationale and an overall summary.
- Fully offline-capable via deterministic mock adapters (no paid APIs required for smoke checks or local evaluation workflows).

## Requirements
- Node.js 16+ (no runtime dependencies; standard library only)

## Usage
```bash
node src/cli.js \
  --repo /path/to/repo-with-tests \
  --local mock:test/fixtures/local.mock.json \
  --cloud mock:test/fixtures/cloud.mock.json \
  --tasks all \
  --out-dir ./local-model-fit-checker-report
```

### Model adapters
- `mock:<responses.json>` — offline deterministic responses keyed by task id. Each entry: `{ "output": "...", "tokens_in": N, "tokens_out": N, "latency_ms": N }`. Useful for CI/smoke checks and reproducible comparisons.
- `cmd:<shell command>` — runs a shell command with the prompt on stdin; expects JSON `{output,tokens_in,tokens_out}` on stdout (raw stdout is accepted with rough token estimates).
- `ollama:<model>@<baseUrl>` — calls Ollama `/api/generate` (network only when explicitly used). Default base URL `http://localhost:11434`.

### Options
- `--tasks <bundled|repo|all>`: task suite (default `all`)
- `--out-dir <dir>`: output directory (default `./local-model-fit-checker-report`)
- `--json`: print report JSON to stdout
- `--electricity-rate <$/kWh>`: local electricity rate (default `0.15`)
- `--local-watts <W>`: estimated local inference power draw (default `150`)
- `--pricing <file.json>`: cloud token pricing `{ "input_per_million": n, "output_per_million": n }`
- `--fail-on-local-unfit`: exit 1 if overall routing is `api-preferred`

### Output
- `report.json`: machine-readable summary and per-task results (pass/fail, tokens, estimated electricity $, token cost $, recommendation, rationale).
- `report.html`: readable comparison and routing report.

## Smoke check
Runs fully offline using bundled fixtures and mock adapters:

```bash
npm test
# or
node test/smoke.js
```

The smoke check runs bundled and repo-extracted tasks against mock local/cloud responses, asserts pass/fail and cost fields are recorded, verifies mixed routing recommendations, and confirms HTML/JSON reports are written.

## Notes
- Task extraction from repo tests is heuristic and lightweight (prompt derived from test names/excerpts with simple keyword checks) so it works offline without executing untrusted test suites.
- Electricity and token costs are estimates; supply `--local-watts`, `--electricity-rate`, and `--pricing` to match your setup.
- No paid APIs are required by this tool.

## License
MIT (see [LICENSE](LICENSE)).

---
Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
