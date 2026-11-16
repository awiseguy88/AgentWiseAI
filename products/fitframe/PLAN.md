# FitFrame — PLAN

## Goal
Rebuild FitFrame as a complete, original, browser-based bulk image resizing and export tool. Users drop or select multiple images, configure resize/crop/watermark/rename/output settings, process them locally in the browser, and export results as a ZIP or individual files/folder. All processing runs client-side with no uploads.

## Users
- Designers, marketers, and developers who need to batch-resize and export images for web, social, or product use.
- AI agent and developer workflows that need a simple, offline-capable, browser-based image preparation utility.

## Files (planned)
- `PLAN.md` — this plan, milestones, and acceptance checks.
- `LICENSE` — MIT license.
- `README.md` — setup, usage, architecture, fixture/demo instructions, About/footer.
- `package.json`, `package-lock.json` — project metadata (homepage https://aaronwiseai.com/), scripts (`dev`, `build`, `test`, `typecheck`), dependencies.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts` — build/test config.
- `index.html` — app entry.
- `src/main.ts` — bootstrap UI and app wiring.
- `src/styles.css` — vanilla CSS, responsive desktop-first layout.
- `src/types.ts` — shared types.
- `src/state/settings.ts` — settings model, localStorage persistence (FR-017).
- `src/core/resize.ts` — resize/crop/focal math (FR-003, FR-004, FR-005, FR-006, FR-009).
- `src/core/watermark.ts` — text/image watermark and border rendering (FR-010, FR-011, FR-012).
- `src/core/rename.ts` — batch rename pattern logic (FR-013).
- `src/core/processor.ts` — per-image processing pipeline, format/quality handling, progress, error isolation (FR-007, FR-008, FR-020, FR-021).
- `src/core/export.ts` — ZIP/individual export and File System Access API save with fallback (FR-014, FR-015, FR-016).
- `src/core/capabilities.ts` — browser capability detection (AVIF/WebP encode, FS Access, bg removal/upscale hooks).
- `src/core/ai-hooks.ts` — lazy-loaded optional hooks for background removal/upscale with graceful degradation (FR-018, FR-019).
- `src/ui/` — UI modules (dropzone/input, thumbnail grid, settings panels, progress, dialogs).
- `src/fixtures/generate.ts` — programmatic synthetic fixture generation for tests/demo.
- `tests/resize.test.ts` — resize/crop/focal math unit tests.
- `tests/rename.test.ts` — rename pattern logic unit tests.
- `tests/watermark.test.ts` — watermark placement/border math/render helpers tests.
- `tests/integration.test.ts` — integration-style load→configure→process→export flow with synthetic fixtures.
- `tests/fixtures.test.ts` — fixture generation sanity checks.
- `.github` not needed inside product; root CI updated to run FitFrame checks.
- `dist/` — static build output (generated, not committed except as build artifact flow dictates; CI/build produces it).

## Milestones
### Milestone 1 — Core Resize & Export (P0 core)
- Multi-file drag-and-drop/file input for JPG/PNG/WebP/AVIF (FR-001).
- Thumbnail grid with dimensions and file size (FR-002).
- Target width/height with aspect-ratio lock (FR-003).
- Crop modes: contain, cover/crop-to-fill, custom per-image (FR-004).
- Output format selection (original/JPEG/WebP/AVIF) with capability detection/fallback (FR-007).
- Quality slider 0–100% (FR-008).
- Export all as ZIP and individual files (FR-014, FR-015).
- Non-blocking error handling for corrupt/unsupported files (FR-021).
- Visible privacy statement: "files never leave your device" (FR-024).
- Batch rename pattern with `xxx` and `ORIGINAL-NAME`, configurable start number (FR-013, included early for acceptance).

### Milestone 2 — Crop, Watermark & Persistence
- Smart focal-point auto-detection and manual focal-point adjustment per image (FR-005, FR-006).
- Text watermark: content, font, size, color, 9-grid position, opacity, angle (FR-010).
- Save to folder via File System Access API with graceful fallback (FR-016).
- Settings persistence via localStorage auto-save/restore (FR-017).
- Per-image and overall batch progress indicators (FR-020).

### Milestone 3 — Polish, AI Hooks & CI
- High-quality resize method option (FR-009).
- Image watermark overlay and border color/thickness (FR-011, FR-012).
- Background removal and 2x/3x/4x super-resolution upscale hooks: local, lazy-loaded, graceful degradation when unavailable (FR-018, FR-019).
- Responsive layout desktop-first, usable on tablet (FR-023).
- Keyboard shortcuts Ctrl/Cmd+O, Esc (FR-022).
- CI green (`npm ci` → `npm run build` → `npm test`), static `dist/` build, README/root index updates.

## Test Strategy
- **Unit tests (Vitest, node environment):**
  - `resize.ts`: aspect-ratio lock math, contain/cover/custom crop rectangles, focal-point centering/clamping, high-quality option selection logic.
  - `rename.ts`: `xxx` sequential padding, `ORIGINAL-NAME` substitution, start number/config handling, collision-safe naming behavior.
  - `watermark.ts`/border helpers: 9-grid positioning, opacity/angle/size calculations, border inset sizing.
- **Fixture generation:** programmatic synthetic fixtures (e.g. 1200×800 gradient PNG, 1000×1000 checkerboard PNG, 800×600 noise PNG) generated via canvas utilities; no external assets.
- **Integration-style test:** load synthetic fixtures → configure (width 800, ratio locked, WebP 85%, rename `fitframe_xxx` start 1, cover 400×400 case, watermark case) → process/export pipeline → verify outputs (count, names, dimensions/format metadata where feasible in test environment, error isolation for corrupt input).
- **Build verification:** `npm run build` produces static `dist/` with `index.html` and bundled assets.
- **CI:** add product job/steps in root `.github/workflows/ci.yml` to run `npm ci`, `npm run build`, `npm test` in `products/fitframe`.

## Acceptance Checks
### Milestone 1 — Core Resize & Export
1. **AT-A1/AT-A4:** Drop 3 synthetic images → set width 800px, ratio locked, WebP 85%, rename pattern `fitframe_xxx` start 1 → Download ZIP → ZIP contains 3 correctly sized WebP files named `fitframe_001.webp`, `fitframe_002.webp`, `fitframe_003.webp`.
2. **AT-A2:** Set crop mode to cover, target 400×400 → each output is exactly 400×400.
3. **FR-021:** Drop a corrupt/unsupported file alongside valid ones → corrupt file shows user-visible error, valid files still process and export.

### Milestone 2 — Crop, Watermark & Persistence
1. **AT-A3:** Add text watermark "FITFRAME DEMO" bottom-right, 30% opacity → exported images contain watermark in correct position.
2. **AT-B1/AT-B2:** Adjust focal point/crop on one image → only that image's crop changes; others unaffected.
3. **FR-017:** Reload page → previous settings (format, quality, rename pattern) restored from localStorage.
4. **FR-016:** Save-to-folder works in supported browsers; falls back to ZIP/individual download otherwise.

### Milestone 3 — Polish, AI Hooks & CI
1. Full 5-minute demo completes end-to-end with synthetic fixtures: drop 3 images → configure resize/crop/watermark/rename → export ZIP → verify outputs → reload confirms persistence.
2. CI passes on PR: `npm ci` → `npm run build` → `npm test` green.
3. AI feature toggles (FR-018, FR-019) exist in UI and degrade gracefully when models unavailable.
4. `npm run build` produces fully static deployable `dist/`.

## Remaining Milestones / Notes
- Milestone 1/2/3 are implemented in this delivery as a complete functional product per issue scope.
- Any environment-specific limitations (e.g. AVIF encoding support, File System Access API availability, optional AI model availability) are handled with capability detection and graceful fallback/degradation as specified.
