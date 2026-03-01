import type { BaselineBatchResult } from '@/sim/bench/runner';
import type { SatelliteState, UEState } from '@/sim/types';

export function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertAlmostEqual(left: number, right: number, epsilon = 1e-9): void {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    throw new Error(`Cannot compare non-finite values (${left}, ${right}).`);
  }
  if (Math.abs(left - right) > epsilon) {
    throw new Error(`Expected values to be close, got ${left} vs ${right} (eps=${epsilon}).`);
  }
}

export function createBaseUe(overrides: Partial<UEState> = {}): UEState {
  return {
    id: 1,
    positionLatLon: [0, 0],
    positionWorld: [0, 0, 0],
    speedKmph: 0,
    servingSatId: 1,
    servingBeamId: 1,
    rsrpDbm: -90,
    sinrDb: 10,
    hoState: 1,
    rlfTimerMs: null,
    ...overrides,
  };
}

export function createInvisibleSatellite(): SatelliteState {
  return {
    id: 1,
    positionEcef: [0, 0, 0],
    positionWorld: [0, 0, 0],
    positionLla: { lat: 0, lon: 0, altKm: 0 },
    azimuthDeg: 0,
    elevationDeg: 0,
    rangeKm: 0,
    visible: false,
    beams: [],
  };
}

export function normalizeBatchForDeterminism(batch: BaselineBatchResult) {
  return {
    profileId: batch.profileId,
    seed: batch.seed,
    tickCount: batch.tickCount,
    summaryCsv: batch.summaryCsv,
    runs: batch.runs.map((run) => ({
      baseline: run.baseline,
      metadata: {
        scenarioId: run.result.metadata.scenarioId,
        profileId: run.result.metadata.profileId,
        baseline: run.result.metadata.baseline,
        algorithmFidelity: run.result.metadata.algorithmFidelity,
        throughputModel: run.result.metadata.throughputModel,
        seed: run.result.metadata.seed,
        playbackRate: run.result.metadata.playbackRate,
        resolvedAssumptionIds: [...run.result.metadata.resolvedAssumptionIds].sort(),
        runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
        policyRuntime: run.result.metadata.policyRuntime,
        beamScheduler: run.result.metadata.beamScheduler,
        coupledDecisionStats: run.result.metadata.coupledDecisionStats,
      },
      summary: run.result.summary,
      timeseriesCsv: run.timeseriesCsv,
    })),
  };
}
