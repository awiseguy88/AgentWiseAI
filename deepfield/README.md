# DEEPFIELD — 3D Milky Way Explorer and Planetary Simulator (M1)

A cinematic 3D Milky Way explorer and planetary simulator built with TypeScript, Vite, React, and Three.js (WebGL 2 baseline). M1 delivers the core loop shell: Earth-orbit opener scene, free-flight controls, flight modes, minimal HUD, pause menu, and a versioned persistence scaffold. No accounts, no API keys, bundled data only.

## Run locally
```bash
cd deepfield
npm install
npm run dev
```
Open http://localhost:5173 (Vite opens it automatically).

## Build (static deployable site)
```bash
cd deepfield
npm run build
npm run preview
```
`npm run build` emits `deepfield/dist/` — deployable to any static host (GitHub Pages, Netlify, Vercel).

## Checks
```bash
cd deepfield
npm run typecheck
npm run build
```

## M1 scope (see PLAN.md)
- Core runtime: sim clock, coordinate/frame conventions, floating-origin helper stub, versioned localStorage persistence.
- Renderer: WebGL2 bootstrap with resize handling.
- Scene: Earth-orbit opener (placeholder Earth + starfield).
- Controls: WASD/mouse look, Q/E roll, R/F vertical, Space brake, Esc pause.
- Flight modes shell: free / orbit / surface stubs.
- UI: HUD (UTC, mode, time scale), PauseMenu (resume, Home, reduced motion/mute/quality toggles persisted), pointer-lock hint.
- Home action resets to Earth-orbit start state.

## Next milestones
See [PLAN.md](../PLAN.md) for the full milestone plan (M2–M6).