import type { FlightMode, FlightStage } from '../core/types';

export interface HudProps {
  mode: FlightMode;
  utcText: string;
  paused: boolean;
  timeScale: number;
  stage?: FlightStage | null;
}

export function Hud({ mode, utcText, paused, timeScale, stage }: HudProps) {
  const pointerLocked = document.pointerLockElement !== null;
  const s: FlightStage = stage ?? {
    mode,
    autopilot: 'idle',
    assisted: true,
    targetId: null,
    altitude: 0,
    verticalSpeed: 0,
    speed: 0,
    range: 0,
    bearing: 0,
    elevation: 0,
    closestApproach: 0,
    lastSafeVisit: null,
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        textShadow: '0 0 4px #000',
      }}
    >
      {/* Top-left: UTC + time controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.4,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ fontWeight: 600, letterSpacing: '0.05em' }}>
          {utcText}
        </div>
        <div style={{ opacity: 0.8, fontSize: 11 }}>
          {`Sim: ${paused ? '⏸ PAUSED' : `▶ ${timeScale.toFixed(2)}x`}`}
        </div>
      </div>

      {/* Bottom-left: approach HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.6,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(0,0,0,0.5)',
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: 600, letterSpacing: '0.05em', fontSize: 10 }}>
          Approach HUD · Mode: {mode.toUpperCase()}
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Alt:</span>{' '}
          <strong>{formatMeters(s.altitude)}</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Range:</span>{' '}
          <strong>{formatMeters(s.range)}</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Speed:</span>{' '}
          <strong>{formatSpeed(s.speed)}</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>VS:</span>{' '}
          <strong>{formatSpeed(s.verticalSpeed)}</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Bearing:</span>{' '}
          <strong>{formatAngle(s.bearing)}°</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Elev:</span>{' '}
          <strong>{formatAngle(s.elevation)}°</strong>
        </div>
        <div>
          <span style={{ opacity: 0.8 }}>Target:</span>{' '}
          <strong>{s.targetId ?? '—'}</strong>
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
          Autopilot: {s.autopilot ?? 'idle'} · {'Assisted: ' + (s.assisted ? 'on' : 'off')}
        </div>
      </div>

      {/* Pointer lock hint */}
      {!pointerLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.45)',
            textAlign: 'right',
          }}
        >
          Click to look (pointer lock)
        </div>
      )}

      {/* Top-right: Controls reminder */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.6,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.35)',
          textAlign: 'right',
          opacity: 0.7,
        }}
      >
        <div>WASD — move</div>
        <div>Q/E — roll</div>
        <div>R/F — up/down</div>
        <div>Space — brake</div>
        <div>Esc — pause/menu</div>
      </div>
    </div>
  );
}

function formatMeters(m: number): string {
  if (m >= 1e6) return `${(m / 1e6).toFixed(2)} Mm`;
  if (m >= 1e3) return `${(m / 1e3).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}

function formatSpeed(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)} km/s`;
  if (abs >= 1) return `${abs.toFixed(0)} m/s`;
  return `${abs.toFixed(2)} m/s`;
}

function formatAngle(rad: number): string {
  return ((rad * 180) / Math.PI).toFixed(1);
}