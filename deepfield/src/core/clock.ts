import type { SimClockState } from './types.js';

/**
 * Simulation clock. Framework-agnostic: it only knows about wall-clock
 * time (ms) and exposes a sim-time delta (seconds) per tick.
 *
 * Callers (React, a game loop, tests) pass `performance.now()`-style
 * timestamps to `tick()` and apply the returned dt to their simulation.
 */
export interface Clock {
  state: SimClockState;
  tick(realNowMs: number): number;
}

/**
 * Create a clock starting at sim time 0, running at 1x real-time.
 */
export function createClock(): Clock {
  const state: SimClockState = {
    paused: false,
    simTimeSeconds: 0,
    timeScale: 1,
    lastRealMs: performance.now(),
  };

  return {
    state,
    tick(realNowMs: number): number {
      const realDt = (realNowMs - state.lastRealMs) / 1000;
      state.lastRealMs = realNowMs;

      if (state.paused) {
        return 0;
      }

      const dtSim = realDt * state.timeScale;
      state.simTimeSeconds += dtSim;
      return dtSim;
    },
  };
}

/**
 * Toggle the paused flag on the given state object (pure helper).
 */
export function togglePause(state: SimClockState): void {
  state.paused = !state.paused;
}

/**
 * Set the time scale (pure helper). Clamped to a sane range to avoid
 * runaway sim drift in either direction.
 */
export function setTimeScale(state: SimClockState, scale: number): void {
  if (!Number.isFinite(scale)) {
    return;
  }
  state.timeScale = Math.min(10, Math.max(0, scale));
}

/**
 * Reset a clock to its initial values (pure helper).
 */
export function resetClock(state: SimClockState): void {
  state.paused = false;
  state.simTimeSeconds = 0;
  state.timeScale = 1;
  state.lastRealMs = performance.now();
}