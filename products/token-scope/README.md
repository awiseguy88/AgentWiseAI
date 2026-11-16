# TokenScope

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

TokenScope is a complete, browser-only JSON Web Token (JWT) debugger. Paste a token to decode its header and payload, verify the signature with a user-supplied secret, view expiry status and claims, and generate signed JWTs — entirely client-side with no uploads and no network calls after the static bundle loads.

> **Privacy:** Your token never leaves your device.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Features

- **Live decode** — paste or type a JWT; header and payload decode to pretty JSON on every keystroke (FR-001, FR-002, FR-011).
- **Input tolerance** — leading/trailing whitespace and newlines are trimmed; empty input shows a neutral "paste a token" state (FR-003, FR-004).
- **Algorithms** — supports `none`, `HS256`, `RS256`, `ES256`, `PS256` (FR-005). HMAC (HS256/384/512) verification with a user-supplied secret (FR-006). RSA/ECDSA verification with a PEM public key.
- **Signature status** — Valid / Invalid / Unsigned / Unchecked / Unsupported badges (FR-006, FR-013).
- **Expiry status** — active / expired / not yet valid, relative to now (FR-007).
- **Claims breakdown** — lists `iss`, `sub`, `iat`, `exp`, `nbf`, `aud` with values (FR-008).
- **Copy buttons** — header JSON, payload JSON, signature, and full encoded token (FR-009).
- **Generate** — create a JWT from editable header/payload JSON + algorithm + secret (FR-010).
- **"none" warning** — unsigned-token security warning for `alg: none` (FR-013).
- **Example** — "Generate example" pre-fills a sample JWT for demo (FR-015).
- **Persistence** — last algorithm/secret/token remembered in localStorage (FR-014).
- **Responsive** — usable on desktop and narrow viewports (FR-016).
- **Keyboard shortcuts** — <kbd>Ctrl</kbd>+<kbd>V</kbd> focus token input, <kbd>Esc</kbd> clear, <kbd>Ctrl</kbd>+<kbd>C</kbd> copy token when focus is outside inputs (FR-018).
- **Error handling** — inline errors naming the issue for malformed tokens (bad segments, bad Base64URL, bad JSON), unsupported algorithms, and truncated/non-JWT strings (FR-012, FR-020).
- **Fully offline** — no network calls after the static bundle loads (FR-019).

## Install & run

```bash
cd products/token-scope
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173).

## Build (static `dist/`)

```bash
cd products/token-scope
npm run build
```

Produces a fully static, deployable `dist/` folder (no server-side dependencies).

## Tests

```bash
cd products/token-scope
npm test
```

Tests cover:
- Base64URL encode/decode (URL-safe alphabet, padding handling, invalid input).
- JWT decoder segment splitting, pretty-print JSON, expiry relative-time math, and malformed-token error messages.
- HS256 verify valid/invalid, sign→verify round-trip, `none` path.
- Programmatic synthetic fixtures and integration-style decode→verify→generate→re-decode flow.

## Fixture & demo instructions

All fixtures are generated programmatically (no external assets):
- **Valid HS256 JWT:** header `{"alg":"HS256","typ":"JWT"}`, payload `{"sub":"user-42","name":"Demo User","role":"developer","iat":1700000000,"exp":9999999999}`, secret `demo-secret-2026`.
- **Expired JWT:** payload with `exp` in the past.
- **Malformed cases:** `"not-a-jwt"`, `"a.b"` (two segments), `"!!!@@@###"`-style bad Base64URL, and a segment that decodes but is not valid JSON.

In the UI, click **Generate example** to load the demo JWT, then verify with `demo-secret-2026`.

## Architecture

- `src/types.ts` — shared types and algorithm/verify/expiry models.
- `src/crypto/base64url.ts` — Base64URL encode/decode using native `atob`/`btoa` (no external libraries).
- `src/crypto/jwt.ts` — segment splitting, decode/parse, expiry math, Web Crypto (`crypto.subtle`) HMAC/RSA/ECDSA verify and sign.
- `src/state/settings.ts` — localStorage persistence (algorithm/secret/token/header/payload).
- `src/fixtures.ts` — programmatic synthetic fixture generation.
- `src/main.ts` — app bootstrap, UI, live decode/verify, generate, copy, keyboard shortcuts.
- `src/styles.css` — vanilla CSS, responsive layout.
- `tests/` — Vitest unit and integration-style tests.

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
