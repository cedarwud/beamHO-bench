/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md
 *
 * Notes:
 * - UI-only control surface for timeline execution and playback speed.
 */

const PLAYBACK_RATE_OPTIONS = [0.25, 0.5, 1, 2, 4, 8] as const;

export interface TimelineControlsProps {
  tick: number;
  timeSec: number;
  isRunning: boolean;
  playbackRate: number;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  onPlaybackRateChange: (value: number) => void;
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
  onToggleRun,
  onStep,
  onReset,
  onPlaybackRateChange,
}: TimelineControlsProps) {
  return (
    <div className="sim-timeline">
      <button type="button" onClick={onToggleRun}>
        {isRunning ? 'Pause' : 'Run'}
      </button>
      <button type="button" onClick={onStep} disabled={isRunning}>
        Step
      </button>
      <button type="button" onClick={onReset}>
        Reset
      </button>
      <label className="sim-hud__select">
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
      <span className="sim-timeline__meta">
        t={timeSec.toFixed(1)}s | tick={tick}
      </span>
    </div>
  );
}
