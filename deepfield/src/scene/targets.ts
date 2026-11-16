import * as THREE from 'three';
import { BODIES, allBodyPositions, distance } from '../core/ephemeris.js';
import type { CelestialBody, Target } from '../core/types.js';

export function listTargets(): CelestialBody[] {
  return BODIES.filter((b) => b.kind !== 'star' || b.id === 'sun');
}

export function searchTargets(query: string): CelestialBody[] {
  const q = query.toLowerCase().trim();
  if (!q) return listTargets();
  return listTargets().filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q));
}

export function nearestTarget(
  cameraPos: THREE.Vector3,
  simTimeSeconds: number
): CelestialBody | null {
  const positions = allBodyPositions(simTimeSeconds);
  let nearest: CelestialBody | null = null;
  let nearestDist = Infinity;
  for (const b of listTargets()) {
    const pos = positions.get(b.id);
    if (!pos) continue;
    const d = distance([cameraPos.x, cameraPos.y, cameraPos.z], pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = b;
    }
  }
  return nearest;
}

export function targetApproach(
  body: CelestialBody,
  cameraPos: THREE.Vector3,
  cameraQuat: THREE.Quaternion,
  simTimeSeconds: number
): Target {
  const positions = allBodyPositions(simTimeSeconds);
  const pos = positions.get(body.id)!;
  const bodyVec = new THREE.Vector3(pos[0], pos[1], pos[2]);
  const toTarget = bodyVec.clone().sub(cameraPos);
  const range = toTarget.length();

  // Bearing (yaw) and elevation (pitch) relative to camera forward
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuat);

  const bearing = Math.atan2(toTarget.dot(right), toTarget.dot(forward));
  const elevation = Math.asin(Math.max(-1, Math.min(1, toTarget.dot(up) / range)));

  return {
    id: body.id,
    body,
    distanceFromCamera: range,
    bearing,
    elevation,
    relativeSpeed: 0, // computed by caller
  };
}

export function bodyPositionVec(bodyId: string, simTimeSeconds: number): THREE.Vector3 {
  const positions = allBodyPositions(simTimeSeconds);
  const pos = positions.get(bodyId) || [0, 0, 0];
  return new THREE.Vector3(pos[0], pos[1], pos[2]);
}