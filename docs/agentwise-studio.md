# AgentWise Studio

The first full AgentWiseAI product: an open-source app for inspecting agent runs.

## Workflow

1. Import an agent transcript.
2. See which completion claims have evidence and which are unverified.
3. Inspect slow or repeated steps.
4. Save the run locally.
5. Reopen the app and compare it with a previous run.

## Reuse

- `agent-done-claim-verifier` — claim parsing and evidence checks
- `agent-drift-monitor` — step timing and repeated-step analysis
- `agent-reliability-logbook` — run history and storage patterns
- `tool-launcher` — launch and tool discovery patterns

## Milestones

1. Verifier regression and evidence schema: check ID, commit SHA, platform.
2. Electron Forge desktop shell with SQLite-backed run history.
3. Release pipeline for Windows x64, Linux x64, and macOS arm64/x64.
4. Run comparison and report export.

## Release gates

- Source checks run on every PR.
- Candidate packages are built from a release tag.
- Packaged apps are launched with a fresh user-data directory.
- A draft release is created only after every required package passes.
- Checksums, release notes, and build provenance are attached.
- Signing credentials live only in the release workflow.

## Workflow rules

- One active implementation task per repository.
- Implementation and verification run in separate sessions.
- The scheduler records task, attempt, branch, PR, and verified commit.
- Evidence for a release must match the exact commit being tagged.
- GitHub Actions decides when the project is ready to ship.
