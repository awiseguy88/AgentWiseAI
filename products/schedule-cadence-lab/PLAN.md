# Schedule Cadence Lab — Plan

## Goal
Build a complete, original, browser-only cron schedule editor in `products/schedule-cadence-lab/` that turns a 5-field cron expression into a plain-English description, next N run times, and a per-field breakdown, with an examples gallery, tips/reference drawer, and field-specific validation. Runs fully offline with no backend and no network calls after the static bundle loads.

## Users
- Developers, operators, and AI/automation builders who need to author, understand, or debug standard 5-field cron schedules.
- Anyone who wants quick human-readable explanations and upcoming run previews without installing tools or sending data to a server.

## Milestones
1. **Core (this ticket):** PLAN.md, pure parser/normalizer, describer, next-run calculator, fixtures, and unit tests covering all acceptance checks (A1–A5, B1–B5, C3, D1–D4).
2. **UI:** Responsive editor, live parsing/description, per-field breakdown, next-run list with configurable N (1/5/10) and timezone label, copy-to-clipboard, persistence (URL hash/localStorage), validation states.
3. **Reference & polish:** Examples gallery (>=12) with click-to-load, reference/tips sections, offline behavior, README, root README entry, CI integration.

All milestones delivered end-to-end in this implementation.

## Files
- `PLAN.md` — this plan.
- `LICENSE` — MIT.
- `package.json` — app/package metadata, scripts, homepage `https://aaronwiseai.com/`.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` — build config.
- `index.html` — Vite entry.
- `src/cron/types.ts` — shared types.
- `src/cron/parser.ts` — pure 5-field parser/validator/normalizer (R-IN, R-GR).
- `src/cron/describe.ts` — plain-English description (R-DS).
- `src/cron/nextRuns.ts` — next N run calculation (R-NX).
- `src/cron/examples.ts` — gallery/reference/tips data (R-EX).
- `src/cron/index.ts` — exports.
- `src/App.tsx`, `src/main.tsx`, `src/styles.css` — UI (R-IN-2/4, R-VA, R-OF, R-NX-2/3/4).
- `src/components/*` — editor, breakdown, runs, examples, reference panels.
- `fixtures/cron-fixtures.json` — required fixtures.
- `test/core.test.mjs` — Node-based acceptance/unit tests against built core modules.
- `README.md` — usage, About AaronWiseAI, required line/footer.

## Test strategy
- Implement cron core as pure TypeScript functions compiled to `dist-core/` for Node tests.
- `test/core.test.mjs` (run via `node --test`) imports compiled core and asserts all acceptance checks: A1–A5 descriptions/invalid states, B1–B5 next-run calculations with fixed `now`, D1–D4 field-specific errors and recovery, fixture validity/invalidity, and example-gallery invariants (C1/C3 data-level; C2 exercised via exported example data/load logic).
- `npm test` builds core and runs tests; `npm run build` typechecks and builds the web app.
- Manual smoke: `npm run dev` to verify UI/persistence/copy/responsive/offline behavior.

## Acceptance checks
- A1 `* * * * *` → description contains "every minute".
- A2 `0 2 * * *` → description conveys "at 02:00 every day".
- A3 `*/15 * * * *` → description conveys "every 15 minutes".
- A4 `0 9 * * 1-5` → description conveys weekdays at 09:00.
- A5 `bogus` → error shown and no run times rendered.
- B1 `* * * * *`, now=2026-11-16T12:00:30 → first next run = 2026-11-16T12:01:00.
- B2 `0 2 * * *`, now=2026-11-16T01:00:00 → first next run = 2026-11-16T02:00:00.
- B3 `0 0 1 * *`, now=2026-11-16 → first next run = 2026-12-01T00:00:00.
- B4 `0 0 29 2 *`, now=2026-03-01 → first next run = 2028-02-29T00:00:00.
- B5 Changing N from 5 to 3 yields exactly 3 timestamps in ascending order.
- C1 Gallery lists ≥12 examples, each with a description.
- C2 Clicking "every 5 minutes" populates `*/5 * * * *` and refreshes description + next runs.
- C3 Every example's loaded expression is valid and produces a non-empty description.
- D1 `60 * * * *` → error naming the minute field (out of range).
- D2 `5-1 * * * *` → error naming the minute field (reversed range).
- D3 `*/0 * * * *` → error naming the minute field (invalid step).
- D4 After fixing the input to a valid expression, the error clears and run times reappear.
- E1 No network requests after the static bundle loads.
- E2 Narrow viewport keeps editor, description, runs, and examples usable.

## Notes
- 5 standard fields only; day-of-week 0 and 7 normalized to Sunday.
- Next runs computed in local time by default with clearly labeled timezone; deterministic across boundaries/DST/leap days per documented behavior.
- When both day-of-month and day-of-week are restricted, description notes union/intersection behavior (standard cron OR semantics).
