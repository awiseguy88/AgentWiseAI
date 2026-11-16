/**
 * Three.js renderer bootstrap.
 *
 * Exposes a minimal WebGL2 renderer + empty scene + perspective camera
 * for the M1 core. Resizing is handled via `onResize`, wired to the
 * window resize event by the consumer (App).
 */
import * as THREE from 'three';

export interface RendererAPI {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  onResize: () => void;
  dispose: () => void;
}

export function createRenderer(container: HTMLElement): RendererAPI {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'default',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e9);
  camera.position.set(0, 0, 0);

  function onResize(): void {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function dispose(): void {
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { renderer, scene, camera, onResize, dispose };
}