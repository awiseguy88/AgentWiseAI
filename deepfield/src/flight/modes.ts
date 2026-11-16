import type { FlightMode } from '../core/types';

export function createFlightState(initial: FlightMode = 'free') {
  let mode: FlightMode = initial;
  let assisted = true;
  return {
    getMode: () => mode,
    setMode: (m: FlightMode) => { mode = m; },
    toggleAssisted: () => { assisted = !assisted; },
    isAssisted: () => assisted,
  };
}
