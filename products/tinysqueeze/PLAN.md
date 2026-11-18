# TinySqueeze — PLAN

## Goal
Rebuild TinySqueeze as a complete, original, browser-only image compression application in `products/tinysqueeze/`. Users select or drag-and-drop JPEG/JPG/PNG images, view per-image original size/dimensions, compress client-side with adjustable quality (1–100, default 80), view compressed size and savings percentage, download compressed images individually or as "Download All" (ZIP), with batch support, per-item quality overrides, remove/clear-all, inline validation errors, limit enforcement (max 50 files, max 25 MB per file), per-item processing state, privacy statement, and reset. Runs fully client-side with no uploads, no accounts, and no network after load.

## Users
- Developers and AI-agent builders who need fast, private image compression without uploading files anywhere.
- Anyone needing a local-only tool to shrink JPEG/PNG images before sharing or archiving.

## Files
- `PLAN.md` — this file: goal, users, files, test strategy, acceptance checks.
- `LICENSE` — MIT license.
- `README.md` — About AaronWiseAI section, features mapped to FR-IDs, install/build/test/demo instructions, fixtures, architecture, footer.
- `package.json` — homepage `https://aaronwiseai.com/`, scripts `dev`/`build`/`preview`/`typecheck`/`test`.
- `index.html` — app entry.
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore` — build/test configuration.
- `src/types.ts` — shared types (image item states, validation errors).
- `src/constants.ts` — limits (max 50 files, 25 MB per file) and default quality 80.
- `src/core/compress.ts` — client-side compression via Canvas `toBlob`/`toDataURL` (FR-003).
- `src/core/format.ts` — byte/percent formatting helpers.
- `src/core/zip.ts` — minimal ZIP writer for "Download All" (FR-013).
- `src/fixtures.ts` — programmatic synthetic fixture generation (no external assets).
- `scripts/generate-fixtures.mjs` — generates binary fixtures into `fixtures/`.
- `src/main.ts` — app bootstrap and UI (file picker + drag/drop, quality controls, item list, downloads, errors).
- `src/styles.css` — vanilla CSS layout.
- `tests/*.test.ts` — vitest tests: validation, compression math, limits, error isolation, quality bounds.
- `fixtures/` — generated: `sample-photo.jpg` (800×600), `sample-graphic.png` (400×300), `sample-small.jpg`, `not-an-image.txt`, `corrupt.png`, `expected-sizes.json`.

## Test strategy
- Unit tests with vitest (Node environment, no GPU canvas required): validation (unsupported type, empty selection, corrupt input), limit enforcement (50 files, 25 MB), quality bounds clamping (1–100), savings % formula `(1 - compressed/original) * 100`, filename generation, download-all ZIP integrity, error isolation (corrupt item does not block others).
- Integration-style flow test: load fixtures → set quality 80→30 → verify size change → simulate downloads.
- Fixtures are generated programmatically by `scripts/generate-fixtures.mjs` with deterministic content.
- Manual demo verified in browser: open `products/tinysqueeze/index.html`, drop fixtures, compress, adjust quality, download, error on `not-an-image.txt`, clear all.

## Acceptance checks (AT-01–AT-14)
- AT-01: `fixtures/sample-photo.jpg` loads → thumbnail renders, original dimensions and byte size displayed.
- AT-02: default quality (80) produces compressed output; size and savings % shown; savings % = `(1 - compressed/original) * 100`.
- AT-03: quality 80→30 recompress → compressed size changes and UI updates.
- AT-04: download compressed item → valid decodable image with `-compressed` filename.
- AT-05: upload `not-an-image.txt` → inline "Unsupported file type" error; no crash.
- AT-06: 3 valid images → 3 items listed, each reaches done state.
- AT-07: totals summary reflects all items.
- AT-08: remove one item → remaining items and totals update.
- AT-09: "Download All" with ≥2 items → zip/downloads contain compressed outputs.
- AT-10: 51st file rejected with clear limit error; existing 50 remain.
- AT-11: file >25 MB → inline "File too large" error; no crash/OOM.
- AT-12: `corrupt.png` → inline decode/compress error for that item; others unaffected.
- AT-13: quality bounds clamped to 1–100.
- AT-14: clear all resets list, totals, errors to initial state.

All acceptance checks map to FR-001–FR-015 across P0/P1/P2. CI runs `npm ci`, `npm run typecheck`, `npm run build`, `npm test`.