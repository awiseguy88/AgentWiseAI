import type { CelestialBody } from './types.js';

/**
 * Simplified solar system body catalogue for M2.
 *
 * Scales: 1 unit = 1 meter (physical). We use real-ish radii and orbits so
 * the camera starts in low Earth orbit (~700 km) and the planets are
 * separated by real distances. Orbital motion is propagated via a simple
 * two-body circular approximation driven by sim time.
 */

const AU = 1.495978707e11; // meters
const DAY = 86400; // seconds

export const BODIES: CelestialBody[] = [
  {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    radius: 6.957e8,
    semiMajorAxis: 0,
    orbitalPeriod: 0,
    inclination: 0,
    eccentricity: 0,
    argumentOfPerihelion: 0,
    meanAnomaly0: 0,
    spinPeriod: 25.05 * DAY,
    color: 0xffdd44,
    atmosphere: false,
    hasRings: false,
    ringInner: 0,
    ringOuter: 0,
    surfaceGravity: 274,
    atmosphereHeight: 0,
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'planet',
    radius: 6.371e6,
    semiMajorAxis: 1 * AU,
    orbitalPeriod: 365.25 * DAY,
    inclination: 0.0,
    eccentricity: 0.0167,
    argumentOfPerihelion: 0,
    meanAnomaly0: 0,
    spinPeriod: 0.997 * DAY,
    color: 0x2244aa,
    atmosphere: true,
    hasRings: false,
    ringInner: 0,
    ringOuter: 0,
    surfaceGravity: 9.80665,
    atmosphereHeight: 1e5,
  },
  {
    id: 'moon',
    name: 'Moon',
    kind: 'moon',
    radius: 1.737e6,
    semiMajorAxis: 3.844e8,
    orbitalPeriod: 27.32 * DAY,
    inclination: 5.145 * Math.PI / 180,
    eccentricity: 0.0549,
    argumentOfPerihelion: 0,
    meanAnomaly0: 0,
    spinPeriod: 27.32 * DAY,
    color: 0x999999,
    atmosphere: false,
    hasRings: false,
    ringInner: 0,
    ringOuter: 0,
    surfaceGravity: 1.62,
    atmosphereHeight: 0,
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    radius: 3.3895e6,
    semiMajorAxis: 1.52366 * AU,
    orbitalPeriod: 686.98 * DAY,
    inclination: 1.85 * Math.PI / 180,
    eccentricity: 0.0934,
    argumentOfPerihelion: 0,
    meanAnomaly0: 2.0,
    spinPeriod: 1.026 * DAY,
    color: 0xcc5533,
    atmosphere: true,
    hasRings: false,
    ringInner: 0,
    ringOuter: 0,
    surfaceGravity: 3.72076,
    atmosphereHeight: 1.1e5,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'planet',
    radius: 5.8232e7,
    semiMajorAxis: 9.582 * AU,
    orbitalPeriod: 10759 * DAY,
    inclination: 2.485 * Math.PI / 180,
    eccentricity: 0.0556,
    argumentOfPerihelion: 0,
    meanAnomaly0: 4.5,
    spinPeriod: 0.444 * DAY,
    color: 0xd9b38c,
    atmosphere: true,
    hasRings: true,
    ringInner: 6.69e7,
    ringOuter: 1.39e8,
    surfaceGravity: 10.44,
    atmosphereHeight: 1e6,
  },
];

export function bodyById(id: string): CelestialBody | undefined {
  return BODIES.find((b) => b.id === id);
}

/**
 * Simplified circular orbit position (heliocentric for planets, geocentric
 * for moon). Returns [x, y, z] in meters.
 */
export function bodyPosition(
  body: CelestialBody,
  simTimeSeconds: number,
  parentPosition: [number, number, number] = [0, 0, 0]
): [number, number, number] {
  if (body.semiMajorAxis === 0 || body.orbitalPeriod === 0) {
    // Stationary (Sun) — apply spin but no orbital motion
    return [parentPosition[0], parentPosition[1], parentPosition[2]];
  }

  const angle =
    body.meanAnomaly0 +
    (2 * Math.PI * simTimeSeconds) / body.orbitalPeriod;

  const r = body.semiMajorAxis * (1 - body.eccentricity);
  const x = parentPosition[0] + r * Math.cos(angle);
  const y = parentPosition[1] + r * Math.sin(body.inclination) * Math.sin(angle);
  const z = parentPosition[2] + r * Math.sin(angle);

  return [x, y, z];
}

/**
 * Compute positions for all bodies at a given sim time.
 * Returns a Map from body id to [x, y, z].
 */
export function allBodyPositions(simTimeSeconds: number): Map<string, [number, number, number]> {
  const map = new Map<string, [number, number, number]>();
  map.set('sun', [0, 0, 0]);

  const earth = BODIES.find((b) => b.id === 'earth')!;
  const earthPos = bodyPosition(earth, simTimeSeconds, [0, 0, 0]);
  map.set('earth', earthPos);

  const moon = BODIES.find((b) => b.id === 'moon')!;
  const moonPos = bodyPosition(moon, simTimeSeconds, earthPos);
  map.set('moon', moonPos);

  const mars = BODIES.find((b) => b.id === 'mars')!;
  map.set('mars', bodyPosition(mars, simTimeSeconds, [0, 0, 0]));

  const saturn = BODIES.find((b) => b.id === 'saturn')!;
  map.set('saturn', bodyPosition(saturn, simTimeSeconds, [0, 0, 0]));

  return map;
}

/**
 * Distance between two 3D points in meters.
 */
export function distance(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}