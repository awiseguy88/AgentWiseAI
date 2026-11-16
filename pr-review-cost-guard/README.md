# PR Review Cost Guard

A local CLI that wraps AI PR-review agent runs and keeps review costs predictable for small dev teams. It scans every PR diff with a cheap local first-pass, sends only flagged hunks to a pricier reviewer, enforces a monthly spend cap that blocks runs over budget, and emits a single HTML/JSON cost report per run — all offline after setup, with no per-review metering by default.

## What it replaces
Per-review AI PR-review SaaS tools (Greptile, CodeRabbit, Qodo) that charge $1–$1.50 per run, plus manual review-cost guessing. A team opening 400 PRs/month can face roughly $400–$667 monthly bills; this tool caps that locally instead.

## Install

```bash
cd pr-review-cost-guard/
npm install
cp .env.example .env
# edit .env to set your models, prices, and MONTHLY_CAP_USD
```

## Usage

Scan a directory of PR diffs (one file per PR, named `pr-NN.diff`):

```bash
npm start scan --diffs test/fixtures/sample-repo --monthly-cap 50 --out outputs/
```

Or generate a diff from a local git repo:

```bash
npm start scan --repo /path/to/repo --pr 12 --monthly-cap 50
```

Set / view the monthly cap (stored locally in `state/budget.json`, no network):

```bash
npm start budget --cap 50
npm start budget
```

### Flags
- `--diffs <dir>` — directory of PR diff files to scan.
- `--repo <dir> --pr <n>` — produce a diff from a local git repo instead.
- `--monthly-cap <usd>` — override the monthly budget cap for this run.
- `--out <dir>` — report output directory (default `outputs/`).
- `--report html|json|both` — which report(s) to emit (default `both`).
- `--commit` — record actual spend into monthly state (only when allowed by the cap).
- `--post <pr-number>` — post a summary comment to a GitHub PR via `gh pr comment` (dry-run preview is always written to `outputs/`; posting needs `gh` + network). The tool never auto-approves or merges.
- `--config <path>` — JSON config overriding env defaults.
- `--state-dir <dir>` — directory for monthly budget state (default cwd).

## Output
Each run writes to `--out/`:
- `cost-guard-report-<run>.json` — machine-readable per-PR estimates and cap status.
- `cost-guard-report-<run>.html` — human-readable single-page report.
- `comment-<run>.md` — ready-to-post summary comment (never includes a merge/approve command).

## Cost model (local estimate only)
- Cheap model scans every hunk (`CHEAP_MODEL`, e.g. claude-haiku-4.5).
- Only flagged hunks go to the pricier model (`PRICIER_MODEL`, e.g. claude-sonnet-4.5).
- Flags (zero-cost local heuristic): secrets/auth, config/infra, dependency changes, large hunks.
- Estimates use a configurable per-1K-token price table; no model is called and no network is made by this tool.

## About AaronWiseAI

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
