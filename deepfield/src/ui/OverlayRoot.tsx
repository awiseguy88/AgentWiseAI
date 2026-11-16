import { Hud } from './Hud';
import { PauseMenu } from './PauseMenu';
import type { FlightMode, FlightStage } from '../core/types';

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
  onTimeScale: (v: number) => void;
  onJumpDate: (isoDate: string) => void;
  reducedMotion: boolean;
  muted: boolean;
  qualityPreset: 'low' | 'medium' | 'high';
  stage?: FlightStage | null;
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
  onTimeScale,
  onJumpDate,
  reducedMotion,
  muted,
  qualityPreset,
  stage,
}: OverlayRootProps) {
  return (
    <>
      <Hud
        mode={mode}
        utcText={utcText}
        paused={paused}
        timeScale={timeScale}
        stage={stage}
      />
      {paused && (
        <PauseMenu
          onResume={onResume}
          onHome={onHome}
          onToggleReducedMotion={onToggleReducedMotion}
          onToggleMuted={onToggleMuted}
          onQualityChange={onQualityChange}
          onTimeScale={onTimeScale}
          onJumpDate={onJumpDate}
          reducedMotion={reducedMotion}
          muted={muted}
          qualityPreset={qualityPreset}
          timeScale={timeScale}
        />
      )}
    </>
  );
}