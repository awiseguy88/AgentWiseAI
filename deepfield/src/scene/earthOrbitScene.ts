import * as THREE from 'three';

export function createEarthOrbitScene() {
  const group = new THREE.Group();
  group.name = 'earth-orbit-scene';

  // Stars (simple placeholder)
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 50000 + Math.random() * 50000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 40, sizeAttenuation: true });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // Earth placeholder
  const earthGeo = new THREE.SphereGeometry(6371, 32, 32); // meters-ish units placeholder
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.8 });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.position.set(0, 0, 0);
  earth.name = 'Earth';
  group.add(earth);

  // Lights
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50000, 20000, 30000);
  group.add(sunLight);
  group.add(new THREE.AmbientLight(0x404060, 0.6));

  return group;
}

export function initialCameraPosition() {
  // Low Earth orbit-ish: ~700 km above surface in these units
  return new THREE.Vector3(0, 0, 6371 + 700);
}
