import * as THREE from 'three';
import { BODIES, allBodyPositions } from '../core/ephemeris.js';

export interface SolarSystemScene {
  group: THREE.Group;
  bodyMeshes: Map<string, THREE.Object3D>;
  update: (simTimeSeconds: number) => void;
}

/**
 * Create a solar system scene with Sun, Earth, Moon, Mars, Saturn (+rings).
 * Bodies are positioned each frame via `update(simTimeSeconds)`.
 */
export function createSolarSystemScene(): SolarSystemScene {
  const group = new THREE.Group();
  group.name = 'solar-system-scene';

  const bodyMeshes = new Map<string, THREE.Object3D>();

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 1e12 + Math.random() * 1e12;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1e9, sizeAttenuation: true });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // Sun
  const sunDef = BODIES.find((b) => b.id === 'sun')!;
  const sunGeo = new THREE.SphereGeometry(sunDef.radius, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: sunDef.color });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.name = 'Sun';
  group.add(sun);
  bodyMeshes.set('sun', sun);

  // Sun glow
  const glowGeo = new THREE.SphereGeometry(sunDef.radius * 1.3, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.15 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  // Sun light
  const sunLight = new THREE.PointLight(0xffffff, 2, 0, 0);
  sunLight.position.set(0, 0, 0);
  group.add(sunLight);

  // Planets + moon
  for (const def of BODIES) {
    if (def.id === 'sun') continue;
    const geo = new THREE.SphereGeometry(def.radius, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = def.name;
    group.add(mesh);
    bodyMeshes.set(def.id, mesh);

    if (def.hasRings) {
      const ringGeo = new THREE.RingGeometry(def.ringInner, def.ringOuter, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc9b88a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.name = `${def.name}-rings`;
      group.add(ring);
      bodyMeshes.set(`${def.id}-rings`, ring);
    }
  }

  function update(simTimeSeconds: number): void {
    const positions = allBodyPositions(simTimeSeconds);
    for (const [id, mesh] of bodyMeshes) {
      if (id.endsWith('-rings')) continue;
      const pos = positions.get(id);
      if (pos) {
        mesh.position.set(pos[0], pos[1], pos[2]);
      }
    }
    // Update rings to follow Saturn
    const saturnPos = positions.get('saturn');
    const rings = bodyMeshes.get('saturn-rings');
    if (saturnPos && rings) {
      rings.position.set(saturnPos[0], saturnPos[1], saturnPos[2]);
    }
  }

  return { group, bodyMeshes, update };
}

export function initialCameraPosition() {
  // Low Earth orbit-ish: ~700 km above surface
  return new THREE.Vector3(0, 0, 6.371e6 + 7e5);
}

// Back-compat alias for M1 callers
export const createEarthOrbitScene = createSolarSystemScene;
export type EarthOrbitScene = SolarSystemScene;