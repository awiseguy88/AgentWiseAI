import { useEffect, useRef, useState, useCallback } from 'react';

import { createRenderer } from './render/renderer.js';
import { createClock } from './core/clock.js';
import { loadPersisted, savePersisted } from './core/persistence.js';
import type { FlightMode } from './core/types.js';
import { createEarthOrbitScene, initialCameraPosition } from './scene/earthOrbitScene.js';
import { createInputManager } from './controls/input.js';
import { createFlightState } from './flight/modes.js';
import { OverlayRoot } from './ui/OverlayRoot.js';
import * as THREE from 'three';

/**
 * M1 integrated App:
 * - Mounts renderer
 * - Builds Earth-orbit scene
 * - Wires input + flight state (free flight basic movement)
 * - HUD + PauseMenu overlay
 * - Home resets camera
 * - Persistence loaded/saved
 */

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [utcText, setUtcText] = useState(new Date().toUTCString());
  const [mode] = useState<FlightMode>('free');
  const [persisted, setPersisted] = useState(() => loadPersisted());

  const clockRef = useRef<ReturnType<typeof createClock> | null>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const inputRef = useRef<ReturnType<typeof createInputManager> | null>(null);
  const flightRef = useRef<ReturnType<typeof createFlightState> | null>(null);

  // Keep clock paused state in sync with React paused
  useEffect(() => {
    pausedRef.current = paused;
    if (clockRef.current) {
      clockRef.current.state.paused = paused;
    }
  }, [paused]);

  // Update UTC text periodically (1s)
  useEffect(() => {
    const id = setInterval(() => {
      setUtcText(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const { renderer, scene, camera, onResize, dispose } = createRenderer(container);
    rendererRef.current = { renderer, scene, camera, onResize, dispose };
    const clock = createClock();
    clockRef.current = clock;
    const flight = createFlightState('free');
    flightRef.current = flight;

    // Add Earth orbit scene
    const earthGroup = createEarthOrbitScene();
    scene.add(earthGroup);
    const initialPos = initialCameraPosition();
    camera.position.copy(initialPos);

    // Pointer lock state tracking for HUD re-render (handled via React state where needed; HUD reads document.pointerLockElement each render)
    const canvasEl = renderer.domElement as HTMLCanvasElement;
    const onEscape = () => {
      setPaused(true);
    };
    const input = createInputManager(canvasEl, onEscape);
    inputRef.current = input;

    // Mouse look (pointer lock delta → camera rotation)
    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * 0.002;
      euler.x -= e.movementY * 0.002;
      // clamp pitch to avoid flip
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
      camera.quaternion.setFromEuler(euler);
    };
    document.addEventListener('mousemove', onMouseMove);

    onResize();
    window.addEventListener('resize', onResize);

    let rafId: number | null = null;
    const speed = 1000; // units per second (arbitrary M1)
    const rotSpeed = 1.5; // rad/s

    const animate = (now: number): void => {
      const dt = clock.tick(now);
      const state = input.getState();

      if (!pausedRef.current) {
        // Simple free-flight movement
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        const move = new THREE.Vector3(0, 0, 0);
        if (state.forward) move.add(forward);
        if (state.back) move.add(forward.clone().negate());
        if (state.right) move.add(right);
        if (state.left) move.add(right.clone().negate());
        if (state.up) move.add(up);
        if (state.down) move.add(up.clone().negate());
        if (state.brake) {
          // brake: slow down by not moving (or could apply damping) — placeholder effect
        } else {
          camera.position.addScaledVector(move, speed * dt);
        }

        // Roll
        if (state.rollLeft) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), rotSpeed * dt);
          camera.quaternion.multiply(q);
        }
        if (state.rollRight) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), -rotSpeed * dt);
          camera.quaternion.multiply(q);
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouseMove);
      input.dispose();
      dispose();
      scene.remove(earthGroup);
    };
  }, []);

  const handleResume = useCallback(() => {
    setPaused(false);
    // Re-request pointer lock optionally (browser may require user gesture; keep simple)
    // rendererRef.current?.renderer.domElement.requestPointerLock?.();
  }, []);

  const handleHome = useCallback(() => {
    const { camera } = rendererRef.current || {};
    if (camera) {
      const pos = initialCameraPosition();
      camera.position.copy(pos);
      camera.quaternion.identity();
    }
    if (clockRef.current) {
      clockRef.current.state.simTimeSeconds = 0;
    }
    setPaused(false);
  }, []);

  const updatePersisted = useCallback((patch: Partial<typeof persisted>) => {
    setPersisted((prev) => {
      const next = { ...prev, ...patch, settings: { ...prev.settings, ...(patch.settings as any) } };
      savePersisted(next);
      return next;
    });
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#020205',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <OverlayRoot
        mode={mode}
        utcText={utcText}
        paused={paused}
        timeScale={clockRef.current?.state.timeScale ?? 1}
        onResume={handleResume}
        onHome={handleHome}
        onToggleReducedMotion={(v) => updatePersisted({ settings: { ...persisted.settings, reducedMotion: v } })}
        onToggleMuted={(v) => updatePersisted({ settings: { ...persisted.settings, muted: v } })}
        onQualityChange={(v) => updatePersisted({ settings: { ...persisted.settings, qualityPreset: v } })}
        reducedMotion={persisted.settings.reducedMotion}
        muted={persisted.settings.muted}
        qualityPreset={persisted.settings.qualityPreset}
      />
    </div>
  );
}