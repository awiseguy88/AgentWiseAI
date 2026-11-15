# Tool Launcher - Build Plan

## Goal
Build a small, self-contained local web page in the workspace that helps users discover built tools: scan workspace folders, read each tool README, list available tools with explanations, and launch each tool in a new tab.

## User-facing behavior
- User runs `npm start` in `tool-launcher/` and opens `http://localhost:3000`.
- The page scans subdirectories of the workspace root (default: parent of `tool-launcher/`) and lists folders that contain a `README.md`.
- Each listed tool shows: title (from first README heading), folder name, and a short explanation extracted from the README.
- Each tool has a **Launch in new tab** action that opens `/tool/<id>` in a new browser tab, rendering that tool's README.
- Hidden folders, `node_modules`, and the `tool-launcher` folder itself are excluded.

## Files
- `PLAN.md` - this build plan.
- `package.json` - dependencies and scripts (`start`, `test`).
- `server.js` - Express server: workspace scanning, README parsing/title-summary extraction, API endpoints (`/api/tools`, `/api/tools/:id`), launch page (`/tool/:id`), static file serving.
- `public/index.html` - single-page launcher UI that fetches `/api/tools` and renders tool cards with launch links (`target="_blank"`).
- `README.md` - setup, usage, behavior, and API/test documentation.
- `test/smoke.test.js` - Node test smoke checks against a temporary workspace and HTTP endpoints.
- `docs/after-tool-launcher.png` - captured after-state UI evidence of the running launcher.

## Modules / components
- **Scanner/parsing module (in `server.js`)**: `readReadme`, `extractTitleAndSummary`, `scanTools`, `isSafeToolId` - filesystem scan and README-to-metadata extraction.
- **HTTP/UI module (in `server.js` + `public/index.html`)**: Express routes and frontend rendering/launch behavior.
- **Verification**: smoke test exercising scan/extraction logic and HTTP endpoints; manual run to confirm UI and launch behavior.

## Test strategy
- Automated smoke tests (`node --test test/smoke.test.js`):
  - Create a temporary workspace with sample tool folders/READMEs, including cases to exclude (no README, hidden folder).
  - Verify discovered tools, title/summary extraction, and launch URL generation.
  - Start the app on an ephemeral port and verify `/api/tools`, `/api/tools/:id`, and `/tool/:id` responses.
- Manual smoke check: start server, load UI, confirm tools are listed from workspace READMEs and launch opens rendered README in a new tab.

## Acceptance checks
- [x] Tool lives in its own subfolder (`tool-launcher/`) with README and tests/smoke check.
- [x] Scans workspace folders and reads each README automatically.
- [x] Lists available built tools with explanations (title + summary from README).
- [x] Launches each tool in a new tab.
- [x] Independent of other tools; no harness or unrelated workspace modifications.
- [x] Commits use runtime-configured repository author identity.
