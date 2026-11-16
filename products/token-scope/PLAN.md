# TokenScope — PLAN

## Goal
Rebuild TokenScope as a complete, original, browser-only JSON Web Token (JWT) debugger in `products/token-scope/`. Users paste a JWT to decode its header and payload, verify the signature with a user-supplied secret (HS256), view expiry status and a claims breakdown, and generate signed JWTs — entirely client-side with no uploads and no network calls after the static bundle loads.

## Users
- AI engineers and developers debugging or inspecting JWTs.
- Agent and token workflows that need an offline-capable, client-side JWT debugger/generator.

## Files (planned)
- `PLAN.md` — this plan, milestones, and acceptance checks.
- `LICENSE` — MIT license.
- `README.md` — setup, usage, architecture, fixture/demo instructions, About/footer.
- `package.json`, `package-lock.json` — project metadata (homepage https://aaronwiseai.com/), scripts (`dev`, `build`, `preview`, `test`, `typecheck`), devDependencies (typescript, vite, vitest).
- `tsconfig.json` — TypeScript config.
- `vite.config.ts` — Vite build config, static `dist/` output.
- `vitest.config.ts` — Vitest test config.
- `index.html` — app entry.
- `src/main.ts` — app bootstrap and UI wiring.
- `src/styles.css` — vanilla CSS, responsive layout.
- `src/types.ts` — shared types.
- `src/crypto/base64url.ts` — Base64URL encode/decode without external libraries (FR-002, FR-012).
- `src/crypto/jwt.ts` — JWT segment splitting, decode/parse, signature verify, sign, expiry math, malformed-token errors (FR-001–FR-013, FR-020).
- `src/state/settings.ts` — localStorage persistence of algorithm/secret/token (FR-014).
- `src/ui/*.ts` — UI modules: decoder, generator, copy buttons, expiry/status badges, errors, keyboard shortcuts (FR-001–FR-020).
- `src/fixtures.ts` — programmatic synthetic fixture generation (no external assets).
- `tests/base64url.test.ts` — Base64URL encode/decode unit tests.
- `tests/jwt.test.ts` — decoder segment splitting, expiry relative-time math, malformed-token error messages, verify/sign round-trip.
- `tests/fixtures.test.ts` — fixture generation sanity checks.
- `tests/integration.test.ts` — integration-style decode→verify→generate→copy→re-decode flow with synthetic fixtures.
- `dist/` — static build output (generated).

## Milestones
### Milestone 1 — Core Decode & Verify (P0)
- Accept an encoded JWT string input, pasted or typed (FR-001).
- Decode header and payload from Base64URL to pretty JSON, live on input (FR-002).
- Tolerate leading/trailing whitespace and newlines (FR-003).
- Empty/whitespace-only input shows neutral "paste a token" state, not an error (FR-004).
- Support algorithms: none, HS256, RS256, ES256, PS256 (FR-005).
- Verify HMAC (HS256) signature with user-supplied secret; show Valid/Invalid (FR-006).
- Show expiry status: valid / expired / not yet valid, relative to now (FR-007).
- Claims breakdown: iss, sub, iat, exp, nbf, aud with values (FR-008).
- Decode/verify re-runs on every keystroke; no submit button (FR-011).
- Invalid/malformed token shows inline error naming the issue (bad segments, bad Base64URL, bad JSON) (FR-012).
- "none" algorithm shows a security warning (unsigned token) (FR-013).
- Non-JWT string, truncated token, unsupported algorithm — non-blocking error handling (FR-020).

### Milestone 2 — Generate, Copy & Persistence
- Copy buttons: header JSON, payload JSON, signature, full encoded token (FR-009).
- Generate a JWT from editable header/payload JSON + algorithm + secret (FR-010).
- Settings persistence: last algorithm/secret/token remembered in localStorage (FR-014).
- "Generate example" pre-fills a sample JWT for demo (FR-015).
- Responsive layout: usable on desktop and narrow viewports (FR-016).
- Privacy statement visible: "Your token never leaves your device" (FR-017).
- Keyboard shortcuts: Ctrl+V focus, Esc clear, Ctrl+C copy (FR-018).

### Milestone 3 — Polish & CI
- No network calls after the static bundle loads (FR-019) — verified by offline test + CI.
- Full 5-minute demo script completes end-to-end with synthetic fixtures (E1).
- CI passes on PR: `npm ci` → `npm run build` → `npm test` green (E2).
- `npm run build` produces fully static deployable `dist/` (E4).
- README, PLAN.md, LICENSE, root README tool table entry, root CI entry (E2/E4).

## Test Strategy
- **Unit tests (Vitest, node environment):**
  - `base64url.ts`: encode/decode round-trips, URL-safe alphabet, padding handling, invalid input errors.
  - `jwt.ts`: segment splitting (3 segments required), pretty-print JSON, expiry relative-time math (expired/valid/not yet valid), malformed-token error messages naming the issue, HS256 verify valid/invalid, sign→verify round-trip, "none" path.
  - `fixtures.ts`: generated HS256 JWT matches expected header/payload/secret, expired JWT has past exp, malformed cases detected.
- **Fixture generation:** programmatic JWT fixtures using Web Crypto/subtle-free HS256 implementation; no external assets. Valid HS256 JWT with header `{"alg":"HS256","typ":"JWT"}`, payload `{"sub":"user-42","name":"Demo User","role":"developer","iat":1700000000,"exp":9999999999}`, secret `demo-secret-2026`; expired JWT; malformed cases (`not-a-jwt`, `a.b`, `!!!@@@###`, non-JSON segment).
- **Integration-style test:** decode a synthetic HS256 JWT with correct/wrong secret, generate a JWT from editable claims, re-paste generated token and decode back to same claims, copy buttons, persistence round-trip.
- **Build verification:** `npm run build` produces static `dist/` with `index.html`.
- **CI:** add product job/steps in root `.github/workflows/ci.yml` to run `npm ci`, `npm run build`, `npm test` in `products/token-scope`.

## Acceptance Checks
### Milestone 1 — Core decode & verify
1. **A1:** Paste valid HS256 JWT + correct secret → header + payload JSON shown, "Valid signature" badge, expiry status shown.
2. **A2:** Same JWT + wrong secret → "Invalid signature" badge.
3. **A3:** Empty field → neutral "paste a token" state, no error banner.
4. **A4:** Malformed string "not-a-jwt" → inline error naming the issue, no crash.
5. **A5:** Valid JWT with past exp → shows "Expired" relative hint.
### Milestone 2 — Generate, copy & persistence
1. **B1:** Edit a payload claim → generate → re-paste into decoder → decodes back to the same claims.
2. **B2:** Algorithm switched to "none" → token generated with an unsigned-token security warning.
3. **C1:** Click "Copy payload" → payload pretty JSON copied to clipboard.
4. **D1:** Reload page → previous algorithm/secret/token restored from localStorage.
### Milestone 3 — Polish & CI
1. **E1:** Full 5-minute demo script completes end-to-end with synthetic fixtures.
2. **E2:** CI passes on PR: `npm ci` → `npm run build` → `npm test` green.
3. **E3:** No network requests after the static bundle loads.
4. **E4:** `npm run build` produces fully static deployable `dist/`.

## Remaining Milestones / Notes
- Milestones 1/2/3 are implemented in this delivery as a complete functional product per issue scope.
- All signing/verification uses native Web Crypto (`crypto.subtle`) with a Node-compatible HMAC fallback in tests so the same logic runs offline in-browser and under Vitest.
- Environment-specific limitations (e.g. Clipboard API availability) are handled with capability detection and graceful fallback.
