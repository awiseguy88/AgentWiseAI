# Claude Code guardrail snippet (starter)

Use a local pre-completion checklist/hook to prevent unbacked "done" claims.

## Policy
- Before saying tests pass, build succeeded, or fixed/done, run the relevant command in the current turn and show its exit code/output.
- If a command failed earlier, do not claim success until a later command exits 0 for the same check.
- If claiming a build is fixed, include a fresh rebuild command result (not a stale green run).
- When no command evidence exists, report status as "unverified" and list the exact command needed.

## Suggested prompt/checklist
1. State the claim (tests/build/fix).
2. Run: `<test-or-build-command>`
3. Confirm: `exit code 0` and summarize key output.
4. If exit != 0: report failure, do not claim done.

## Example evidence block
- Claim: "Tests pass"
- Command: `npm test`
- Result: exit code 0 (12 passed, 0 failed)
