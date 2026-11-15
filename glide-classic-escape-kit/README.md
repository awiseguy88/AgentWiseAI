# Glide Classic Escape Kit

A small offline-first CLI for operations leads and no-code builders leaving Glide Classic. It ingests exported Glide/Sheet CSVs and a simple YAML/JSON app-notes file, then produces a rebuild inventory and planning artifacts — without external services — so teams can plan screens, logic, data, and rough costs before rebuilding.

## What it does

- **Rebuild inventory (verified from data):** tables, columns, inferred types, name-based relation hints, and missing/mostly-empty columns from your CSV exports.
- **User/role checklist:** starter template populated from app notes when provided.
- **Screen-and-logic checklist template:** combines detected tables with user-supplied screen/logic notes and clearly separates **verified data findings** from **user-supplied logic notes**.
- **Rough cost-comparison worksheet:** Glide Classic vs GlideOS vs generic rebuild effort categories, prefilled from cost assumptions in notes when provided (rough planning estimates).

Outputs (in the chosen output directory):
- `report.html` — single-file, offline HTML report
- `inventory.json` — machine-readable inventory
- `checklist.md` — screen-and-logic and user/role checklist
- `cost-worksheet.csv` — rough cost-comparison worksheet

## Requirements

- Node.js (no npm dependencies; uses built-in modules only)

## Usage

```bash
cd glide-classic-escape-kit
node src/cli.js --csv samples/tasks.csv --csv samples/users.csv --notes samples/app-notes.json --out ./glide-escape-report
```

You can also pass CSV paths positionally:

```bash
node src/cli.js samples/tasks.csv samples/users.csv --notes samples/app-notes.yaml --out ./glide-escape-report
```

Options:
- `--csv <file>` — CSV export to ingest (repeatable)
- `--notes <file>` — app notes file (`.json` or simple `.yaml`/`.yml`)
- `--out <dir>` — output directory (default `./glide-escape-report`)
- `--name <text>` — app name for the report header
- `-h, --help` — show help

If `--notes` is omitted, the tool still generates the report and starter templates from the CSVs alone.

## App notes format

Provide screens, logic/workflows, roles, and rough cost assumptions as JSON or a simple YAML subset. See [`samples/app-notes.json`](samples/app-notes.json) and [`samples/app-notes.yaml`](samples/app-notes.yaml).

```json
{
  "appName": "My App",
  "screens": [{"name": "Dashboard", "notes": "..."}],
  "logic": [{"name": "Visibility", "notes": "..."}],
  "roles": [{"name": "Admin", "notes": "..."}],
  "cost": { "currency": "USD", "assumptions": "...", "classicMonthly": 60 }
}
```

## Verified vs user-supplied

- **Verified data findings** are derived from the CSV exports (tables, columns, types, empty/missing values, relation hints). Hints are heuristic — confirm manually.
- **User-supplied logic notes** come from your app-notes file and are included for planning; confirm against the actual app.
- The report labels each section so planning does not confuse inferred data with app logic.

## Smoke check

```bash
npm test
```

Runs `node test/smoke.js`, which generates reports from sample CSVs/notes (and CSV-only) and verifies outputs and key sections.

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).
Practical, useful software that saves time.

Part of the AaronWiseAI tool collection — https://aaronwiseai.com/
