# Generic local agent CLI guardrail snippet (starter)

## Guardrail
A completion claim is verified only when matched to a nearby successful command result.

## Require
- Evidence: command + exit code (0) + relevant output excerpt.
- Freshness: run after the latest change; no stale green.
- Rebuild: build claims need an actual rebuild/compile command.
- Failure handling: if exit != 0, report "not done" and include the failing result.

## Unverified labels
Mark claims unverified when: no command result, failing exit before claim, stale green, or no rebuild evidence.
