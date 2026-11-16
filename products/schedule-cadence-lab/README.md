# Schedule Cadence Lab

A browser-only cron schedule editor that turns a 5-field cron expression into a plain-English description, the next N run times, and a per-field breakdown — with a quick-reference examples gallery, a tips/reference drawer, and field-specific validation.

Runs fully offline with no backend and no network calls after the static bundle loads.

## Features

- **Live parsing** — Type a 5-field cron expression and see the description and next runs update instantly (150 ms debounce).
- **Plain-English description** — One sentence that distinguishes every-minute, hourly, daily, weekly, monthly, yearly patterns, plus union behavior when both day-of-month and day-of-week are restricted.
- **Next run previews** — Configurable count (1, 5, 10), each shown as a friendly absolute timestamp with a relative hint, in your local time zone.
- **Field breakdown** — Expandable table showing parsed values and descriptions for minute, hour, day-of-month, month, and day-of-week.
- **Examples gallery** — 12+ common expressions with one-click loading.
- **Reference & tips** — Per-field allowed values, special characters, and 4+ cron gotchas (day-of-month/week union, timezone labeling, unsupported seconds/years, @-macros).
- **Validation** — Field-specific inline errors for out-of-range, reversed ranges, bad steps, and unknown names.
- **Persistence** — Last expression saved in URL hash (shareable) and localStorage fallback.
- **Copy to clipboard** — One-click copy for expression and description.
- **Responsive** — Works on mobile and desktop.
- **Offline-first** — No network calls after load; all logic runs in the browser.

## Supported grammar

- `*` — any value
- `a,b,c` — list
- `a-b` — range
- `*/n` and `a-b/n` — step
- Month names: `JAN`–`DEC` (case-insensitive, 3-letter)
- Day-of-week names: `SUN`–`SAT` (case-insensitive, 3-letter), with `7` normalized to Sunday
- Field bounds: minute 0–59, hour 0–23, day-of-month 1–31, month 1–12, day-of-week 0–7

## Run locally

```bash
cd products/schedule-cadence-lab
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build (static site)

```bash
cd products/schedule-cadence-lab
npm run build
```

Output in `products/schedule-cadence-lab/dist/` — deployable to any static host (GitHub Pages, Netlify, Vercel, etc.).

## Checks

```bash
cd products/schedule-cadence-lab
npm run typecheck  # TypeScript strict check
npm test           # Core acceptance tests (A1–A5, B1–B5, C1–C3, D1–D4, fixtures)
```

## Acceptance checks

| ID | Input | Expected |
|---|---|---|
| A1 | `* * * * *` | description contains "every minute" |
| A2 | `0 2 * * *` | description conveys "at 02:00 every day" |
| A3 | `*/15 * * * *` | description conveys "every 15 minutes" |
| A4 | `0 9 * * 1-5` | description conveys weekdays at 09:00 |
| A5 | `bogus` | error shown, no run times |
| B1 | `* * * * *`, now=2026-11-16T12:00:30 | first run = 2026-11-16T12:01:00 |
| B2 | `0 2 * * *`, now=2026-11-16T01:00:00 | first run = 2026-11-16T02:00:00 |
| B3 | `0 0 1 * *`, now=2026-11-16 | first run = 2026-12-01T00:00:00 |
| B4 | `0 0 29 2 *`, now=2026-03-01 | first run = 2028-02-29T00:00:00 |
| B5 | N=3 vs N=5 | exactly 3 timestamps in ascending order |
| C1 | gallery | ≥12 examples, each with description |
| C2 | "every 5 minutes" click | loads `*/5 * * * *`, refreshes |
| C3 | all examples | valid, non-empty description |
| D1 | `60 * * * *` | minute field error (out of range) |
| D2 | `5-1 * * * *` | minute field error (reversed range) |
| D3 | `*/0 * * * *` | minute field error (invalid step) |
| D4 | fix invalid → valid | error clears, runs reappear |
| E1 | after load | no network requests |
| E2 | narrow viewport | editor, description, runs, examples usable |

## Fixtures

Required fixtures in `fixtures/cron-fixtures.json`:

**Valid:**
- `* * * * *`, `*/5 * * * *`, `0 * * * *`, `0 2 * * *`, `0 9 * * 1-5`
- `0 0 1 * *`, `0 0 29 2 *`, `30 4 1,15 * *`, `0 0 * * 7`, `15 10 * JAN MON`

**Invalid:**
- `60 * * * *`, `5-1 * * * *`, `*/0 * * * *`, `* * * *` (wrong count), `* * * * FUNDAY` (unknown name)

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/

## License

MIT — see [LICENSE](LICENSE).