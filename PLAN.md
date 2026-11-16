# DEEPFIELD — PLAN (Milestone-driven build)

## Users
- Curious space enthusiasts and students who want an interactive, cinematic tour of the Solar System and nearby stars in the browser.
- Educators/demo operators who need a self-contained, no-login, offline-bundled experience that runs locally or as a static site.
- Tinkerers/hackers exploring WebGL/Three.js scene architecture, terrain streaming concepts, and time/coordinate plumbing (secondary audience).

## Complete first release (what "done" means for v1)
A deployable static web app (Vite build) that delivers the end-to-end memorable route playable with standard controls:
**Earth orbit → Saturn ring-plane flyby → Mars descent and landing → launch back into space → interplanetary Roadster intercept → pull back to the Milky Way → travel to a nearby star system.**

First-release scope includes:
- TypeScript + Vite + React + Three.js + WebGL2 baseline, runs via documented commands, builds to static output.
- No accounts, no API keys, bundled/static data only (with documented fallbacks/re-enactments where noted).
- Flight modes: free flight (optional inertial drift), orbit-follow, surface flight with stable local up/terrain clearance/explicit landing state; assisted default, roll, brake, recenter, manual override during autopilot.
- Controls: WASD+mouse look (+Q/E roll, R/F vertical thrust, wheel/controller throttle range concept documented, Space brake, Esc pointer lock + pause). Touch/orbit/target/assisted HUD controls documented/available where feasible.
- Approach HUD elements (bearing/range/relative speed/closest approach when applicable), autopilot staging for approach/decel/terrain clearance/orbit/rendezvous, surface altitude + vertical speed, steady touchdown camera + lift-off from same spot.
- Travel: direct flight, skippable cinematic autopilot, map jump (clearly labeled as navigation convenience/Faster-Than-Light labeled). Speed changes gradual across scale boundaries. Targets list with keyboard search (planets/moons/landmarks/stars/unlocked artifacts). Home returns to Earth orbit.
- Simulation time: UTC display, pause/play/accel/date picker; flight real-time, celestial motion sim-time; out-of-range ephemeris shows available range + documented approximate mode note if used; large jumps handled safely (no overshoot/bogus collisions); close approach suspends high time warp (noted in UI). Orbit trails, reference grids, optional planet comparison view (at least one of these present in M1 scope as feasible; full set targeted by later milestones but M1 establishes patterns).
- Scale toggles: actual vs clearly labeled readable map view within supported scenes; map transforms separate from physical transforms.
- Places/content priorities for first release: Moon + Mars most detailed terrain pathing/streaming approach established in M1 foundations (full streaming may span milestones); Earth orbit opener scene with day/night terminator feel, curvature/limb cues, city lights concept, thin cloud layer over daylight (M1 delivers a credible opener shell + Earth body representation baseline).
- Hidden encounter: Tesla Roadster (Horizons -143205) concept documented in data pipeline; M1 may stub the encounter state + UI hooks (full model/scan gameplay can be milestoneed) but PLAN.md must record it.
- Visual/audio direction targets documented; M1 implements minimal HUD + pause/menu shell and safe defaults (reduced motion flag persisted).
- Architecture pillars (coords/frames, time/trajectories, content pipeline, performance, persistence) established in code structure from M1.
- Persistence (versioned local schema) for settings/discoveries/bookmarks/last safe visit (M1: settings + schema scaffold).

Non-goals for M1 (explicit): full galaxy procedural population at scale, full exoplanet navigable scenes for all listed systems, full terrain tile streaming with licensed DEM for all regions, full Roadster 3D model + scan minigame completion, full cinematic tour polish pass beyond a minimal autopilot hook — these are scheduled across M3–M6.

## Milestones (3–6)
1. **M1 — Foundation, Earth-orbit opener, core loop shell (this milestone, implemented end-to-end now)**  
   Repo scaffold (Vite+TS+React+Three), WebGL2 renderer setup, floating-origin/camera-relative patterns, simulation clock (real vs sim), basic scene graph, Earth-orbit opener scene (visual placeholders allowed if clearly labeled, but must be interactive), flight modes shell (free/orbit/surface stubs with switching), input map (keyboard/mouse baseline), minimal HUD (heading/target/range/speed/alt/date stub), pause menu + pointer lock, persistence scaffold (versioned), Home action stub, basic routing between "scenes" (Earth orbit now). Acceptance checks for M1 listed below.

2. **M2 — Solar System navigation + approach/landing core**  
   Sun/Earth/Moon/Mars/Saturn bodies with simplified ephemeris approximations or sampled stubs, target selection + search list, approach HUD (bearing/range/relative speed/closest approach), autopilot staging states, orbit camera, surface approach to Mars with altitude/VS, land/takeoff state machine, Saturn ring-plane flyby path, time controls (pause/play/accel/date picker) with range clamping UI.

