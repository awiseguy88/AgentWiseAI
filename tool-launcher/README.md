# Tool Launcher

A small local web page that lists available built tools in the GitHub Agent workspace, explains each one, and launches it in a new tab.

## What it does

- Scans workspace folders (subdirectories of the workspace root).
- Reads each folder's `README.md` automatically.
- Lists tools that have a README with a title and short explanation extracted from the README.
- Provides a **Launch in new tab** action for each tool, opening a rendered view of that tool's README.

The launcher excludes hidden folders, `node_modules`, and its own folder from the tool list.

## Setup

```bash
cd tool-launcher
npm install
```

## Run

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

By default it scans the parent directory of `tool-launcher/` as the workspace root. To scan a different workspace, set `WORKSPACE_ROOT`:

```bash
WORKSPACE_ROOT=/path/to/workspace npm start
```

You can also set `PORT` (default `3000`).

## API

- `GET /api/tools` — returns the scanned workspace root and the list of discovered tools (`id`, `folder`, `title`, `summary`, `launchUrl`).
- `GET /api/tools/:id` — returns details and raw README content for one tool.
- `GET /tool/:id` — renders a tool's README in a new tab (used by the Launch action).

## Tests / smoke check

```bash
npm test
```

Runs a Node smoke test that creates a temporary workspace with sample tool folders/READMEs, verifies scanning and README extraction, and checks the HTTP endpoints.
