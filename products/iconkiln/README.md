# IconKiln

Browser-only app-icon and favicon pack generator for AI agents and developers — turn one source image into a multi-resolution `.ico`, per-size PNGs, and a complete favicon/apple-touch/android-chrome ZIP with `site.webmanifest`. Runs entirely on your device with no uploads and no network calls after the static bundle loads.

## Features

- **Source input (ICK-001–004):** File picker and drag-drop. Accepts PNG, SVG, JPG, BMP, GIF (first frame), and WebP. Unsupported or oversized (>32 MB) files are rejected with an inline message and never crash the app. A **Load sample** menu fills the stage with a bundled original image (`mark.svg`, `mark-1024.png`, `photo-sample.png`).
- **Icon type (ICK-005):** Choose a single multi-resolution `favicon.ico` or one PNG file per size.
- **Sizes (ICK-006–007):** Toggle preset chips (16/24/32/48/64/128/256) independently, or enter a custom `[W]x[H]` comma list like `30x30,60x60`. Custom sizes are validated and clamped to the 16–256 range; a bare number is treated as square.
- **Background (ICK-008):** Keep transparency or flatten onto a chosen color.
- **Live preview (ICK-009):** Each size renders at exact pixel dimensions on a checkerboard so transparency is visible, with a 1:1 toggle for an unsmoothed native-scale view.
- **Exports (ICK-010–014):** Transparency is preserved through rasterize → PNG → ICO. The multi-resolution `.ico` is a valid `ICONDIR` with one `ICONDIRENTRY` per frame and PNG-encoded blocks. Per-size files are named `name-<W>x<H>.png`. The ZIP pack contains conventional favicon/apple-touch/android-chrome assets plus a valid `site.webmanifest` and `README.txt`. Any single asset downloads individually.
- **Pack preview (WF-5):** The `#/pack` route lists every file the ZIP will contain and previews the manifest JSON.
- **Guide & About (ICK-015):** `#/guide` documents the ICO container and the size table; `#/about` states the offline/privacy model.
- **Privacy & offline (ICK-016–018):** No network request after the initial static load; all processing is client-side. Light/dark theme persisted in `localStorage`. Original branding, copy, and visuals throughout.

## Navigation

Hash routes: `#/` Generate (default), `#/pack`, `#/guide`, `#/about`.

## Development

```bash
npm ci
npm run build     # tsc --noEmit + vite build → static dist/
npm test          # vitest run
npm run dev       # local development server
npm run fixtures  # regenerate original fixtures (Node built-ins only)
```

The original fixtures in `fixtures/` are produced by `scripts/generate-fixtures.mjs` using only Node built-ins — no third-party art.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/