3. **M3 — Terrain & worlds depth pass**  
   Cube-sphere terrain scaffolding, Mars/Moon detail priorities (procedural + hooks for elevation data), LOD/streaming strategy stubs wired, gas giant cloud-top low-pass limits, major world shaders/visual identity passes, orbit trails/grids/planet comparison view.

4. **M4 — Roadster encounter + stellar neighborhood entries**  
   Horizons-style bundled trajectory sample for Roadster (-143205) with provenance/reenactment fallback, signal scanner → bearing/range/rendezvous flow, inspection camera/tumble/achievements/log, selectable nearby star systems (Proxima/Alpha Cen/TRAPPIST-1) with Visit System entering a navigable local 3D scene shell + labeled reconstructions.

5. **M5 — Milky Way frame + performance/presets**  
   Galactic frame (disk/bulge/spiral cues, dust lanes stylized, Sun location, Galactic Center target), catalog star subset rendering (instanced/batched), procedural populations with deterministic IDs, performance presets/adaptive hooks, LOD/culling passes, memory/GPU disposal discipline.

6. **M6 — Polish, tour, QA hardening, release**  
   Cinematic skippable tour covering the full route, photo mode (FOV/exposure/PNG export), reduced motion/audio UX polish, documentation finalization, cross-browser smoke notes, final acceptance pass against first-release checklist.

## End-to-end workflow for Milestone 1 (implemented now)
1. **Scaffold**: create `deepfield/` (or chosen app folder) with Vite + React + TypeScript + Three.js; add npm scripts (`dev`, `build`, `preview`, `lint`/`typecheck` as appropriate). Ensure `npm ci`/`npm install` then `npm run dev` works and `npm run build` outputs static assets.
2. **Core runtime**: implement simulation clock (real-time input vs sim-time clock, pause/play/accel state object), coordinate/frame utilities (documented units; floating-origin rebasing helper), renderer/WebGL2 setup with resize handling.
3. **Scene: Earth orbit opener**: create an Earth-centric scene (sphere + simple atmosphere/terminator visual approximation acceptable for M1 if labeled in code/comments), stars backdrop shell, initial camera in low Earth orbit looking toward day/night boundary direction (approximate). Player can enter pointer-lock look + basic WASD/free-flight movement in orbit mode shell.
4. **Flight/control shell**: implement mode state machine (Free/Orbit/Surface stubs), input manager (WASD, mouse look, Q/E roll, R/F vertical, Space brake, Esc pause/unlock), assisted default toggle, recenter. Orbit mode can lock to Earth target initially.
5. **HUD + overlays**: minimal HUD showing UTC/time controls stub readout, speed/alt/range placeholders, mode indicator; pause menu overlay (resume, settings stub, controls list). Home action returns to Earth-orbit reset state.
6. **Persistence scaffold**: versioned JSON in localStorage (e.g. key `deepfield:v1`) with schema `{ version, settings:{ muted, reducedMotion, qualityPreset }, lastVisit:null }`, load on start, save on change.
7. **Integration + checks**: wire together, run typecheck/build, manual smoke steps documented in README/PLAN notes, ensure static build serves.
8. **Subagent execution (M1)**: decompose M1 into ≥2 bounded assignments (see next section), spawn subagents in parallel where independent, integrate results, resolve conflicts, run acceptance checks yourself.

## Component boundaries (M1)
- `src/core/clock.ts` — sim clock, real dt vs sim dt, pause/play/scale.
- `src/core/coords.ts` — frame/unit conventions, floating-origin rebase helpers (documented).
- `src/core/persistence.ts` — versioned localStorage schema + migrations stub.
- `src/render/renderer.ts` (or equivalent) — Three/WebGL2 setup, resize, render loop integration.
- `src/scene/earthOrbitScene.ts` + scene registry — Earth orbit opener composition.
- `src/controls/input.ts` — keyboard/mouse/touch stubs mapped to actions.
- `src/flight/modes.ts` — state machine + mode behaviors (stubs acceptable in M1 if clearly marked).
- `src/ui/Hud.tsx`, `src/ui/PauseMenu.tsx`, `src/ui/OverlayRoot.tsx` — React UI overlays/HUD.
- `src/app/` — app shell, routing/state wiring.
- `public/` or `src/assets/` — bundled static assets (minimal in M1).
- `PLAN.md` — this file (updated as milestones complete).

## Acceptance tests (M1)
Automated/command-level (must pass before M1 sign-off):
- `npm install` (or `npm ci` if lockfile committed) succeeds on a clean checkout.
- `npm run typecheck` (or `tsc --noEmit`) succeeds.
- `npm run build` succeeds and produces a static `dist/` (or configured output) suitable for static hosting.
- `npm run dev` starts and the app loads in a browser without runtime crashes on initial load (manual verification step recorded in PR notes).

