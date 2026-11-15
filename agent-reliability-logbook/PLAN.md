# Agent Reliability Logbook — Build Plan

## Goal
Build a small, self-contained, offline-first local web app for tracking AI agent run reliability. It lets small teams log or import run records and view KPIs and trends without accounts or paid services.

## User-facing behavior
- **Log/add/edit runs:** Users can create, edit, and delete run records with task, outcome (success/failure/partial), duration, retries, human override, error type, confidence, notes, and date.
- **Import:** Load run records from a local JSON or CSV file.
- **Sample data:** Load bundled sample logs to explore dashboards quickly.
- **Dashboards:** View computed KPIs — total runs, completion rate, intervention rate, average duration — plus recurring failure categories and weekly reliability trends (completion and intervention rates).
- **Persistence:** Runs are stored in browser `localStorage` on the same origin.
- **Export:** Download current records as JSON or CSV.
- **Offline/local:** Runs as static HTML/CSS/JS; no backend, accounts, or paid services.

## Files
- `index.html` — UI structure: data actions, KPI cards, charts, add/edit form, run table.
- `styles.css` — Layout and visual styling for panels, charts, table, and responsive behavior.
- `app.js` — Browser app logic: form handling, rendering, localStorage persistence, import/export, sample loading.
- `metrics.mjs` — Pure/shared logic for normalization, KPI summary, weekly trends, CSV parsing/serialization.
- `sample-runs.json` — Sample run log in JSON format.
- `sample-runs.csv` — Sample run log in CSV format.
- `README.md` — Usage, local run instructions, and smoke-check command.
- `test/smoke.mjs` — Node-based smoke check for core logic.
- `screenshots/before-empty.png`, `screenshots/after-sample.png`, `screenshots/after-dashboard.png` — UI evidence captures.

## Modules
- **Metrics/parsing module (`metrics.mjs`):** Exports `normalizeRun`, `computeSummary`, `weeklyTrends`, `parseCSV`, `toCSV`, and helpers. Shared by browser UI and Node smoke check to keep calculations consistent and testable.
- **UI/persistence module (`app.js`):** Handles DOM events, state in memory + `localStorage`, file import/export, and dashboard/table rendering.
- **Presentation (`index.html`, `styles.css`):** Static markup and styles; charts rendered as simple HTML bars and SVG polylines without external dependencies.

## Test strategy
- **Automated smoke check (`node test/smoke.mjs`):** Validates core calculations and data handling using the bundled sample data:
  - KPI summary (totals, completion/intervention rates, average duration, recurring failure categories)
  - Weekly trend bucketing and rate bounds
  - CSV parsing of sample file and expected field normalization
  - CSV serialization/parse round-trip
- **Manual/UI verification:** Load `index.html` (or serve locally), use **Load sample log**, confirm KPIs/charts/table update, add/edit/delete a run, verify persistence after refresh, and verify JSON/CSV export/import.

## Acceptance checks
- [x] Users can load a sample run log and see computed KPI summaries and trend charts.
- [x] Users can add/edit entries locally; data persists in browser storage.
- [x] Users can import and export run records as JSON/CSV.
- [x] Completion rate, intervention rate, recurring failure categories, and weekly reliability trends are displayed.
- [x] No accounts or paid services; app runs offline as static files in its own subfolder.
- [x] README and smoke check included; `node test/smoke.mjs` passes.
- [x] Independent of other tools/workspaces; harness and unrelated workspaces unchanged.
