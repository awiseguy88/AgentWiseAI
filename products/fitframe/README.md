# FitFrame

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

FitFrame is a complete, browser-based bulk image resizing and export tool. Drop or select JPG, PNG, WebP, or AVIF images, configure resize, crop, watermark, border, rename, and output settings, then process and export everything locally — no uploads, no server.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## What it does

- **Multi-file input** — drag and drop or pick JPG, PNG, WebP, AVIF (FR-001).
- **Thumbnail grid** — dimensions and file size per image (FR-002).
- **Resize & crop** — target width/height with aspect-ratio lock; contain, cover/crop-to-fill, or custom per-image crop modes (FR-003, FR-004).
- **Focal point** — smart center-bias auto-detect plus manual per-image focal adjustment (FR-005, FR-006).
- **Output format** — original, JPEG, WebP, AVIF with browser capability detection and fallback (FR-007).
- **Quality** — 0–100% slider (FR-008).
- **Watermarks** — text watermark (content, font, size, color, 9-grid position, opacity, angle) and image overlay (FR-010, FR-011).
- **Border** — color and thickness (FR-012).
- **Rename** — batch pattern with `xxx` (sequential) and `ORIGINAL-NAME` placeholders, configurable start number (FR-013).
- **Export** — all as ZIP, individual files, or save-to-folder via the File System Access API with graceful fallback (FR-014, FR-015, FR-016).
- **Persistence** — settings auto-save to localStorage and restore on reload (FR-017).
- **Progress** — per-image and overall batch processing indicators (FR-020).
- **Error isolation** — corrupt or unsupported files are skipped with user-visible errors; the batch continues (FR-021).
- **AI hooks** — optional background removal and 2x/3x/4x super-resolution upscale, lazy-loaded and degrading gracefully when unavailable (FR-018, FR-019).
- **Responsive** — desktop-first layout, usable on tablet (FR-023).
- **Keyboard shortcuts** — Ctrl/Cmd+O to open files, Esc to clear selection (FR-022).
- **Privacy** — "files never leave your device" (FR-024).

## Install & run

```bash
cd products/fitframe
npm install
npm run dev
```

Open [http://localhost:5176](http://localhost:5176) in your browser.

## Build (static `dist/`)

```bash
cd products/fitframe
npm run build
```

Produces a fully static, deployable `dist/` folder.

## Tests

```bash
cd products/fitframe
npm test
```

Tests cover resize/crop/focal math, rename pattern logic, watermark placement math, and an integration-style flow (load synthetic fixtures → configure → process → export) with corrupt-file error isolation.

## Fixture & demo instructions

Fixtures are generated programmatically — no external assets. Run **Load demo fixtures** in the UI to load three synthetic images:

- 1200×800 gradient PNG
- 1000×1000 checkerboard PNG
- 800×600 noise PNG

## Architecture

- `src/types.ts` — shared types and default settings.
- `src/settings.ts` — localStorage persistence (FR-017).
- `src/core/resize.ts` — resize, crop, and focal-point math (FR-003–FR-006, FR-009).
- `src/core/watermark.ts` — text/image watermark and border rendering (FR-010–FR-012).
- `src/core/rename.ts` — batch rename pattern logic (FR-013).
- `src/core/processor.ts` — per-image processing pipeline, format/quality, progress, error isolation (FR-007, FR-008, FR-020, FR-021).
- `src/core/export.ts` — ZIP/individual export and File System Access API save with fallback (FR-014–FR-016).
- `src/core/capabilities.ts` — browser capability detection (FR-007, FR-016).
- `src/core/ai-hooks.ts` — optional local AI hooks with graceful degradation (FR-018, FR-019).
- `src/fixtures.ts` — synthetic fixture generation.
- `src/main.ts` — app bootstrap and UI.
- `src/styles.css` — vanilla CSS, responsive desktop-first layout.

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/