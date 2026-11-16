# Base64 Bridge — PLAN

## Goal
Build a complete, original, browser-only web app (Base64 Bridge) in `products/base64-bridge/` that encodes/decodes text and files to/from Base64 entirely client-side, with no server uploads. Includes all approved FR-001–FR-020 and AT-01–AT-08.

## Users
- Developers/testers who need quick Base64 encode/decode without uploading data.
- People embedding images/assets as data URIs or working with MIME/Base64 payloads.
- Users who need file round-trips (encode file → Base64 → decode back to file) locally.

## Files (planned)
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.ts`, `src/styles.css`, `src/types.ts`
- `src/core/base64.ts` (encode/decode, variants, wrapping, validation)
- `src/core/charset.ts` (text↔bytes via TextEncoder/TextDecoder; legacy noted with fallbacks)
- `src/core/files.ts` (file read, download, zip helper for multiple outputs)
- `src/core/clipboard.ts` (copy helpers)
- `src/ui/app.ts` (UI wiring, state, rendering)
- `src/fixtures.ts` (fixture metadata/links)
- `public/fixtures/hello-world.txt`, `public/fixtures/sample.png`, `public/fixtures/data-sample.json`
- `test/base64.test.ts`, `test/charset.test.ts` (Vitest), plus fixtures
- `README.md`, `LICENSE` (MIT)
- CI/workspace updates: add `products/base64-bridge` to root CI and root README tool table (separately via repo rules)

## Test strategy
- Vitest unit tests for core encoding/decoding rules:
  - AT-01 `foo` → `Zm9v`, AT-02 `fo` → `Zm8=`, AT-03 `f` → `Zg==`, AT-04 decode `Zm9v` → `foo`
  - AT-05 URL-safe transforms (`+`,`/`→`-`,`_`, remove padding in URL-safe output form as specified)
  - AT-06 76-char wrapping produces only valid line lengths (≤76)
  - AT-08 invalid Base64 yields inline error
  - AT-07 binary round-trip: encode uploaded bytes → decode → SHA-256 (or byte-equal) match; tested with PNG bytes
- UI is exercised via logic/unit helpers where practical; manual smoke described in README.

## Acceptance checks (from issue)
- AT-01: Encode "foo" -> "Zm9v"
- AT-02: Encode "fo" -> "Zm8="
- AT-03: Encode "f" -> "Zg=="
- AT-04: Decode "Zm9v" -> "foo"
- AT-05: URL-safe encoding transforms +,/ and removes padding
- AT-06: 76-char wrapping produces valid line lengths
- AT-07: Binary file round-trip preserves hash
- AT-08: Invalid Base64 shows inline error

## Milestones (implemented)
- M1: Core scaffold + text encode/decode + copy
- M2: Options + live mode (variant, charset, newline, wrap, per-line, auto-detect, strict validation UX)
- M3: File upload encode/decode + downloads (single file; ZIP when multiple outputs)
- M4: Validation + polish + docs + responsive + fixtures + CI integration

## Notes
- Fully client-side; no network calls after load required for core functionality.
- Do not mention source product/pipeline in repo/PR text.
- MIT license.