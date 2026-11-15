# Solo Site Rescue Kit — Build Plan

## Goal

A small, self-contained, offline-first tool that helps a solopreneur rescue a website
stranded by a no-code builder shutdown (e.g. Mozilla Solo, shutting down 2026-11-30).
It ingests an exported builder bundle, recovers as many image assets as possible,
rewrites references, and produces a clean static site (or a Next.js scaffold) plus a
single-file HTML report and a migration checklist, committed to a local git repo.

The tool must run with **no network access and no paid APIs**. Network is used only as a
best-effort optimization to rescue remote image URLs; when offline, unrecoverable assets
are clearly identified instead of failing the run.

## User-facing behavior

```
solo-rescue run <export-dir-or-export.zip> [options]
solo-rescue ingest <export-dir-or-export.zip>
solo-rescue report --from <output-dir>
solo-rescue version | help
```

Key options: `--out <dir>`, `--format static|next`, `--offline`, `--no-git`,
`--no-report`, `--mask-submissions`, `--timeout <ms>`, `--retries <n>`,
`--concurrency <n>`, `--cache-dir <dir>`, `--title <text>`,
`--git-author "Name <email>"`.

Behavior:

1. **Ingest** a directory or a `.zip` export. Classify files: HTML pages, CSV (image-link
   lists and/or contact/newsletter submissions), JSON, and other assets.
2. **Extract** every image reference from HTML (`img src`, `srcset`, `data-src`,
   `data-original`, `poster`, CSS `url(...)` in inline styles/`<style>`), from CSV image
   columns, and from JSON strings. Classify each as remote, local-present, local-missing,
   or data-URI.
3. **Rescue** remote images into a local `assets/images/` folder using a content-addressed
   cache (`.rescue-cache/`), with retries, timeouts, and bounded concurrency. Offline mode
   uses only the cache and reports misses. Local images are copied; missing ones are logged.
4. **Rewrite** HTML/CSS references from remote URLs to local paths, preserving page
   structure and `srcset` descriptors.
5. **Build** a static site (rewritten HTML + copied assets + `data/submissions.json`) or a
   Next.js App Router scaffold (pages render the rewritten markup, assets under `public/`).
6. **Report** a single self-contained `report.html` (inline CSS/JS, embedded JSON) plus
   `rescue-data.json` and `MIGRATION-CHECKLIST.md`.
7. **Commit** the result to a local git repository (unless `--no-git`), with a configurable
   author identity.

## Files and modules

```
solo-site-rescue-kit/
  PLAN.md                     # this plan
  README.md                   # usage, formats, limitations
  package.json                # zero-dependency ESM package, bin + scripts
  bin/solo-rescue.js          # executable entry -> src/cli.js
  src/
    cli.js                    # argument parsing, command dispatch, runPipeline()
    utils.js                  # fs/path/hash/URL helpers
    ingest.js                 # directory + ZIP scanning into an inventory
    unzip.js                  # minimal pure-Node ZIP reader (stored + deflate)
    extract.js                # HTML/CSS/CSV/JSON reference + submission extraction
    rescue.js                 # offline-first image rescue with cache + retries
    rewrite.js                # attribute-aware HTML/CSS reference rewriting
    build.js                  # static site + Next.js scaffold builders
    report.js                 # single-file HTML report generator
    checklist.js              # migration checklist generator
    git.js                    # local git init/add/commit
  fixtures/export/            # sample Mozilla-Solo-style export for the smoke check
  smoke-check.js              # end-to-end verification (offline + loopback rescue + next)
```

No runtime dependencies; Node >= 18 (uses global `fetch` when online).

## Test strategy

- `smoke-check.js` is the primary acceptance test. It:
  1. Builds a temporary Solo-style export (HTML with local/remote/data-URI images, CSS
     background, CSV image links, contact + newsletter submissions, JSON).
  2. Runs the pipeline **fully offline** and asserts: static site generated, local assets
     copied, remote assets reported as unrecoverable, report/checklist/data files present,
     local git commit created.
  3. Starts a loopback HTTP server and runs with rescue enabled to assert remote images are
     downloaded, cached, rewritten, and then served again from cache on a second offline run.
  4. Runs `--format next` and asserts the App Router scaffold and public assets exist.
  5. Prints PASS/FAIL per assertion and exits non-zero on failure.
- Manual checks: `node src/cli.js help`, `--version`, invalid-input error handling.

## Acceptance checks

- [ ] A sample export (directory or ZIP) produces a readable static site.
- [ ] Recovered assets are present and referenced correctly; unrecoverable assets are listed.
- [ ] A migration checklist is emitted.
- [ ] Full offline run succeeds with no external network calls.
- [ ] Single-file `report.html` opens standalone and summarizes the run.
- [ ] Local git repo is initialized and committed (unless disabled).
- [ ] README documents usage, input formats, options, and limitations.
- [ ] `npm run smoke` / `node smoke-check.js` passes.