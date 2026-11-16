# PLAN — PixTrim Lab

## Goal
Rebuild PixTrim Lab as a complete, original, browser-only application in `products/pixtrim-lab/` meeting the approved functional scope (FR-001–FR-024) and acceptance checks (M1–M6) in issue #69. The app runs fully offline with no network calls after the static bundle loads: image resize, format conversion, per-image crop, batch ZIP export, local persistence, keyboard shortcuts, and shareable settings — all client-side via Canvas API.

## Users
AI agents and developers who need a local, offline-capable image resize and batch-export tool without uploading images anywhere.

## Files
- `PLAN.md` — this plan (goal, users, files, test strategy, acceptance checks, remaining milestones).
- `LICENSE` — MIT license text.
- `README.md` — first heading = tool name, one-sentence who-it-helps, `## About AaronWiseAI` section, footer per BRANDING.md.
- `package.json` — scripts, deps (jszip), `homepage: https://aaronwiseai.com/`.
- `index.html` — app shell + inline dropzone/grid/toolbar markup, no network assets.
- `src/index.ts` — app entry, DOM wiring, event delegation.
- `src/engine/settings.ts` — global settings + localStorage persistence + defaults.
- `src/engine/formats.ts` — output format set, AVIF gating via `createImageBitmap`/`canvas.toBlob` mime probe.
- `src/engine/image-loader.ts` — File input/drag-drop accept, EXIF orientation read & auto-rotate, canvas rasterization of images and SVG→canvas at target size.
- `src/engine/resize.ts` — resize modes Exact / Contain / Cover / Percentage on canvas.
- `src/engine/filename.ts` — pattern engine: `pixtrim_xxx`, `original_resized`, `custom_{name}`, original; zero-padded 3-digit index.
- `src/engine/export.ts` — individual file downloads and JSZip batch ZIP export with progress.
- `src/engine/crop.ts` — per-image crop override (drag-handle modal) merged into export.
- `src/engine/share.ts` — URL hash encode/decode of current settings.
- `src/ui/shell.ts` — responsive shell layout, dark/light theme toggle, privacy statement.
- `src/ui/grid.ts` — thumbnail grid with metadata + live preview at debounce 150ms.
- `src/ui/modal.ts` — crop modal + error-warning inline rendering.
- `src/ui/shortcuts.ts` — Esc close modals, Ctrl/Cmd+S export ZIP.
- `tests/fixtures.mts` — programmatic synthetic fixture generator (gradient/checkerboard/noise/portrait JPEG/landscape WebP).
- `tests/*.test.ts` — vitest tests for resize engine, formats, filename engine, image loader, EXIF, export (zip), shortcuts, persistence, share hash, offline/no-network guarantee.
- `fixtures/` — generated fixtures committed for demo reproducibility (programmatically generated).
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` — TypeScript + Vite build + vitest config.
- `.gitignore` — excludes dist/, node_modules/.

## Test strategy
- vitest in `node` environment with jsdom-ish canvas via offscreen `canvas` (vitest runs in Node; use a lightweight canvas mock where needed, or test pure functions that take an `HTMLCanvasElement`-like object).
- Each test imports only pure/engine modules — no DOM, no network.
- Fixture generation: all fixtures generated programmatically on first test run (deterministic seeded noise/gradients).
- CI: `npm ci` → `npm run build` (tsc --noEmit + vite build → static `dist/`) → `npm test` (vitest run). Green on ubuntu/windows/macOS.
- Acceptance checks M1–M6 map to test files: M1 grid/scaffold, M2 resize engine, M3 batch export, M4 persistence/polish/privacy/offline, M5 crop modal/EXIF, M6 CI/demo fixtures/`.

## Acceptance checks
- M1-A1..M1-A4 — empty dropzone, thumbnails with metadata, debounced width change, ratio-lock height sync.
- M2-A1..M2-A6 — exact/contain/cover/percentage resize math, JPEG quality output, AVIF gated/hidden when unsupported.
- M3-A1..M3-A5 — ZIP contents with zero-padded names, single-file download, corrupt-file skip with warning, progress 100% before download, collision-free names.
- M4-A1..M4-A5 — localStorage restore, Ctrl/Cmd+S ZIP export, privacy statement visible, static-only page load, no network after bundle.
- M5-A1..M5-A2 — per-image crop export, EXIF orientation 6 auto-rotate.
- M6-A1..M6-A4 — CI green, 5-min demo script end-to-end, static dist/, README sections.

## Remaining milestones
Implemented in order M1→M6 in this session:
- M1 Scaffold & Grid (done)
- M2 Resize Engine (done)
- M3 Batch Export (done)
- M4 Persistence & Polish (done)
- M5 P1 Differentiators (crop modal, EXIF) (done)
- M6 Demo Fixtures, Tests & CI (done)

Remaining after this session: none — all milestones are implemented end-to-end in this ticket.