# Codex CLI guardrail snippet (starter)

## Policy for completion claims
- Require command-backed evidence in the same work session: include command, exit code, and concise result.
- "Tests pass" must be backed by a passing test command (exit 0) after the latest relevant code change.
- "Build succeeded" must be backed by a fresh build/compile command (exit 0); do not rely on stale output.
- If any relevant command exits non-zero, the task is not done; report the failure and next fix.

## Verification template
- Claim:
- Evidence command:
- Exit code:
- Relevant output:
- Confidence: verified/unverified
