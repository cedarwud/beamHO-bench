/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md
 * - sdd/completed/beamHO-bench-requirements.md
 *
 * Notes:
 * - This file defines the canonical runtime data contract for SimCore.
 */

import type { RuntimeParameterAuditSnapshot } from './audit/runtime-parameter-audit';
import type { PolicyRuntimeSnapshot } from './policy/types';

export type HandoverState = 1 | 2 | 3;

export interface GeoPosition {
  lat: number;
  lon: number;
  altKm: number;
}

export interface BeamState {
  beamId: number;
  centerLatLon: [number, number];
  centerWorld: [number, number, number];
  radiusKm: number;
  radiusWorld: number;
  connectedUeIds: number[];
}

export interface SatelliteState {
  id: number;
  positionEcef: [number, number, number];
  positionWorld: [number, number, number];
  positionLla: GeoPosition;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  visible: boolean;
  beams: BeamState[];
}

export interface UEState {
  id: number;
  positionLatLon: [number, number];
  positionWorld: [number, number, number];
  speedKmph: number;
  servingSatId: number | null;
  servingBeamId: number | null;
  secondarySatId?: number | null;
  secondaryBeamId?: number | null;
  choPreparedSatId?: number | null;
  choPreparedBeamId?: number | null;
  choPreparedElapsedMs?: number | null;
  choPreparedTargetMs?: number | null;
  rsrpDbm: number;
  sinrDb: number;
  l3SinrDb?: number;
  qOutCounter?: number;
  qInCounter?: number;
  hoState: HandoverState;
  rlfTimerMs: number | null;
  rlfRecoveryBudgetMs?: number | null;
}

export interface HOEvent {
  tick: number;
  ueId: number;
  fromSatId: number | null;
  toSatId: number | null;
  fromBeamId: number | null;
  toBeamId: number | null;
  reason: string;
}

export interface KpiResult {
  throughput: number;
  handoverRate: number;
  hof: {
    state2: number;
    state3: number;
  };
  rlf: {
    state1: number;
    state2: number;
  };
  uho: number;
  hopp: number;
  avgDlSinr: number;
  jainFairness: number;
}

export interface SimSnapshot {
  tick: number;
  timeSec: number;
  scenarioId: string;
  profileId: string;
  satellites: SatelliteState[];
  ues: UEState[];
  hoEvents: HOEvent[];
  kpiCumulative: KpiResult;
  runtimeParameterAudit?: RuntimeParameterAuditSnapshot;
  policyRuntime?: PolicyRuntimeSnapshot;
}

export interface SimTickContext {
  timeStepSec: number;
}

export interface SimScenario {
  id: string;
  profileId: string;
  createInitialSnapshot: () => SimSnapshot;
  nextSnapshot: (previous: SimSnapshot, context: SimTickContext) => SimSnapshot;
}
