import { useEffect, useRef, useState, useCallback } from 'react';

import { createRenderer } from './render/renderer.js';
import { createClock } from './core/clock.js';
import { loadPersisted, savePersisted } from './core/persistence.js';
import type { FlightMode, FlightStage } from './core/types.js';
import { createSolarSystemScene } from './scene/earthOrbitScene.js';
import { createInputManager } from './controls/input.js';
import { createFlightState } from './flight/modes.js';
import { OverlayRoot } from './ui/OverlayRoot.js';
import { listTargets, targetApproach, bodyPositionVec } from './scene/targets.js';
import { bodyById } from './core/ephemeris.js';
import * as THREE from 'three';

const SPEED = 1e6; // meters per second (spacecraft-ish)
const ROT_SPEED = 1.5; // rad/s

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [utcText, setUtcText] = useState(new Date().toUTCString());
  const [mode, setMode] = useState<FlightMode>('free');
  const [persisted, setPersisted] = useState(() => loadPersisted());
  const [timeScale, setTimeScaleState] = useState(1);
  const [stage, setStage] = useState<FlightStage | null>(null);

  const clockRef = useRef<ReturnType<typeof createClock> | null>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const inputRef = useRef<ReturnType<typeof createInputManager> | null>(null);
  const flightRef = useRef<ReturnType<typeof createFlightState> | null>(null);
  const sceneApiRef = useRef<ReturnType<typeof createSolarSystemScene> | null>(null);
  const targetIdRef = useRef<string | null>(null);

  // Keep clock paused state in sync with React paused
  useEffect(() => {
    pausedRef.current = paused;
    if (clockRef.current) {
      clockRef.current.state.paused = paused;
    }
  }, [paused]);

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

    const sceneApi = createSolarSystemScene();
    sceneApiRef.current = sceneApi;
    scene.add(sceneApi.group);

    const initialPos = new THREE.Vector3(0, 0, 6.371e6 + 7e5);
    camera.position.copy(initialPos);

    const canvasEl = renderer.domElement as HTMLCanvasElement;
    const onEscape = () => setPaused(true);
    const input = createInputManager(canvasEl, onEscape);
    inputRef.current = input;

    // Target cycle key (Tab)
    const onTab = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        const ids = listTargets().map((b) => b.id);
        const next = flight.cycleTarget(ids);
        targetIdRef.current = next;
        flight.setTargetId(next);
        // Switch to orbit mode when a target is selected
        if (next) {
          flight.setMode('orbit');
          setMode('orbit');
        } else {
          flight.setMode('free');
          setMode('free');
        }
      }
    };
    window.addEventListener('keydown', onTab);

    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * 0.002;
      euler.x -= e.movementY * 0.002;
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
      camera.quaternion.setFromEuler(euler);
    };
    document.addEventListener('mousemove', onMouseMove);

    onResize();
    window.addEventListener('resize', onResize);

    let rafId: number | null = null;

    const animate = (now: number): void => {
      const dt = clock.tick(now);
      const state = input.getState();

      if (!pausedRef.current) {
        sceneApi.update(clock.state.simTimeSeconds);

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
        if (!state.brake) {
          camera.position.addScaledVector(move, SPEED * dt);
        }

        if (state.rollLeft) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), ROT_SPEED * dt);
          camera.quaternion.multiply(q);
        }
        if (state.rollRight) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), -ROT_SPEED * dt);
          camera.quaternion.multiply(q);
        }

        // Orbit camera: if a target is selected, gently orbit around it
        const tid = targetIdRef.current;
        if (tid && mode === 'orbit') {
          const targetPos = bodyPositionVec(tid, clock.state.simTimeSeconds);
          const offset = camera.position.clone().sub(targetPos);
          // slow orbit around target
          const angle = 0.1 * dt;
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          camera.position.copy(targetPos.clone().add(offset));
          camera.lookAt(targetPos);
        }
      }

      // Compute approach HUD
      const tid = targetIdRef.current;
      if (tid) {
        const body = bodyById(tid);
        if (body) {
          const ap = targetApproach(body, camera.position, camera.quaternion, clock.state.simTimeSeconds);
          const nextStage: FlightStage = {
            ...flight.toStage(),
            targetId: tid,
            altitude: 0,
            range: ap.distanceFromCamera,
            bearing: ap.bearing,
            elevation: ap.elevation,
            speed: 0,
            verticalSpeed: 0,
            closestApproach: ap.distanceFromCamera,
            mode,
            autopilot: flight.getAutopilot(),
            assisted: flight.isAssisted(),
          };
          setStage(nextStage);
        }
      } else {
        setStage(flight.toStage());
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onTab);
      document.removeEventListener('mousemove', onMouseMove);
      input.dispose();
      dispose();
      scene.remove(sceneApi.group);
    };
  }, [mode]);

  const handleResume = useCallback(() => {
    setPaused(false);
  }, []);

  const handleHome = useCallback(() => {
    const { camera } = rendererRef.current || {};
    if (camera) {
      const pos = new THREE.Vector3(0, 0, 6.371e6 + 7e5);
      camera.position.copy(pos);
      camera.quaternion.identity();
    }
    if (clockRef.current) {
      clockRef.current.state.simTimeSeconds = 0;
      clockRef.current.state.paused = false;
    }
    setPaused(false);
    targetIdRef.current = null;
    if (flightRef.current) flightRef.current.setTargetId(null);
  }, []);

  const updatePersisted = useCallback((patch: Partial<typeof persisted>) => {
    setPersisted((prev) => {
      const next = { ...prev, ...patch, settings: { ...prev.settings, ...(patch.settings as any) } };
      savePersisted(next);
      return next;
    });
  }, []);

  const handleTimeScale = useCallback((v: number) => {
    if (clockRef.current) {
      clockRef.current.state.timeScale = v;
    }
    setTimeScaleState(v);
  }, []);

  const handleJumpDate = useCallback((isoDate: string) => {
    if (!isoDate || !clockRef.current) return;
    const target = new Date(isoDate + 'T00:00:00Z').getTime();
    const now = Date.now();
    const deltaSec = (target - now) / 1000;
    // Convert wall-clock delta to sim seconds via current time scale (1x baseline)
    clockRef.current.state.simTimeSeconds = Math.max(0, clockRef.current.state.simTimeSeconds + deltaSec);
  }, []);

  // Keep timeScale state in sync with clock
  useEffect(() => {
    const id = setInterval(() => {
      if (clockRef.current) {
        setTimeScaleState(clockRef.current.state.timeScale);
      }
    }, 500);
    return () => clearInterval(id);
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
        timeScale={timeScale}
        onResume={handleResume}
        onHome={handleHome}
        onToggleReducedMotion={(v) => updatePersisted({ settings: { ...persisted.settings, reducedMotion: v } })}
        onToggleMuted={(v) => updatePersisted({ settings: { ...persisted.settings, muted: v } })}
        onQualityChange={(v) => updatePersisted({ settings: { ...persisted.settings, qualityPreset: v } })}
        onTimeScale={handleTimeScale}
        onJumpDate={handleJumpDate}
        reducedMotion={persisted.settings.reducedMotion}
        muted={persisted.settings.muted}
        qualityPreset={persisted.settings.qualityPreset}
        stage={stage}
      />
    </div>
  );
}