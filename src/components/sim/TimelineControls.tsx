/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md
 *
 * Notes:
 * - UI-only control surface for timeline execution and playback speed.
 */

const PLAYBACK_RATE_OPTIONS = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const;

export interface TimelineControlsProps {
  tick: number;
  timeSec: number;
  isRunning: boolean;
  playbackRate: number;
  replayTick: number | null;
  replayMaxTick: number;
  onToggleRun: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onReset: () => void;
  onPlaybackRateChange: (value: number) => void;
  onReplayTickChange: (tick: number) => void;
  onReplayLive: () => void;
}

function formatRate(rate: number): string {
  if (Number.isInteger(rate)) {
    return `${rate}x`;
  }
  return `${rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x`;
}

export function TimelineControls({
  tick,
  timeSec,
  isRunning,
  playbackRate,
  replayTick,
  replayMaxTick,
  onToggleRun,
  onStep,
  onStepBack,
  onReset,
  onPlaybackRateChange,
  onReplayTickChange,
  onReplayLive,
}: TimelineControlsProps) {
  const replayValue = replayTick ?? replayMaxTick;
  return (
    <div className="sim-timeline">
      <div className="sim-timeline__run-row">
        <button type="button" onClick={onToggleRun}>
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <button type="button" onClick={onStep} disabled={isRunning}>
          Step
        </button>
        <label className="sim-hud__select sim-timeline__speed">
          Speed
          <select
            value={String(playbackRate)}
            onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
          >
            {PLAYBACK_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {formatRate(rate)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <span className="sim-timeline__meta">
        t={timeSec.toFixed(1)}s | tick={tick}
      </span>
    </div>
  );
}
