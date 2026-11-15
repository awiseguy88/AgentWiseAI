# Aider workflow guardrail snippet (starter)

Configure or follow a local routine that runs checks before completion summaries.

## Suggested routine
- After edits: run lint/tests/build commands relevant to the change.
- Capture command and exit status in the transcript/session notes.
- Only summarize as done/fixed when the latest relevant check exits 0.

## Example commands (adapt locally)
- `npm test`
- `npm run build`
- `pytest -q`

## Rule
Never report "all tests pass" or "build succeeded" without fresh command output showing success.
