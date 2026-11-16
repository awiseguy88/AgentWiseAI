import type { FlightMode } from '../core/types';

export interface HudProps {
  mode: FlightMode;
  utcText: string;
  paused: boolean;
  timeScale: number;
}

export function Hud({ mode, utcText, paused, timeScale }: HudProps) {
  const pointerLocked = document.pointerLockElement !== null;
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
          {'Sim: '}{paused ? '⏸ PAUSED' : `▶ ${timeScale.toFixed(2)}x`}
        </div>
      </div>

      {/* Bottom-left: mode + placeholder HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.5,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(0,0,0,0.45)',
        }}
      >
        <div>Mode: <strong>{mode.toUpperCase()}</strong></div>
        <div style={{ opacity: 0.7 }}>Speed: —</div>
        <div style={{ opacity: 0.7 }}>Alt: —</div>
        <div style={{ opacity: 0.7 }}>Range: —</div>
        <div style={{ opacity: 0.7 }}>Target: —</div>
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