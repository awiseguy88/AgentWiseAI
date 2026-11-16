# Solo Site Rescue Kit

A small, self-contained, **offline-first** tool that helps a solopreneur rescue a website
stranded by a no-code builder shutdown (for example, Mozilla Solo, which announced its
November 30, 2026 shutdown with an export that excludes image source files).

It ingests an exported builder bundle (directory or `.zip`), extracts image references
and contact/newsletter submissions, rescues as many remote image assets as possible,
rewrites references, and produces a clean static site or a Next.js scaffold committed to
a local git repository — plus a single-file HTML report and a migration checklist.

**No paid APIs. No external services required.** Remote rescue is best-effort; the tool
runs fully offline and clearly reports any assets it could not recover.

## Quick start

```bash
# From this subfolder (no install required; zero dependencies):
node bin/solo-rescue.js run ./fixtures/export --out ./rescued-output

# Or via npm script:
npm run cli -- run ./fixtures/export --out ./rescued-output

# Smoke check (runs offline + loopback + next scaffold + git):
npm run smoke
# or: node smoke-check.js
```

The result lands in `<export>.rescued` (or `--out`) and contains:

- `site/` — the rebuilt static site (or `next-app/` for a Next.js scaffold)
- `assets/images/` — rescued and local image files
- `data/submissions.json` — extracted contact/newsletter records (when present)
- `report.html` — single-file, self-contained run report
- `rescue-data.json` — machine-readable run data
- `MIGRATION-CHECKLIST.md` — plain Markdown checklist of what to fix manually

## Why this exists

Builder lock-in is a real risk. When a service like Mozilla Solo shuts down, its export
tool may omit original image files, leaving users unable to fully migrate. This tool:

1. Accepts the export you do have.
2. Rebuilds a clean, portable site.
3. Rescues what it can from URLs (best-effort, cache-backed, offline-capable).
4. Tells you precisely which assets are unrecoverable so you can replace them.
5. Leaves you with a local git commit of the rescued site as a safe snapshot.

## Input formats

`run` accepts either a directory or a `.zip` archive containing:

- **HTML pages** — `.html` / `.htm`. Image references are extracted from `img src`,
  `srcset`, `data-src`, `data-original`, `data-lazy-src`, `poster`, and CSS
  `url(...)` inside inline styles and `<style>` blocks.
- **CSV** — two kinds are detected:
  - **Image link lists** (columns like `image`, `url`, `link`, `src`, or file name
    containing `image`/`img`).
  - **Submissions** (columns like `email`, `name`, `message`, `contact`, `newsletter`,
    or file name containing `submission`/`contact`/`newsletter`).
- **JSON** — strings that look like image URLs are collected; objects containing
  `email`-ish keys are treated as submission records.
- **Images** — `.jpg/.jpeg/.png/.gif/.webp/.svg/.ico/.bmp/.avif/.tif/.tiff` found in the
  export are copied into `assets/images/` so local references keep working.

## Usage

```
solo-rescue run <export-path> [options]
solo-rescue ingest <export-path>          Print inventory summary only
solo-rescue report --from <output-dir>    Regenerate report.html from rescue-data.json
solo-rescue help
solo-rescue --version
```

### `run` options

| Option | Default | Description |
| --- | --- | --- |
| `--out <dir>` | `<export>.rescued` | Output directory |
| `--format <kind>` | `static` | `static` or `next` |
| `--offline` | off | Never fetch remote assets; use cache only |
| `--no-git` | off | Skip git init/commit of the output |
| `--no-report` | off | Skip writing `report.html` |
| `--mask-submissions` | off | Omit submission values from the report (data file kept) |
| `--timeout <ms>` | `8000` | Per-image fetch timeout |
| `--retries <n>` | `1` | Retry count per image |
| `--concurrency <n>` | `4` | Parallel fetch limit |
| `--cache-dir <dir>` | `<out>/.rescue-cache` | Override rescue cache location |
| `--title <text>` | `Rescued Site` | Site title for Next.js scaffold |
| `--git-author "N <e>"` | runtime env | Commit author override |

## How rescue works

Remote (`http(s)://`) image references are fetched and written to `assets/images/` with
content-addressed names (`<name>-<hash>.<ext>`), then every HTML/CSS reference is
rewritten to the local path. Successful downloads are cached in `.rescue-cache/`
(`<hash>.bin` + `<hash>.meta.json`), so a later `--offline` run can reuse them without
network access. Data-URI images are preserved inline. Relative/local references are left
as-is.

When the tool cannot reach a remote image (offline mode, DNS/timeout, 404, etc.), it is
recorded in `rescue-data.json`, `report.html`, and `MIGRATION-CHECKLIST.md` as
**unrecoverable** — the run still succeeds.

## Output structure

```
<out>/
  site/                  # static site (or next-app/ for --format next)
    index.html
    assets/images/…
    data/submissions.json
  assets/images/…        # rescued + copied local images (shared with site)
  .rescue-cache/         # content-addressed fetch cache
  rescue-data.json
  report.html
  MIGRATION-CHECKLIST.md
  .git/                  # if git commit enabled
```

For `--format next`, `next-app/` contains a minimal App Router project (`app/layout.js`,
`app/page.jsx`, one route per HTML page, `public/assets/…`).

## Testing

The smoke check exercises the full pipeline with a bundled fixture export:

- Offline run (no network) — site, checklist, report, and missing-asset reporting.
- Loopback HTTP server rescue — download, rewrite, and cache reuse on an offline re-run.
- Next.js scaffold generation.
- Local git commit with the configured author.

```bash
npm run smoke
```

## Limitations

- No external services or paid APIs. Network rescue is best-effort only.
- Complex builder-specific scripts/widgets are not rewritten beyond image references;
  pages may need manual touch-ups.
- Submission data is preserved as exported; review it for privacy before publishing.
- Not a full CMS migration; it rebuilds static/Next.js markup from exported HTML.
- Large exports load `.zip` entries into memory; for very large archives, extract to a
  directory first.

## License

MIT — see `package.json`.

## About AaronWiseAI

AaronWiseAI builds practical, self-contained tools that solve real problems for
solopreneurs, freelancers, and small businesses. Learn more at
[https://aaronwiseai.com/](https://aaronwiseai.com/).

Part of the AaronWiseAI tool collection — https://aaronwiseai.com/