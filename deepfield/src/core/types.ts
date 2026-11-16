/**
 * Shared types for the DEEPFIELD core runtime.
 *
 * These are intentionally small and framework-agnostic so they can be
 * reused by the simulation loop, persistence layer, and renderer.
 */

/**
 * Camera/flight mode for the user's viewpoint.
 * - "free"   : free-flying camera (default for M1).
 * - "orbit"  : camera orbits a target body.
 * - "surface": camera is locked to a planetary surface.
 */
export type FlightMode = 'free' | 'orbit' | 'surface';

/**
 * Simulation clock state. All values are plain data so the clock can be
 * copied, reset, or mutated by pure helper functions.
 */
export interface SimClockState {
  paused: boolean;
  simTimeSeconds: number;
  timeScale: number;
  lastRealMs: number;
}

/**
 * User-tunable settings persisted across sessions.
 */
export interface PersistedSettings {
  muted: boolean;
  reducedMotion: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
}

/**
 * Top-level persisted state blob, versioned so future migrations can
 * detect and repair older shapes.
 */
export interface PersistedState {
  version: number;
  settings: PersistedSettings;
  lastVisit: null | { isoTimestamp: string; simTimeSeconds: number };
}