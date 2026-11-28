# Agent Browser Isolation Runtime

A local Node.js runtime for running multiple coding agents against real sites with **fully isolated browser profiles**. Each job gets its own `user-data-dir`, cookie jar and storage, a documented stealth/anti-detection configuration, and real input via CDP-shaped operations. An MCP stdio server exposes `navigate`, `click`, `type`, `screenshot` and `extract` per profile.

## Problem

Developers running coding agents (Claude Code, Cursor, Codex) against real sites hit two failures:

1. **Shared state** — jobs share one browser, so one job lands in another account's session.
2. **Detection** — sites detect headless/Playwright Chromium before the agent clicks anything.

Hand-building one Safari/Chromium profile per job is brittle and single-machine. This runtime makes isolation and stealth first-class.

## Who it helps

Agent builders and developers who need deterministic multi-session browsing, and test engineers who want a reproducible two-account login harness without cookie contamination.

## Features (MVP)

- **N isolated profiles**, each with its own Chromium `user-data-dir` and `state.json`.
- **Documented stealth config**: realistic UA, viewport, `navigator.webdriver` override, `--disable-blink-features=AutomationControlled`, real-input flag.
- **CDP-shaped session API**: `navigate`, `click`, `type`, `screenshot`, `extract`.
- **MCP stdio server** exposing those five tools, scoped by `profile`.
- **Per-profile persistence** of cookies and storage; state survives restarts and never leaks across profiles.
- **Kill/recover**: a killed job leaves other jobs and their profile state intact and recoverable.
- **Fixture web app** with two accounts (`alice`, `bob`) and a bot-management challenge for offline verification.

## Install

```bash
cd agent-browser-isolation-runtime
npm install
```

## Quick start

### Run the MCP server (stdio)

```bash
npm start
# or
node src/cli.js serve --profile-root ./.profiles
```

The server speaks newline-delimited JSON-RPC (MCP `initialize`, `tools/list`, `tools/call`).

### Run the two-account demo

```bash
node src/cli.js demo
```

Starts the local fixture site and runs two concurrent jobs, each in its own isolated profile, logging into `alice` and `bob`. Prints the outcomes as JSON.

### Verify all acceptance checks

```bash
npm run verify
# or
node src/cli.js verify
```

Runs 100 isolated two-job login rounds (zero cross-contamination), checks the stealth profile passes the bot challenge while a headless profile fails loudly with HTTP 403, and kills one job mid-run to confirm the other and the killed profile's state remain intact and recoverable.

## MCP tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `navigate` | `profile`, `url` | `{ url, status }` |
| `click` | `profile`, `selector`, optional `loginUrl` | `{ selector, status, ok }` |
| `type` | `profile`, `selector`, `text` | `{ selector, typed }` |
| `screenshot` | `profile` | `{ profile, format, base64 }` |
| `extract` | `profile`, `selector` | `{ selector, text }` |

## Isolation model

```text
.profiles/
  alice-profile/
    user-data-dir/      # Chromium profile root, never shared
    state.json          # { cookies, storage }, profile-scoped
  bob-profile/
    user-data-dir/
    state.json
```

`ProfileStore` writes `state.json` atomically (temp file + rename) and detects corruption. `BrowserProfile` reloads only its own state, so a job can never read another profile's cookies.

## Stealth configuration

The single documented config lives in `src/stealth.js`. It sets a real Chrome UA, a 1366×768 viewport, the automation-controlled feature flag, a `navigator.webdriver` init script override, and a real-input flag. The fixture challenge treats any profile missing those signals as a bot and returns HTTP 403, so detection failures are loud, not silent.

## Driver modes

- `fixture` (default) — deterministic in-process driver used by CI; it exercises the same isolation, stealth, persistence and failure paths against the local fixture app with no network or browser binary required.
- `chromium` — reserved for a real Chromium launch over the CDP websocket. The profile/stealth/runner layers are driver-agnostic; wiring a live `chrome --remote-debugging-port` transport is the next milestone (see `PLAN.md`).

## Tests

```bash
npm test
```

`node --test test/smoke.test.js` covers:
1. Profiles keep separate `user-data-dir`s and cookie stores.
2. Two concurrent jobs authenticate to distinct accounts with zero cross-contamination across 100 runs.
3. Stealth config passes the bot challenge; non-stealth fails loudly.
4. Killing one job leaves the other job and the killed profile's state intact and recoverable.
5. The MCP server exposes all five tools and isolates sessions by profile.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## License

MIT.
