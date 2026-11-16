# PLAN — PicturaBox

## Goal
Build PicturaBox as a complete, original, browser-only application in `products/picturabox/` meeting the approved functional scope (FR-001–FR-024 across P0/P1/P2) and acceptance checks in issue #71. The app runs fully offline with no network calls after the static bundle loads and provides local image resize, format conversion, per-image crop, batch ZIP export, persistence, shortcuts, and shareable settings.

## Users
AI agents and developers who need a local, offline-capable image resize and batch-export tool that runs entirely in the browser without uploading files.

## Files
- `PLAN.md` — this plan (goal, users, files, test strategy, acceptance checks).
- `LICENSE` — MIT license text.
- `README.md` — first heading = tool name, one-sentence who-it-helps, `## About AaronWiseAI` section, footer.
- `package.json` — scripts, deps (jszip), `homepage: https://aaronwiseai.com/`.
- `index.html` — app shell with inline styles, no external network assets.
- `src/main.ts` — app entry and DOM wiring.
- `src/engine/types.ts` — shared types (settings, image records, resize modes, formats, crop).
- `src/engine/settings.ts` — default settings and localStorage persistence.
- `src/engine/formats.ts` — output format metadata and AVIF capability detection.
- `src/engine/resize.ts` — resize math and canvas rendering for Exact/Contain/Cover/Percentage modes.
- `src/engine/filename.ts` — filename pattern engine (`pictura_xxx`, `original_resized`, `custom_{name}`, `original`).
- `src/engine/exif.ts` — EXIF orientation parsing and transform helpers.
- `src/engine/loader.ts` — drag/drop and file input loading, EXIF auto-correct, SVG rasterization.
- `src/engine/crop.ts` — crop rectangle helpers and application.
- `src/engine/export.ts` — single-file download and JSZip batch export with progress.
- `src/engine/share.ts` — URL hash encode/decode of settings.
- `src/ui/shell.ts` — header, theme init, footer.
- `src/ui/index.ts` — toolbar, dropzone, thumbnail grid, progress, bulk rename preview rendering.
- `src/ui/modal.ts` — per-image crop modal and keyboard shortcuts.
- `tests/fixtures.ts` — programmatic synthetic fixture specs (gradient, checkerboard, noise, portrait, landscape).
- `tests/resize.test.ts` — resize engine acceptance checks (M2).
- `tests/filename.test.ts` — filename pattern and collision checks (M3).
- `tests/exif.test.ts` — EXIF orientation parsing/correction (M5).
- `tests/settings.test.ts` — localStorage persistence (M4).
- `tests/share.test.ts` — shareable settings hash (FR-024).
- `tests/formats.test.ts` — format gating and lossy behavior (FR-005/006).
- `tests/export.test.ts` — single/ZIP export and progress (M3).
- `tests/integration.test.ts` — integration flow across M1–M3.
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`.

## Test strategy
- Use Vitest in `jsdom` environment for unit and integration tests of pure engine modules.
- All fixtures are generated programmatically in code/tests (no external image assets).
- Cover resize math (Exact/Contain/Cover/Percentage), filename patterns and uniqueness, EXIF orientation parsing, settings persistence, share hash round-trip, format capability gating, and ZIP export/progress.
- Acceptance checks M1–M6 are mapped to the engine/UI behavior and verified by tests plus successful local `npm run build` and `npm test`.
- CI target: `npm ci` → `npm run build` → `npm test`.

## Acceptance checks
- **M1 Scaffold & Grid (FR-001–004, FR-007, FR-014):** empty dropzone, multi-file input, thumbnail grid with metadata, target dimensions with aspect lock, resize mode selector, live debounced preview behavior.
- **M2 Resize Engine (FR-005, FR-006):** exact/contain/cover/percentage resize math, output format selection with AVIF capability gating, quality slider for lossy formats.
- **M3 Batch Export (FR-008–011, FR-019):** ZIP export with filename patterns and zero-padded indices, individual export, corrupt-file skip with warning, progress indicator reaching completion before download.
- **M4 Persistence & Polish (FR-012, FR-013, FR-017, FR-018):** visible privacy statement, zero network calls after bundle load/offline-capable static build, localStorage settings persistence, keyboard shortcuts (Esc, Ctrl/Cmd+S).
- **M5 P1 Differentiators (FR-015, FR-016, FR-020):** per-image crop override modal, EXIF orientation auto-correct, copy-to-clipboard for single image.
- **M6 Demo Fixtures, Tests & CI (FR-021–FR-024 readiness):** programmatic fixtures, tests, static `dist/` build, README/PLAN/LICENSE/homepage present. Remaining polish items (SVG rasterization at target size path, bulk rename preview UI, dark/light theme toggle, shareable settings hash) are implemented in app code and validated by unit tests where applicable.