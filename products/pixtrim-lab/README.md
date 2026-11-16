# PixTrim Lab

A browser-only image resize, format conversion, and batch export tool for AI agents and developers — runs entirely on your device with no uploads.

## Features

- **Input & parsing:** Drag-and-drop or file-picker for JPG, PNG, WebP, AVIF, BMP, GIF, and SVG (rasterized). Thumbnails show filename, dimensions, size, and format badge.
- **Resize modes:** Exact, Contain, Cover, and Percentage with aspect-ratio lock and live preview (debounced 150ms).
- **Output formats:** Original, JPEG, WebP, PNG, AVIF (gated by browser encoding support) with quality control for lossy formats.
- **Batch export:** Export all processed images as a ZIP or download individual files. Filename patterns: `pixtrim_xxx`, `original_resized`, `custom_{name}`, or original. Zero-padded indices prevent collisions.
- **Per-image overrides:** Click a thumbnail to crop with a drag-handle modal; EXIF orientation auto-corrected on load.
- **Polish:** Settings persistence (localStorage), keyboard shortcuts (Esc closes modals, Ctrl/Cmd+S exports ZIP), progress indicator, copy-to-clipboard, bulk rename preview, dark/light theme, shareable URL hash for settings.
- **Privacy:** Visible statement “Your images never leave your device”. Zero network calls after the static bundle loads.

## Development

```bash
npm ci
npm run build   # tsc --noEmit + vite build → static dist/
npm test        # vitest run
```

Open `dist/index.html` or run `npm run dev` locally. All fixtures used in tests are generated programmatically (no external assets).

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
