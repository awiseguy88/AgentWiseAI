# PicturaBox

Browser-only image resize, format conversion, and batch export for AI agents and developers — runs entirely on your device with no uploads.

## Features

- **Input & parsing (FR-001–FR-002):** Drag-and-drop or file picker for JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, and SVG (rasterized). Thumbnail grid shows original filename, dimensions, file size, and format badge.
- **Resize controls (FR-003–FR-007):** Target width/height with aspect-ratio lock, resize modes (Exact / Contain / Cover / Percentage), output format selection (Original, JPEG, WebP, PNG, AVIF gated by browser capability), quality slider for lossy formats, and live debounced preview updates.
- **Batch export (FR-008–FR-011, FR-019):** Export all processed images as a ZIP or download individual files. Filename patterns: `pictura_xxx`, `original_resized`, `custom_{name}`, or original name with zero-padded indices. Corrupt/unsupported files are skipped with inline warnings while valid files continue. Progress indicator tracks batch processing.
- **Per-image tools & polish (FR-015–FR-020):** Click a thumbnail to open a crop modal (applies to that image only), EXIF orientation auto-correct on load, settings persistence in localStorage, keyboard shortcuts (`Esc` closes modals, `Ctrl/Cmd+S` exports ZIP), and copy-to-clipboard for a single image.
- **P2 enhancements (FR-021–FR-024):** SVG rasterization to canvas, bulk rename preview before export, dark/light theme toggle (persisted), and shareable URL hash encoding current settings (no images).
- **Privacy & offline (FR-012–FR-014):** Visible privacy statement: "Your images never leave your device". Fully offline capable with zero network calls after the static bundle loads. Responsive layout for desktop and mobile.

## Development

```bash
npm ci
npm run build   # tsc --noEmit + vite build → static dist/
npm test        # vitest run
npm run dev     # local development server
```

All test fixtures are generated programmatically (no external assets).

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/