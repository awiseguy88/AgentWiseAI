# MCP Tool-Call Truth Monitor

Local-first tool (offline HTML/JS + optional CLI) that ingests agent/MCP traces — agent-inspect JSONL and stdio/HTTP proxy captures — and detects when an agent claims a tool call succeeded despite the tool reporting an error, `isError: true`, empty result, or timeout.

It replaces blind trust in resolved MCP calls and post-incident transcript forensics by comparing the tool trace against the agent’s subsequent claims, flagging mismatches before wrong actions reach users.

## What it detects

| Problem result | Meaning |
| --- | --- |
| Returned error / thrown exception | Tool call threw or returned an error response |
| `isError: true` | MCP tool result explicitly marked as error |
| Empty result / missing content | Result has no `content`, empty `text`, or null payload |
| Timeout / no response | Call timed out or no response was captured |

When any of the above is followed by an agent claim that the action succeeded (e.g. “done”, “fixed”, “completed”, “tests pass”, “built successfully”), the call is flagged as a **mismatch**.

## Usage

### CLI

```bash
# From inside this folder
npm install          # devDependencies only (none required; Node 18+)
node src/cli.js <trace-file> [--out-dir DIR] [--json] [--export-fixture PATH]
```

Options:
- `<trace-file>` — path to a trace file (agent-inspect JSONL or MCP capture JSON).
- `--out-dir DIR` — output directory for `report.html` and `report.json` (default: `./truth-report`).
- `--json` — also print JSON report to stdout.
- `--export-fixture PATH` — write a normalized replayable fixture JSON to this path.

Example:

```bash
node src/cli.js fixtures/is-error-mismatch.jsonl --out-dir ./out
# -> Writes out/report.html and out/report.json
```

### Offline HTML viewer

Open `web/index.html` directly in a browser (`file://` works). Drag-and-drop or use the file input to load a `report.json` or raw trace file. The viewer shows:
- **Trace timeline** — ordered tool calls, results, and agent claims.
- **Mismatch table** — all flagged mismatches with tool, step, claim excerpt, result summary, and references.
- **Claim-vs-Result pairs** — side-by-side detail for a selected call.

The generated `report.html` is self-contained and includes the same views with embedded data — no server needed.

## Supported input formats

### Agent-inspect JSONL (newline-delimited JSON)
Each line is an event object. Recognized fields:
- `type`: `"tool_call"` | `"tool_result"` | `"assistant_message"` | `"user_message"` | `"system"` etc.
- `tool_call_id`, `name` (tool name), `arguments`, `result` (for tool_result), `isError`, `error`, `content`.
- `timestamp`, `session_id`, `metadata`.

Example:
```json
{"type":"tool_call","tool_call_id":"call-1","name":"read_file","arguments":{"path":"/tmp/x.txt"}}
{"type":"tool_result","tool_call_id":"call-1","name":"read_file","isError":true,"error":"File not found"}
{"type":"assistant_message","content":"Successfully read the file contents."}
```

### MCP stdio/HTTP capture (JSON)
An array or object of JSON-RPC request/response pairs:
```json
[
  {"direction":"request","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"/tmp/x.txt"}}},
  {"direction":"response","id":1,"result":{"isError":true,"content":[{"type":"text","text":"File not found"}]}}
]
```

## Output

### JSON report (`report.json`)
```json
{
  "timestamp": "2026-11-16T...",
  "traceFile": "fixtures/is-error-mismatch.jsonl",
  "summary": { "totalCalls": 3, "mismatches": 1, "cleanMatches": 2 },
  "mismatches": [
    {
      "tool": "read_file",
      "step": 2,
      "callId": "call-1",
      "result": { "type": "isError", "summary": "isError: true — File not found" },
      "claim": { "index": 3, "excerpt": "Successfully read the file contents.", "type": "done" },
      "references": { "callLine": 1, "resultLine": 2, "claimLine": 3 }
    }
  ],
  "timeline": [ ... ],
  "pairs": [ ... ]
}
```

### HTML report (`report.html`)
Self-contained single file with the three views (timeline, mismatch table, claim-vs-result) and embedded data.

### Replayable fixture (`--export-fixture`)
Normalized trace JSON that can be re-analyzed to produce identical results.

## Smoke check / tests

```bash
npm test
```

Runs the acceptance case (`isError: true` → success claim) and the clean-trace negative case, verifying:
- Mismatch is detected with correct tool/step/claim references.
- HTML and JSON reports are generated.
- Clean trace yields zero mismatches.
- Fixture export round-trips correctly.

## Files

- `src/cli.js` — CLI entrypoint.
- `src/parser.js` — trace format detection & normalization.
- `src/analyzer.js` — call/result pairing, claim detection, mismatch logic.
- `src/report.js` — JSON + self-contained HTML report rendering.
- `src/index.js` — library exports for tests.
- `web/index.html` — standalone offline viewer.
- `fixtures/is-error-mismatch.jsonl` — acceptance sample.
- `fixtures/clean-trace.jsonl` — clean trace sample.
- `fixtures/mcp-capture.json` — MCP capture format sample.
- `tests/smoke.test.js` — offline test suite.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/