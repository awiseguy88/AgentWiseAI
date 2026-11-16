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

/* ------------------------------------------------------------------ *
 * M2 additions — Solar System navigation + approach/landing core
 * ------------------------------------------------------------------ */

/** A celestial body in the solar system. All distances in meters. */
export interface CelestialBody {
  id: string;
  name: string;
  kind: 'star' | 'planet' | 'moon' | 'dwarf' | 'ring';
  radius: number;          // meters
  semiMajorAxis: number;   // meters (0 for star at origin)
  orbitalPeriod: number;   // seconds (0 for stationary)
  inclination: number;     // radians
  eccentricity: number;    // 0..1
  argumentOfPerihelion: number; // radians
  meanAnomaly0: number;    // radians at simTimeSeconds = 0
  spinPeriod: number;      // seconds (0 = no rotation)
  color: number;           // hex color for placeholder rendering
  atmosphere: boolean;
  hasRings: boolean;
  ringInner: number;       // meters (0 if none)
  ringOuter: number;       // meters (0 if none)
  surfaceGravity: number;  // m/s^2 (0 for gas/airless)
  atmosphereHeight: number;// meters (0 if none)
}

/** A selectable target in the navigation list. */
export interface Target {
  id: string;
  body: CelestialBody;
  distanceFromCamera: number; // meters (updated each frame)
  bearing: number;            // radians (yaw relative to camera forward)
  elevation: number;          // radians (pitch relative to camera forward)
  relativeSpeed: number;      // m/s (approximate)
}

/** Autopilot staging states for approach/landing. */
export type AutopilotStage =
  | 'idle'
  | 'approach'     // closing in on target
  | 'decel'        // slowing for capture
  | 'terrainClear' // surface approach, altitude hold
  | 'orbit'        // locked in orbit
  | 'rendezvous'   // matching velocity with target
  | 'landing'      // descending to surface
  | 'takeoff';     // ascending from surface

/** Flight stage state machine data (M2). */
export interface FlightStage {
  mode: FlightMode;
  autopilot: AutopilotStage;
  assisted: boolean;
  targetId: string | null;
  altitude: number;        // meters above surface (0 on surface)
  verticalSpeed: number;   // m/s (positive = climbing)
  speed: number;           // m/s (relative to target)
  range: number;           // meters (distance to target center)
  bearing: number;         // radians
  elevation: number;       // radians
  closestApproach: number; // meters (predicted)
  lastSafeVisit: null | { isoTimestamp: string; simTimeSeconds: number };
}

/** Time control presets offered in the pause menu. */
export type TimePreset = 'realtime' | '10x' | '60x' | '1000x' | 'date';