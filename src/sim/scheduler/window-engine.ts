import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteState } from '@/sim/types';
import type {
  BeamScheduleState,
  BeamSchedulerEvent,
  BeamSchedulerMode,
  BeamSchedulerSnapshot,
} from './types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-joint-beamho-sdd.md
 * - PAP-2025-DAPS-CORE
 * - ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
 *
 * Notes:
 * - Deterministic window scheduler for V2-B D1.
 */

interface BeamSchedulerWindowEngineOptions {
  profile: PaperProfile;
  seed: number;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function computeDeterministicScore(
  seed: number,
  satId: number,
  beamId: number,
  windowId: number,
): number {
  return fnv1a32(`${seed}:${satId}:${beamId}:${windowId}`) / 0xffffffff;
}

function computeStepsPerWindow(profile: PaperProfile): number {
  // Source: ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
  // Scheduler window is discretized by the profile time step.
  return Math.max(1, Math.round(profile.scheduler.windowPeriodSec / profile.timeStepSec));
}

function computeWindowId(tick: number, stepsPerWindow: number): number {
  return Math.floor(Math.max(tick, 0) / stepsPerWindow);
}

function computeJainFairness(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const sumSq = values.reduce((acc, value) => acc + value * value, 0);
  if (sumSq <= 0) {
    return 1;
  }
  return (sum * sum) / (values.length * sumSq);
}

function computeStateHash(states: BeamScheduleState[]): string {
  const payload = states
    .map(
      (state) =>
        `${state.satId}:${state.beamId}:${state.isActive ? 1 : 0}:${
          state.freqBlockId ?? 0
        }:${state.windowId}`,
    )
    .join('|');
  return `sched-${fnv1a32(payload).toString(16).padStart(8, '0')}`;
}

function buildSatelliteStates(options: {
  tick: number;
  mode: BeamSchedulerMode;
  seed: number;
  windowId: number;
  satellite: SatelliteState;
  profile: PaperProfile;
}): { states: BeamScheduleState[]; activeBeamCount: number } {
  const { tick, mode, seed, windowId, satellite, profile } = options;
  const totalBeams = satellite.beams.length;
  if (totalBeams === 0) {
    return {
      states: [],
      activeBeamCount: 0,
    };
  }

  const ranked = satellite.beams
    .map((beam) => ({
      beam,
      score: computeDeterministicScore(seed, satellite.id, beam.beamId, windowId),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.beam.beamId - right.beam.beamId;
    });

  const maxActive = clamp(
    profile.scheduler.maxActiveBeamsPerSatellite,
    1,
    totalBeams,
  );
  const minActive = clamp(
    profile.scheduler.minActiveBeamsPerSatellite,
    0,
    maxActive,
  );
  const desiredByFraction = Math.round(
    totalBeams * profile.scheduler.activeWindowFraction,
  );
  const activeCount =
    mode === 'uncoupled'
      ? totalBeams
      : clamp(desiredByFraction, minActive, maxActive);

  const activeBeamIds = new Set(
    ranked.slice(0, activeCount).map((entry) => entry.beam.beamId),
  );
  const frequencyBlockCount = profile.scheduler.frequencyBlockCount;

  const states = ranked
    .map(({ beam, score }) => {
      const isActive = activeBeamIds.has(beam.beamId);
      const freqBlockId = isActive
        ? 1 + (Math.floor(score * 1e9) % frequencyBlockCount)
        : null;

      return {
        tick,
        satId: satellite.id,
        beamId: beam.beamId,
        isActive,
        freqBlockId,
        powerClass: isActive ? 'active' : 'sleep',
        windowId,
      } as BeamScheduleState;
    })
    .sort((left, right) => {
      if (left.satId !== right.satId) {
        return left.satId - right.satId;
      }
      return left.beamId - right.beamId;
    });

  return {
    states,
    activeBeamCount: activeCount,
  };
}

export class BeamSchedulerWindowEngine {
  private readonly profile: PaperProfile;
  private readonly seed: number;
  private readonly stepsPerWindow: number;
  private readonly previousWindowBySat = new Map<number, number>();

  constructor(options: BeamSchedulerWindowEngineOptions) {
    this.profile = options.profile;
    this.seed = options.seed;
    this.stepsPerWindow = computeStepsPerWindow(options.profile);
  }

  reset(): void {
    this.previousWindowBySat.clear();
  }

  buildSnapshot(tick: number, timeSec: number, satellites: SatelliteState[]): BeamSchedulerSnapshot {
    const mode = this.profile.scheduler.mode;
    const windowId = computeWindowId(tick, this.stepsPerWindow);
    const states: BeamScheduleState[] = [];
    const events: BeamSchedulerEvent[] = [];
    const activeCounts: number[] = [];

    for (const satellite of satellites) {
      const perSat = buildSatelliteStates({
        tick,
        mode,
        seed: this.seed,
        windowId,
        satellite,
        profile: this.profile,
      });

      states.push(...perSat.states);
      activeCounts.push(perSat.activeBeamCount);

      const previousWindowId = this.previousWindowBySat.get(satellite.id);
      if (previousWindowId !== windowId) {
        events.push({
          tick,
          timeSec,
          satId: satellite.id,
          windowId,
          type: 'scheduler-window-update',
          activeBeamCount: perSat.activeBeamCount,
          totalBeamCount: satellite.beams.length,
          reason:
            previousWindowId === undefined
              ? 'scheduler-init'
              : 'scheduler-window-rotation',
        });
      }

      this.previousWindowBySat.set(satellite.id, windowId);
    }

    const totalBeamCount = states.length;
    const activeBeamCount = states.reduce(
      (sum, state) => sum + (state.isActive ? 1 : 0),
      0,
    );

    return {
      tick,
      timeSec,
      summary: {
        mode,
        windowId,
        totalBeamCount,
        activeBeamCount,
        utilizationRatio:
          totalBeamCount > 0 ? activeBeamCount / totalBeamCount : 0,
        fairnessIndex: computeJainFairness(activeCounts),
        scheduleStateHash: computeStateHash(states),
      },
      states,
      events,
    };
  }
}
