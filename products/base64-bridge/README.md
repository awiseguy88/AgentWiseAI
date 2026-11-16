# Base64 Bridge

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

Base64 Bridge is a complete, browser-only web app for encoding and decoding text and files to/from Base64. Everything runs client-side with no server uploads and no network calls required after the static bundle loads.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Features

- **Text encode/decode** — Standard (RFC 4648) and URL-safe Base64 (FR-001, FR-002, FR-003).
- **Character sets** — UTF-8 (default) plus ASCII, ISO-8859-1, Windows-1252, UTF-16 LE/BE (FR-004).
- **Newline style** — LF or CRLF (FR-005).
- **Line wrapping** — Optional 76-character MIME wrapping (FR-006).
- **Per-line encoding** — Encode each line separately (FR-007).
- **Live mode** — Encode/decode as you type (FR-008).
- **File upload** — Encode any file to Base64 client-side (FR-009, FR-010).
- **Downloads** — Download encoded text/files and ZIP archives for multiple outputs (FR-011).
- **Strict validation** — Inline errors for invalid Base64 and non-zero pad bits (FR-012, FR-018).
- **Decode output** — Text output or binary file download (FR-013).
- **Auto-detect URL-safe** — Detects URL-safe input on decode (FR-014).
- **Copy to clipboard** — Copy encoded/decoded output (FR-015).
- **Privacy statement** — Visible notice that data never leaves the device (FR-016).
- **Client-side only** — No server uploads (FR-017).
- **Responsive layout** — Works on desktop and mobile (FR-019).
- **Keyboard shortcuts** — `Ctrl/Cmd+Enter` run, `Ctrl/Cmd+Shift+C` copy, `Ctrl/Cmd+Shift+L` toggle live mode, `Esc` clear error (FR-020).

## Install & run

```bash
cd products/base64-bridge
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build (static `dist/`)

```bash
cd products/base64-bridge
npm run build
```

Runs `tsc --noEmit` then `vite build`, producing a static `dist/` folder.

## Tests

```bash
cd products/base64-bridge
npm test
```

Runs Vitest covering core encode/decode behavior, charset handling, ZIP/file helpers, and the acceptance checks (AT-01–AT-08).

## Fixtures

Included in `public/fixtures/` (and linked from the File Tools panel):

- `hello-world.txt`
- `sample.png` (1×1 red pixel)
- `data-sample.json`

## Acceptance checks (AT-01–AT-08)

- AT-01: Encode `foo` → `Zm9v`
- AT-02: Encode `fo` → `Zm8=`
- AT-03: Encode `f` → `Zg==`
- AT-04: Decode `Zm9v` → `foo`
- AT-05: URL-safe encoding transforms `+`,`/` and removes padding
- AT-06: 76-char wrapping produces valid line lengths
- AT-07: Binary file round-trip preserves hash (sample.png)
- AT-08: Invalid Base64 shows inline error

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
