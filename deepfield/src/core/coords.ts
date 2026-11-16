import type * as THREE from 'three';

/**
 * Coordinate conventions (documented here so the whole team is aligned):
 *
 * - Internally, all positions use **meters** for physical quantities
 *   (distances between stars, planet radii, orbit altitudes, etc.).
 * - For M1 we use arbitrary scene units until real scales are wired up;
 *   the comments below keep that intent explicit.
 * - The world origin (0,0,0) is the Solar-System barycentre. When the
 *   camera drifts far from the origin, floating-point precision degrades,
 *   so `floatOriginRebase` recentres the world around the camera.
 */

/**
 * M1 stub for origin rebasing.
 *
 * If the camera is farther than `thresholdMeters` from the world origin,
 * translate every object in `objects` by `-camera.position` and then reset
 * the camera to the origin. This keeps the active region near (0,0,0)
 * for better precision.
 *
 * TODO: refine in a later milestone — track a persistent world offset,
 * preserve object world matrices, and avoid per-frame jitter.
 */
export function floatOriginRebase(
  camera: THREE.Camera,
  objects: THREE.Object3D[],
  thresholdMeters: number
): void {
  const dist = camera.position.length();

  if (dist <= thresholdMeters) {
    return;
  }

  const offset = camera.position.clone().negate();
  for (const obj of objects) {
    obj.position.add(offset);
  }
  camera.position.set(0, 0, 0);
}