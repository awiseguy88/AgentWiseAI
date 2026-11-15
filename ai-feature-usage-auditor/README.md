# AI Feature Usage Auditor

A small, self-contained, offline-first local web app for auditing SaaS "AI tax" spend. Log the AI features you pay for, track which ones you actually use, and generate evidence for renewal negotiations.

## Features
- Log SaaS tools with AI premium (per term), billing term, renewal date, and AI features.
- Mark each AI feature as **Used** or **Unused** and record usage frequency.
- Paid-vs-used report: tools logged, total AI premium, features paid for/used/unused, and estimated unused AI spend.
- Negotiation talking points generated from your actual usage and renewal dates.
- **Export CSV** report and **Export PDF report** (browser print) — all offline.
- Data stored locally in browser `localStorage` (no accounts, no paid APIs, no network requests).

## Run locally
1. Open `ai-feature-usage-auditor/index.html` in a modern web browser (double-click or serve the folder with any static file server).
2. Add tools and features, adjust usage/frequency, review the report, and export CSV/PDF as needed.

Because data is stored in browser storage, it stays on the same browser/profile on the same machine.

## Smoke check
Requires Node.js (for the offline logic/file check script):

```bash
node ai-feature-usage-auditor/smoke-check.mjs
```

The smoke check verifies required files/markers and validates core report/export logic using sample data matching the acceptance scenario.

## Notes
- Estimated unused AI spend is calculated by allocating a tool's AI premium evenly across its listed AI features.
- PDF export uses the browser print dialog; choose "Save as PDF" for a PDF file.
- This tool is independent and does not modify other workspaces.
