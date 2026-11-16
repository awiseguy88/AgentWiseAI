export interface PauseMenuProps {
  onResume: () => void;
  onHome: () => void;
  onToggleReducedMotion: (v: boolean) => void;
  onToggleMuted: (v: boolean) => void;
  onQualityChange: (v: 'low' | 'medium' | 'high') => void;
  reducedMotion: boolean;
  muted: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
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
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 24px', fontSize: 24 }}>PAUSED</h2>
        <button
          onClick={onResume}
          style={btnStyle}
        >
          Resume
        </button>
        <button
          onClick={onHome}
          style={{ ...btnStyle, marginTop: 12 }}
        >
          Home (Earth Orbit)
        </button>
        <hr style={{ margin: '20px 0', borderColor: 'rgba(255,255,255,0.15)' }} />
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
              onChange={(e) => onQualityChange(e.target.value as 'low'|'medium'|'high')}
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