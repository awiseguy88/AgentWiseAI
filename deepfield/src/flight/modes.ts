import type { FlightMode, AutopilotStage, FlightStage } from '../core/types';

export function createFlightState(initial: FlightMode = 'free') {
  let mode: FlightMode = initial;
  let assisted = true;
  let autopilot: AutopilotStage = 'idle';
  let targetId: string | null = null;

  return {
    getMode: () => mode,
    setMode: (m: FlightMode) => {
      mode = m;
      if (m === 'surface') {
        autopilot = 'landing';
      } else if (m === 'orbit') {
        autopilot = 'orbit';
      } else {
        autopilot = 'idle';
      }
    },
    toggleAssisted: () => {
      assisted = !assisted;
    },
    isAssisted: () => assisted,
    getAutopilot: () => autopilot,
    setAutopilot: (a: AutopilotStage) => {
      autopilot = a;
    },
    getTargetId: () => targetId,
    setTargetId: (id: string | null) => {
      targetId = id;
    },
    cycleTarget: (ids: string[]) => {
      if (ids.length === 0) return null;
      const idx = targetId ? ids.indexOf(targetId) : -1;
      const nextIdx = (idx + 1) % ids.length;
      targetId = ids[nextIdx];
      return targetId;
    },
    toStage(): FlightStage {
      return {
        mode,
        autopilot,
        assisted,
        targetId,
        altitude: 0,
        verticalSpeed: 0,
        speed: 0,
        range: 0,
        bearing: 0,
        elevation: 0,
        closestApproach: 0,
        lastSafeVisit: null,
      };
    },
  };
}