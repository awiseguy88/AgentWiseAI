# agent-browser-isolation-runtime — PLAN

## Users
- Developers running multiple coding agents (Claude Code, Cursor, Codex) against real sites with real logins.
- Agent builders who need deterministic, isolated browser sessions exposed over MCP.
- Test/CI engineers who need a reproducible multi-session browser harness without shared cookie state.

## Problem
Two failures dominate agent-driven browsing:
1. Agents share one browser, so two jobs land in the same account (cookie/tab cross-contamination).
2. Sites detect headless/automated Chromium before the agent acts.

Hand-building one profile per job is brittle and single-machine.

## Complete first release (what "done" means for v1)
A local Node runtime that:
- Launches **N isolated profiles**, each with its own `user-data-dir`, cookie jar and storage map.
- Applies a documented **stealth/anti-detection** configuration (UA, viewport, `navigator.webdriver` override, automation flags).
- Drives pages with **real input via CDP-shaped operations**: navigate / click / type / screenshot / extract.
- Exposes an **MCP stdio server** with those five tools, scoped per profile.
- Persists cookies/storage **per profile** so state survives a restart and never leaks across profiles.
- Ships a **fixture web app** (two accounts, per-account data, bot challenge) and a demo where two concurrent jobs log into two accounts without cross-contamination.

## Acceptance checks (v1)
1. **Fixture isolation** — two concurrent jobs authenticate to two distinct accounts on the fixture app; each job's extracted data belongs to its own account; zero cross-contamination across 100 runs.
2. **Detection** — the fixture site's bot-management challenge does not trigger on an isolated profile under the documented stealth config, or the run fails loudly with a clear error (HTTP 403 visible) rather than silently.
3. **Failure case** — killing one job mid-run leaves the other job and its profile state intact and recoverable on restart.

All three are asserted by `node --test test/smoke.test.js` and `node src/cli.js verify`.

## Design
- `src/profile.js` — `ProfileStore`: per-profile directory, atomic `state.json` (cookies + storage), corruption detection.
- `src/stealth.js` — single documented `STEALTH_CONFIG` and `isStealthy` predicate.
- `src/browser.js` — `BrowserProfile`: CDP-shaped navigate/click/type/screenshot/extract, cookie absorption, persistence on every mutation.
- `src/runner.js` — `JobRunner`: concurrent jobs, kill + recover, per-job profile binding.
- `src/mcp.js` — stdio MCP server with the five tools.
- `src/fixture-site.js` — in-process HTTP fixture app (alice/bob accounts, `/challenge` bot check).
- `src/cli.js` — `serve` (MCP), `demo` (two concurrent logins), `verify` (acceptance report).

## Milestones
1. **M1 (done)** — profile isolation + persistence, stealth config, CDP-shaped session ops, MCP server, fixture app, runner kill/recover, tests + CLI verify, docs.
2. **M2** — optional real-Chromium driver over CDP websocket (`chrome --remote-debugging-port`), profile pool limits, screenshot artifacts to disk.
3. **M3** — per-profile proxy/geolocation overrides, storage export/import, structured audit log of tool calls.

## Non-goals
- Generic consumer/business/e-commerce automation.
- Bypassing authentication or site terms; the runtime isolates legitimate sessions the operator owns.
- A hosted multi-tenant service; v1 is local and single-machine.
