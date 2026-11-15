# PLAN — Glide Classic Escape Kit

## Goal
Build a small, self-contained, offline-first tool that helps small teams inventory a Glide Classic app from exported CSVs and app notes, producing a rebuild-planning report and checklists without external services.

## User-facing behavior
- **CLI** (`node src/cli.js ...` or `npx`-less bin) ingests:
  - one or more exported Glide/Sheet CSV files (each treated as a table),
  - a simple YAML or JSON app-notes file describing screens/logic/roles/cost assumptions (user-supplied, optional sections).
- Generates outputs in a chosen output directory (default `./glide-escape-report`):
  - `report.html` — single-file, offline HTML report with:
    - **Rebuild inventory (verified from data):** tables, columns, inferred types, relation hints (e.g. columns named `*Id`, `*Ref`, `Relation`, matching other table names), missing/empty columns.
    - **User/role checklist:** template populated from notes when provided, otherwise a starter checklist (clearly labeled).
    - **Screen-and-logic checklist template:** structured checklist combining detected tables with user-supplied screens/logic notes; separates verified data findings from user-supplied logic notes.
    - **Rough cost-comparison worksheet:** side-by-side categories (Glide Classic, GlideOS, generic rebuild effort) with editable-ish/static worksheet rows and rough estimate fields prefilled from notes assumptions; clearly marked as rough planning estimates.
  - `inventory.json` — machine-readable inventory for reuse.
  - `checklist.md` — screen-and-logic/user-role checklist in Markdown.
  - `cost-worksheet.csv` — rough cost-comparison worksheet.
- Works fully offline (Node.js built-ins only). Clearly labels verified data findings vs user-supplied notes.

## Files and modules
- `PLAN.md` — this plan.
- `README.md` — usage, behavior, branding, and footer.
- `package.json` — metadata, bin, scripts (`test`/`smoke`), `homepage`.
- `src/cli.js` — argument parsing, orchestration, file I/O.
- `src/csv.js` — minimal CSV parser (quoted fields, commas/newlines) and table loader.
- `src/analyze.js` — column type inference, empty/missing stats, relation hints.
- `src/notes.js` — parse simple YAML subset or JSON app-notes; normalize structure.
- `src/report.js` — build HTML report, Markdown checklist, cost worksheet CSV/HTML section; render template.
- `samples/` — sample CSV exports and sample `app-notes.json`/`.yaml` for demo and smoke test.
- `test/smoke.js` — smoke check: run CLI against samples, assert outputs exist and contain key sections/verified-vs-notes separation.
- `docs/` — reserved (optional notes).

## Test strategy
- **Smoke check (`node test/smoke.js`):**
  1. Run CLI on sample CSVs + notes into a temp output dir.
  2. Verify `report.html`, `inventory.json`, `checklist.md`, `cost-worksheet.csv` are created.
  3. Assert report contains rebuild inventory elements (table/column names), relation hints, empty-column findings, and explicit labels separating verified data findings from user-supplied logic notes.
  4. Assert checklist and cost worksheet include expected sections/rows.
  5. Run CLI with CSVs only (no notes) to confirm templates still generated.
- Keep tests dependency-free and fast.

## Acceptance checks
- [ ] Tool lives in its own `glide-classic-escape-kit/` subfolder and is independent of other tools.
- [ ] `node src/cli.js --help` documents usage.
- [ ] Given sample CSV exports and notes, generates readable offline `report.html` plus checklist/cost files with no external services.
- [ ] Report clearly separates verified data findings from user-supplied logic notes.
- [ ] Includes rebuild inventory (tables/columns/types, relation hints, missing/empty columns, user/role checklist), screen-and-logic checklist template, and rough cost-comparison worksheet.
- [ ] README identifies tool/user value, has `## About AaronWiseAI` with https://aaronwiseai.com/, and ends with required footer; `package.json` sets homepage.
- [ ] Smoke check passes (`npm test`).
- [ ] Repository root README table updated with this tool entry (on completion).

## Notes
- No external services or network calls.
- YAML parsing will support a simple, common subset sufficient for app-notes (key/value, lists, nested maps) implemented with built-ins to avoid dependencies; JSON fully supported.
- Relation hints are heuristic and labeled as hints.
