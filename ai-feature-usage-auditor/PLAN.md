# AI Feature Usage Auditor — Build Plan

## Goal
Build a small, self-contained, offline-first local web app that helps users audit SaaS AI premiums by comparing paid AI features with actual usage, generating a paid-vs-used report, negotiation talking points, and exportable outputs.

## User-facing behavior
- Users can log SaaS tools with: tool name, AI premium paid per term, billing term, renewal date, and a comma-separated list of AI features.
- For each logged tool/feature, users can mark whether a feature is used and set usage frequency (Daily/Weekly/Monthly/Rarely/Never).
- The app displays a table of tools and features with quick controls to update usage status and remove tools.
- A report section shows: tools logged, total AI premium, features paid for, features used, features unused, and estimated unused AI spend (premium allocated evenly across a tool's AI features).
- The app generates negotiation talking points based on unused features, unused spend, and upcoming renewal dates.
- Users can export a CSV report and export a PDF report (via browser print) containing paid-vs-used details and talking points.
- "Clear all data" removes stored data. All data persists locally in browser `localStorage`; no accounts or network/API calls.

## Files
- `index.html` — app structure, form, tools table container, report/talking-points sections, export controls.
- `styles.css` — layout and visual styling, including print-friendly rules for PDF export.
- `app.js` — application logic (state, storage, rendering, calculations, exports, report generation).
- `README.md` — purpose, how to run locally, features, data/storage notes, and smoke check instructions.
- `smoke-check.mjs` — offline smoke check validating required files/content and core report/export logic.
- `PLAN.md` — this build plan.

## Modules / structure
Single-page static app with plain HTML/CSS/JS (no build step, no external dependencies):
- **Storage/state module (in `app.js`)**: load/save JSON state in `localStorage` under a versioned key; initialize empty state.
- **Tool & feature management**: add/update tools, parse feature lists, toggle used/unused, set frequency, remove tools.
- **Report engine**: compute totals (premium, paid/used/unused features, estimated unused spend), identify unused feature details and upcoming renewals.
- **Negotiation points generator**: produce user-facing talking points from report data.
- **Export**: generate CSV content and trigger download; trigger browser print for PDF report.
- **UI rendering**: render tools table, summary metrics, and talking points from state.

## Test strategy
- Automated smoke check (`node smoke-check.mjs`) run locally/offline:
  - Verify required files exist and contain key UI/feature markers (tool logging, usage controls, renewal date, CSV/PDF export, talking points, localStorage).
  - Validate core logic by loading `app.js` in a Node VM with mocked `document`, `window`, `localStorage`, and confirming: adding sample tools/features, marking unused features, setting renewal date, report totals, negotiation points text, and CSV output include paid-vs-used data.
- Manual spot check by opening `index.html` in a browser if needed (offline).

## Acceptance checks
- [ ] App is self-contained in `ai-feature-usage-auditor/` with README and smoke check; independent of other tools.
- [ ] User can log five tools with their AI features and set renewal dates.
- [ ] User can mark two features as unused across three tools and record usage/frequency.
- [ ] Paid-vs-used feature report shows totals and estimated unused AI spend.
- [ ] Suggested negotiation talking points are generated from the data.
- [ ] CSV export downloads report data showing paid-for vs used AI features and negotiation points.
- [ ] PDF report export works offline (print view) with report content.
- [ ] No accounts, no paid APIs, no network requests; data stored in browser storage.
- [ ] Smoke check passes.
