# Chmod Lab

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

Chmod Lab is a complete, browser-only Unix permission calculator and explainer. Convert between permission grid, octal, and symbolic modes, apply symbolic expressions with umask, understand calculation steps and warnings, and generate ready-to-copy `chmod` commands — entirely client-side with no uploads and no network calls after the static bundle loads.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

## Features

- **Permission grid** — 3 classes (Owner / Group / Other) × 3 bits (Read / Write / Execute) checkboxes, updating live (FR-001).
- **Octal input** — 1–4 digits (e.g. `755`, `4755`); invalid input shows an inline error and leaves the grid unchanged (FR-002).
- **Symbolic input** — `rwxr-xr-x` / `ls -l` style strings (FR-003).
- **Special bits** — Setuid, Setgid, Sticky reflected in four-digit octal and symbolic `s/S/t/T` (FR-004).
- **File/Directory toggle** — switches the `ls -l` prefix and umask defaults (FR-005).
- **Result panel** — octal, symbolic, `ls -l`, four-digit octal, plain-English description per class (FR-006).
- **Risky-mode warnings** — world-writable, setuid without execute, setuid plus group/world write, sticky on file, directory read-without-execute, unreadable by owner (FR-007).
- **Calculation steps** — per-class digit = read 4 + write 2 + execute 1; special digit = setuid 4 + setgid 2 + sticky 1; umask formula (FR-008).
- **Commands** — `chmod <octal> <path>`, symbolic-arg form (`u=rwxs,g=rx,o=rx`), directory recursion (`find ... -type d -exec chmod ...`) (FR-009).
- **Copy buttons** — copy `chmod` command and copy octal (FR-010).
- **Common modes chips** — quick-select chips with use-case labels (FR-011).
- **Privacy statement** — "Your data never leaves your device" (FR-012).
- **Fully offline** — no network calls after the static bundle loads (FR-013).
- **Responsive** — usable on desktop (≥768px) and mobile (≤480px) (FR-014).
- **Symbolic expression field** — `u+x`, `go-w`, `a=rX` with umask input and "Use this" feedback (FR-015).
- **umask defaults** — new file = 666 AND NOT umask, new directory = 777 AND NOT umask (FR-016).
- **Settings persistence** — last mode, kind, expression in localStorage; restored on reload (FR-017).
- **Keyboard shortcuts** — `Esc` clears error; `Ctrl+S` / `Cmd+S` copies chmod command (FR-018).
- **Shareable URL** — hash encodes current mode, kind, and expression (no user data) (FR-019).
- **Dark/light theme** — toggle persisted (FR-020).
- **Export/import** — settings as JSON (FR-021).
- **Permission history** — last 10 conversions within the session (FR-022).

## Install & run

```bash
cd products/chmod-lab
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173).

## Build (static `dist/`)

```bash
cd products/chmod-lab
npm run build
```

Runs `tsc --noEmit` then `vite build`, producing a fully static `dist/` folder with no server-side dependencies.

## Tests

```bash
cd products/chmod-lab
npm test
```

Runs `vitest run` covering conversions, symbolic expressions with umask, command generation, share-encoding round-trips, and the acceptance-check workflows (AT-01–AT-16).

## Fixtures

All fixtures are synthetic and programmatically generated — private key, web page, script, project dir, and scratch dir (no external assets).

In the UI, click a common-mode chip to load a demo mode, then toggle Directory, set special bits, and use the expression field with "Use this".

## Acceptance checks

The acceptance checks from issue #73 are covered by tests:

- **Workflow 1: Grid → Octal → Symbolic** — tick Owner rwx, Group r-x, Other r-x → `755` / `rwxr-xr-x` / description correct; toggle File→Directory → `ls -l` prefix `d`; check Setuid → `4755` with warning (AT-01–AT-03).
- **Workflow 2: Octal input → grid** — `644`, `4755`, invalid `999` leaves grid unchanged with inline error (AT-04–AT-06).
- **Workflow 3: Symbolic input → octal** — `rwxr-xr-x` → `755`; `-rwsr-x--x.` → `4751`; invalid length → error (AT-07–AT-09).
- **Workflow 4: Symbolic expression + umask** — `u+x`, `a=rX`, `=rw` with umask masking (AT-10–AT-12).
- **Workflow 5: Commands + copy** — `chmod 755 deploy.sh`; directory recursion `find ...` line (AT-13–AT-14).
- **Workflow 6: Persistence & offline** — mode/kind restored on reload; conversions work offline with no network requests (AT-15–AT-16).

## License

MIT — see [LICENSE](LICENSE).

---

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
