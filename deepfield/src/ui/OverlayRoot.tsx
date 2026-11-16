import { Hud } from './Hud';
import { PauseMenu } from './PauseMenu';
import type { FlightMode } from '../core/types';

export interface OverlayRootProps {
  mode: FlightMode;
  utcText: string;
  paused: boolean;
  timeScale: number;
  onResume: () => void;
  onHome: () => void;
  onToggleReducedMotion: (v: boolean) => void;
  onToggleMuted: (v: boolean) => void;
  onQualityChange: (v: 'low' | 'medium' | 'high') => void;
  reducedMotion: boolean;
  muted: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
}

export function OverlayRoot({
  mode,
  utcText,
  paused,
  timeScale,
  onResume,
  onHome,
  onToggleReducedMotion,
  onToggleMuted,
  onQualityChange,
  reducedMotion,
  muted,
  qualityPreset,
}: OverlayRootProps) {
  return (
    <>
      <Hud
        mode={mode}
        utcText={utcText}
        paused={paused}
        timeScale={timeScale}
      />
      {paused && (
        <PauseMenu
          onResume={onResume}
          onHome={onHome}
          onToggleReducedMotion={onToggleReducedMotion}
          onToggleMuted={onToggleMuted}
          onQualityChange={onQualityChange}
          reducedMotion={reducedMotion}
          muted={muted}
          qualityPreset={qualityPreset}
        />
      )}
    </>
  );
}