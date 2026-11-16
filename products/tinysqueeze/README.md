# TinySqueeze

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

TinySqueeze is a complete, browser-only image compression tool. Drop or select JPEG/JPG/PNG images, compress them entirely client-side with an adjustable quality slider, view per-image original vs compressed size and savings percentage, and download compressed images individually or as a ZIP — no uploads, no server.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## What it does

- **Multi-file input** — drag and drop or pick JPEG/JPG/PNG images (FR-001).
- **Thumbnail grid** — original filename, dimensions, and original byte size per image (FR-002).
- **Client-side compression** — Canvas `toBlob`/`toDataURL` with adjustable quality (1–100, default 80); JPEG lossy quality, PNG canvas re-encode labeled clearly (FR-003).
- **Savings display** — compressed byte size and savings percentage per image, plus batch totals (FR-004).
- **Download** — compressed image with sensible `-compressed` filename, or "Download All" as a single `.zip` with sequential-download fallback (FR-005, FR-006, FR-013).
- **Per-item quality override** — global quality slider plus per-item override with recompress (FR-007).
- **Before/after comparison** — sizes and optional preview toggle (FR-008).
- **Remove / clear all** — remove single item (others preserved) or clear session (FR-009, FR-015).
- **Inline validation & limits** — unsupported type, corrupt/unreadable image, empty selection, max 50 files, max 25 MB per file — all reported inline without crashes (FR-010, FR-011).
- **Per-item processing state** — queued / compressing / done / error (FR-012).
- **Privacy** — "Images are processed locally in your browser." No uploads, no accounts, no network calls after load (FR-014).

## Install & run

```bash
cd products/tinysqueeze
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5179).

## Build (static `dist/`)

```bash
cd products/tinysqueeze
npm run build
```

Produces a fully static, deployable `dist/` folder (no server-side dependencies).

## Tests

```bash
cd products/tinysqueeze
npm test
```

Tests cover:
- Constants & helpers (supported types, quality clamping, limits).
- Format helpers (byte formatting, percent rounding, savings % math).
- Validation (unsupported type, >25 MB rejection, >50 files, valid JPEG/PNG acceptance).
- Synthetic fixtures (fixture generation, corrupt PNG, non-image text file).

Canvas-dependent compression (JPEG/PNG encode) runs in the browser; Node tests validate logic and error paths.

## Fixture & demo instructions

All fixtures are generated deterministically and committed to `fixtures/` (no external assets). Run the generator to refresh them:

```bash
cd products/tinysqueeze
python3 scripts/generate-fixtures.py   # requires Pillow
```

Fixtures:
- `fixtures/sample-photo.jpg` — 800×600 synthetic JPEG (gradient + noise, deterministic).
- `fixtures/sample-graphic.png` — 400×300 PNG with flat colors and transparency.
- `fixtures/sample-small.jpg` — small 200×150 JPEG for batch tests.
- `fixtures/not-an-image.txt` — plain text for unsupported-type test.
- `fixtures/corrupt.png` — intentionally truncated/invalid PNG bytes.
- `fixtures/expected-sizes.json` — reference metadata (dimensions/sizes) with tolerance notes (assert structural correctness, not exact compressed bytes).

**Five-minute demo**
1. Open `products/tinysqueeze/index.html`.
2. Drop `fixtures/sample-photo.jpg` — see original size/dimensions and compressed result with savings %.
3. Move the quality slider 80→40→90 and observe size changes.
4. Add `fixtures/sample-graphic.png` and `fixtures/sample-small.jpg` — batch totals shown.
5. "Download All" and single download work and files open.
6. Drop `fixtures/not-an-image.txt` → inline error, no crash. Clear all resets.

## Architecture

- `src/types.ts` — shared types (image item states, batch totals, validation errors).
- `src/constants.ts` — limits (max 50 files, 25 MB per file), supported types, default quality 80.
- `src/core/compress.ts` — client-side compression via Canvas `toBlob`/`toDataURL`, batch concurrency control, error isolation (FR-003).
- `src/core/format.ts` — byte/percent formatting and savings % math (FR-004).
- `src/core/zip.ts` — "Download All" as ZIP with sequential fallback (FR-013).
- `src/fixtures.ts` — programmatic synthetic fixture generation for tests/demos.
- `scripts/generate-fixtures.py` — deterministic fixture generator (Pillow) writing to `fixtures/`.
- `src/main.ts` — app bootstrap and UI (file picker + drag/drop, quality controls, item list, downloads, errors).
- `src/styles.css` — vanilla CSS, responsive layout.

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/