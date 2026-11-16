export interface PauseMenuProps {
  onResume: () => void;
  onHome: () => void;
  onToggleReducedMotion: (v: boolean) => void;
  onToggleMuted: (v: boolean) => void;
  onQualityChange: (v: 'low' | 'medium' | 'high') => void;
  reducedMotion: boolean;
  muted: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
  timeScale?: number;
  onTimeScale?: (v: number) => void;
  onJumpDate?: (isoDate: string) => void;
}

export function PauseMenu({
  onResume,
  onHome,
  onToggleReducedMotion,
  onToggleMuted,
  onQualityChange,
  reducedMotion,
  muted,
  qualityPreset,
  timeScale = 1,
  onTimeScale,
  onJumpDate,
}: PauseMenuProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        zIndex: 100,
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          padding: '32px 48px',
          borderRadius: 12,
          background: 'rgba(20,20,30,0.95)',
          border: '1px solid rgba(255,255,255,0.15)',
          minWidth: 280,
          maxWidth: 360,
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 24px', fontSize: 24 }}>PAUSED</h2>
        <button onClick={onResume} style={btnStyle}>
          Resume
        </button>
        <button onClick={onHome} style={{ ...btnStyle, marginTop: 12 }}>
          Home (Earth Orbit)
        </button>
        <hr style={{ margin: '20px 0', borderColor: 'rgba(255,255,255,0.15)' }} />

        {/* Time controls */}
        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
            TIME CONTROLS · Current: {timeScale.toFixed(0)}x
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '1x', value: 1 },
              { label: '10x', value: 10 },
              { label: '60x', value: 60 },
              { label: '1000x', value: 1000 },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => onTimeScale?.(p.value)}
                style={{
                  flex: '1 1 auto',
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: timeScale === p.value ? 'rgba(100,150,255,0.4)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Jump to date:{' '}
            <input
              type="date"
              style={{
                padding: '4px 8px',
                background: '#111',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 4,
                fontSize: 12,
              }}
              onChange={(e) => onJumpDate?.(e.target.value)}
            />
          </div>
        </div>

        {/* Settings */}
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => onToggleReducedMotion(e.target.checked)}
            />
            Reduced motion
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => onToggleMuted(e.target.checked)}
            />
            Muted
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Quality:
            <select
              value={qualityPreset}
              onChange={(e) => onQualityChange(e.target.value as 'low' | 'medium' | 'high')}
              style={{ marginLeft: 8, padding: '4px 8px', background: '#111', color: '#fff', border: '1px solid #333' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, opacity: 0.6, textAlign: 'left' }}>
          <div>WASD — move</div>
          <div>Q/E — roll</div>
          <div>R/F — up/down</div>
          <div>Space — brake</div>
          <div>Esc — resume</div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  cursor: 'pointer',
  transition: 'background 0.1s',
};