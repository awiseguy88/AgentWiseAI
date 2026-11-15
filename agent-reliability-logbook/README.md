# Agent Reliability Logbook

Offline-first, local web app for tracking AI agent run reliability without accounts or paid services. It runs as static HTML/CSS/JS and stores data in browser `localStorage`, with JSON/CSV import and export.

## What it tracks

Each run record can include:

- Task
- Outcome (`success`, `failure`, `partial`)
- Duration (seconds)
- Retries
- Human override (yes/no)
- Error type
- Confidence / notes
- Date

## Dashboards

- Completion rate
- Human intervention rate
- Average duration
- Recurring failure categories
- Weekly reliability trends (completion and intervention rates)

## Run locally

Open `index.html` in a browser. For sample data, click **Load sample log** or import `sample-runs.json` / `sample-runs.csv`.

Because the app uses ES modules, some browsers require serving files over HTTP instead of opening from `file://`. If needed, run a simple static server from this folder, for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Data is persisted in browser storage on the same origin. Use **Export JSON** or **Export CSV** to save a portable copy.

## Smoke check / tests

A Node-based smoke check validates KPI calculations, weekly trends, and CSV parsing:

```bash
node test/smoke.mjs
```

Requires Node.js 18+ (for built-in ES modules). No npm install is needed.

## Files

- `index.html` – UI
- `app.js` – browser logic, persistence, import/export
- `metrics.mjs` – pure metric and parsing logic (shared by app and smoke check)
- `styles.css` – styling
- `sample-runs.json`, `sample-runs.csv` – sample logs
- `test/smoke.mjs` – smoke check