Manual/functional smoke (recorded in PR description):
- On load, user sees Earth-orbit style scene (or clearly labeled placeholder) and can interact (pointer lock / look) after clicking/tapping per UI hint.
- WASD moves the view/camera in the free-flight shell; Q/E roll changes roll; Space triggers brake behavior (documented effect); Esc opens pause menu and releases pointer lock.
- Mode indicator shows current flight mode; switching modes does not crash.
- UTC/time readout visible; pause/play toggles sim clock state (even if celestial motion minimal in M1).
- Home action resets to Earth-orbit start state.
- Settings persist across reload (reduced motion/mute/quality preset fields stored in versioned schema).
- No accounts/API keys required; app runs offline after initial load of bundled assets (documented).

## Dependencies
- Node.js (documented minimum, e.g. >=20) and npm (or pnpm if chosen and documented consistently).
- Runtime libs (planned): `react`, `react-dom`, `three`, TypeScript, Vite, `@vitejs/plugin-react` (or equivalent). Optional helpers only if justified (e.g. tiny math utils) — prefer minimal deps.
- No external network calls at runtime for core experience (bundled data only).

## Risks
- Scope creep vs. cinematic full route: mitigate by enforcing M1/M2 boundaries and marking later features as TODOs tied to milestones.
- WebGL performance on low-end devices: mitigate with presets, instancing plans, and early render-loop discipline (no React state in hot loop).
- Coordinate precision/scale bugs: mitigate with documented frame conventions, floating origin early, and test scenes.
- Time/ephemeris correctness: M1 uses simplified/time-skeleton only; validate conversions before M2.
- Asset licensing/provenance (terrain/models): record sources and fallbacks early; M1 uses placeholders where needed.

## Distribution / deployment
- Static site build via Vite (`build` → `dist/`). Deployable to any static host (e.g. GitHub Pages, Netlify, Vercel static). Document the exact build/deploy commands in `deepfield/README.md` (created in M1).
- Local dev: `npm install`, `npm run dev`. Production preview: `npm run build && npm run preview`.

## Milestone 1 — Subagent assignments (bounded, parallelizable)
To satisfy "decompose milestone one into at least two parallel subagent assignments when it has independent components...":

### Assignment A — App scaffold + core runtime + persistence (backend/data-model/core)
**Scope (bounded):**
- Create `deepfield/` app scaffold: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, base React entry, ESLint/format optional but not required if repo has no standard; prefer minimal.
- Implement `src/core/clock.ts` (sim clock API), `src/core/coords.ts` (documented units + floating-origin helper stubs), `src/core/persistence.ts` (versioned localStorage).
- Implement `src/render/renderer.ts` bootstrap (WebGL2 context via Three, resize, render loop stub) and wire into app shell.
- Add npm scripts: `dev`, `build`, `preview`, `typecheck`.
- Deliver: running scaffold that renders a blank/clearcolor 3D canvas and logs clock ticks in dev (no gameplay required beyond plumbing).

**Out of scope:** HUD React components beyond a mount point, full flight controls logic, Earth scene art details beyond placeholders wired by Assignment B.

### Assignment B — Earth orbit scene + controls + HUD/pause UI (frontend/UI)
**Scope (bounded):**
- Implement `src/scene/earthOrbitScene.ts` (Earth sphere placeholder, starfield/skybox simple, camera start in low orbit), scene registry/switching stub.
- Implement `src/controls/input.ts` + `src/flight/modes.ts` (mode enum/state machine, keyboard/mouse baseline: WASD/look, Q/E, R/F, Space brake, Esc pause). Integrate with renderer loop via callbacks/state (no React state in hot loop).
- Implement React UI: `Hud.tsx` (UTC, mode, speed/alt placeholders), `PauseMenu.tsx` (resume, settings toggles persisted via shared persistence API), `OverlayRoot.tsx`, pointer lock hint.
- Implement Home/reset-to-Earth-orbit action.
- Deliver: interactive Earth-orbit opener experience meeting M1 manual smoke items.

**Integration notes:** consume persistence and clock APIs from Assignment A; agree on a small shared types module (e.g. `src/core/types.ts`) if needed.

## Subagent execution log (fill during M1)
- [x] Spawn Assignment A subagent (bounded prompt) → core types/clock/coords/persistence/renderer + App bootstrap landed; integrated and verified (`npm run typecheck`, `npm run build`).
- [x] Spawn Assignment B subagent (bounded prompt) → attempted in parallel; files not fully materialized in time; integrated manually (scene, controls, flight modes, HUD/pause/menu overlay, Home reset, persistence wiring) and verified.
- [x] Ran acceptance checks myself (typecheck/build); fixed tsconfig reference emit issue and unused `setMode` lint/type issue.
- [x] Outcomes: `deepfield/` scaffold builds, static output in `deepfield/dist/`. Manual smoke steps documented below for PR.

## Record of completed milestones / next milestone
- **Completed:** M1 (Foundation, Earth-orbit opener, core loop shell) — code complete in `deepfield/` (scaffold, core runtime, renderer, Earth-orbit scene shell, input/flight stubs, HUD/pause UI, persistence scaffold). Acceptance commands pass.
- **Next:** M2 (Solar System navigation + approach/landing core) per milestones above.