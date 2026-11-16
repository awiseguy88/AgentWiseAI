# Chmod Lab — PLAN

## Goal
Build a complete, original, browser-only chmod calculator and permission explainer in `products/chmod-lab/`. Users can convert between permission grid, octal, symbolic modes, and chmod command forms, apply symbolic expressions with umask, and understand results through warnings and step-by-step explanations. Runs fully offline with no network calls after the static bundle loads.

## Users
- Developers and operators who need to set or understand Unix file/directory permissions quickly.
- Learners who want a clear explanation of octal digits, symbolic strings, special bits, and umask effects.
- Anyone needing correct `chmod` commands (including recursive directory forms) without memorizing bit math.

## Files
- `PLAN.md` — this plan.
- `LICENSE` — MIT.
- `README.md` — tool overview, About AaronWiseAI, usage/build/test, fixtures, privacy, footer.
- `package.json`, `package-lock.json` — scripts (`dev`, `build`, `typecheck`, `test`), deps (Vite, TypeScript, Vitest).
- `tsconfig.json`, `vite.config.ts`, `index.html` — build/config.
- `src/types.ts` — permission state, warnings, result types.
- `src/core/permissions.ts` — grid↔octal↔symbolic conversions, special bits, validation, descriptions, ls-l output, warnings.
- `src/core/expression.ts` — symbolic expression parser/applier (`u+x`, `go-w`, `a=rX`, `=rw`) with umask masking (POSIX semantics).
- `src/core/commands.ts` — chmod command generation (octal + symbolic arg form, directory recursion `find ...`).
- `src/core/steps.ts` — calculation steps text (per-class math, special digit, umask formula).
- `src/core/share.ts` — URL hash encode/decode for mode/kind/expression.
- `src/core/storage.ts` — localStorage persistence and session history (last 10).
- `src/fixtures.ts` — programmatic synthetic fixtures for demos/tests.
- `src/ui/app.ts` — UI wiring: grid, inputs, chips, expression/umask, results, commands, copy, shortcuts, theme, import/export.
- `src/styles.css` — responsive layout, dark/light theme.
- `src/main.ts` — bootstrap.
- `test/permissions.test.ts` — conversions, validation, special bits, ls-l, warnings (AT-01–AT-09).
- `test/expression.test.ts` — symbolic expressions, umask, X semantics (AT-10–AT-12).
- `test/commands.test.ts` — command generation and copy-ready strings (AT-13–AT-14).
- `test/state.test.ts` — share hash, persistence, history, export/import helpers (FR-017,19,21,22, AT-15).
- `dist/` — static build output.

## Test strategy
- Unit tests (Vitest) for pure core logic: conversions, parsing/validation, warnings, calculation steps, symbolic expression application including umask and `X`, command formatting, share encoding, storage/history/export/import.
- Integration-style tests covering end-to-end flows from the acceptance checks: grid→octal→symbolic, octal→grid, symbolic→grid, expression+umask apply, commands/copy strings, persistence/restore logic.
- All fixtures generated programmatically in `src/fixtures.ts` / tests (no external assets).
- Run `npm ci && npm run build && npm test` locally and ensure CI steps pass.

## Acceptance checks
- FR-001–FR-014: grid (Owner/Group/Other × rwx) live updates; octal (1–4) and symbolic/ls-l inputs with inline errors leaving state unchanged on invalid input; special bits (setuid/setgid/sticky, `s/S/t/T`); File/Directory toggle affects `ls -l` prefix and umask defaults; result panel shows octal, symbolic, ls-l, four-digit octal, per-class English description; warnings for risky modes (world-writable, setuid without execute, setuid+group/world write, sticky on file, dir read-without-execute, unreadable by owner); calculation steps shown; commands `chmod <octal> <path>` and symbolic arg form plus directory `find ... -type d -exec chmod ...`; copy buttons for chmod command and octal; common mode chips with labels; privacy statement visible; zero network calls after load (fully offline); responsive desktop/mobile.
- FR-015–FR-020: symbolic expression field with umask and "Use this" apply; umask defaults (file 666 & ~umask, dir 777 & ~umask); settings persistence (last mode, kind, expression) restored on reload; shortcuts Esc clears error, Ctrl/Cmd+S copies chmod command; shareable URL hash encodes mode/kind/expression; dark/light theme toggle persisted.
- FR-021–FR-022: export/import settings as JSON; session permission history (last 10).
- AT-01–AT-16: workflow scenarios pass (grid 755/dir prefix/setuid 4755 with warning; octal 644/4755/invalid 999; symbolic rwxr-xr-x and -rwsr-x--x. and invalid length; expressions u+x/go-w/a=rX/=rw with umask and POSIX masking; commands for 755 file and 775 dir; persistence reload and offline conversions/no network requests).
- Demo fixtures are synthetic/programmatically generated; no external assets. Privacy statement present. No network calls after bundle load.
