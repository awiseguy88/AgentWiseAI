# LLM Model Migration Watch

Self-hosted CLI runner (with a path to a web platform) that loads a task suite — bundled mini agent scenarios plus tasks extracted from your own tests — runs them against a **current** model and one or more **candidate** models, and emits an HTML/JSON comparison report with a go/no-go recommendation and projected cost savings.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Problem

Teams face rapid model churn and need to know whether a newer or cheaper model is safe to adopt on *their own tasks*. Manual comparison is slow and regressions are often discovered in production. This tool runs your task suite against candidate models and tells you, with evidence, whether to migrate.

## What it does (Milestone 1)

- Loads a **bundled 10-task agent fixture suite** and can extract additional tasks from a repo's own tests.
- Runs every task against a configured **current** model and one or more **candidate** models.
- Records **pass/fail, cost per task, latency, and tool-call accuracy** for each model.
- Emits **`report.json`** and **`report.html`** with per-model summaries and per-task evidence.
- Produces a **go/no-go recommendation**: flags regressions (e.g. incorrect tool call) as *do not migrate* with specific failure evidence.
- Produces a **cost-vs-quality tradeoff** showing projected monthly savings vs quality delta for cheaper candidates.

## Requirements

- Node.js 18+ (no runtime dependencies; standard library only)

## Usage

```bash
node src/cli.js \
  --suite /path/to/repo-or-tasks \
  --current mock:tests/fixtures/current.mock.json \
  --candidate mock:tests/fixtures/candidate.mock.json \
  --candidate mock:tests/fixtures/candidate2.mock.json \
  --out-dir ./migration-report
```

### Model adapters

- `mock:<responses.json>` — offline deterministic responses keyed by task id. Each entry: `{ "output": "...", "tokens_in": N, "tokens_out": N, "latency_ms": N, "tool_call": "tool_name" }`. Useful for CI/smoke checks and reproducible comparisons.
- `cmd:<shell command>` — runs a shell command with the prompt on stdin; expects JSON `{output,tokens_in,tokens_out,latency_ms,tool_call}` on stdout (raw stdout accepted with rough token estimates).
- `ollama:<model>@<baseUrl>` — calls Ollama `/api/generate` (network only when explicitly used). Default base URL `http://localhost:11434`.

### Options

- `--suite <path>`: project/repo path to scan for tests (also always includes bundled tasks). Use `--tasks bundled|repo|all` to control scope (default `all`).
- `--current <adapter>`: current/baseline model (required).
- `--candidate <adapter>`: candidate model to compare (repeatable, at least one required).
- `--tasks <bundled|repo|all>`: task suite scope (default `all`).
- `--out-dir <dir>`: output directory (default `./llm-migration-report`).
- `--json`: print report JSON to stdout.
- `--pricing <file.json>`: cloud token pricing `{ "input_per_million": n, "output_per_million": n }`.
- `--monthly-requests <n>`: assumed requests/month for projected savings (default `100000`).
- `--avg-tokens-in <n>` / `--avg-tokens-out <n>`: fallback token assumptions for projection when using non-metered responses.
- `--fail-on-no-go`: exit 1 if any candidate is marked do not migrate.

### Output

- `report.json`: machine-readable comparison (per-model pass rate, average cost, average latency, tool-call accuracy, per-task results, go/no-go, cost-vs-quality tradeoff).
- `report.html`: readable comparison report with evidence for every task.

## Acceptance criteria mapping

1. **Bundled 10-task suite vs two models:** `--current` and `--candidate` run every bundled task and report per-model pass rate, average cost, and latency.
2. **Regression flagged "do not migrate":** if a candidate fails a task due to incorrect tool call (or other checker failure), the report marks it `do_not_migrate` with the specific task and failure evidence.
3. **Cheaper but lower quality tradeoff:** when a candidate is cheaper with lower pass rate, the report shows projected monthly savings vs quality delta and a `consider`/`do_not_migrate` recommendation.

## Smoke check

Runs fully offline using bundled fixtures and mock adapters:

```bash
npm test
# or
node tests/smoke.js
```

## Notes

- Task extraction from repo tests is heuristic (lightweight prompt/checks derived from test names and excerpts) so it works offline without executing untrusted suites.
- Token costs are estimates; supply `--pricing` to match your provider.
- Tool-call accuracy is measured when task checkers specify an expected tool and model responses include `tool_call`.
- No paid APIs are required by this tool; network adapters are opt-in.

## License

MIT (see [LICENSE](LICENSE)).

---
Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/