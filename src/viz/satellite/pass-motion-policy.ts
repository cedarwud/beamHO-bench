/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md (Section 5.2)
 * - ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
 *
 * Notes:
 * - Determines per-actor spatial assignment using real elevation trend,
 *   not the sin(azimuth) heuristic used at the selection budget stage.
 * - View-only: no writes back to simulation or handover contracts.
 */

import type { SatelliteDisplayPhase, PassActorMemory } from './types';

export interface PassMotionDecision {
  satelliteId: number;
  phase: SatelliteDisplayPhase;
  laneIndex: number;
}

/**
 * Resolve authoritative pass phase from real elevation trend.
 *
 * Unlike the sin(azimuth) heuristic in display-selection.ts (which is kept
 * only for budget-slot allocation), this uses actual elevation direction to
 * distinguish ingress from egress.
 */
export function resolvePassPhase(options: {
  elevationDeg: number;
  previousElevationDeg: number;
  phaseLowElevationDeg: number;
  phaseHighElevationDeg: number;
}): SatelliteDisplayPhase {
  const { elevationDeg, previousElevationDeg, phaseLowElevationDeg, phaseHighElevationDeg } =
    options;
  if (elevationDeg >= phaseHighElevationDeg) {
    return 'high-pass';
  }
  if (elevationDeg >= phaseLowElevationDeg) {
    return 'mid-pass';
  }
  // Near horizon: rising → ingress, falling → egress.
  return elevationDeg >= previousElevationDeg ? 'boundary-ingress' : 'boundary-egress';
}

/**
 * Build motion decisions for all current actors.
 *
 * Lane indices come from the persistent assignment in PassActorMemory (set at entry,
 * preserved through exit linger). This avoids screen jumps from sort-order changes.
 */
export function buildPassMotionDecisions(options: {
  actors: readonly PassActorMemory[];
  currentElevationById: Map<number, { elevationDeg: number; azimuthDeg: number }>;
  phaseLowElevationDeg: number;
  phaseHighElevationDeg: number;
}): Map<number, PassMotionDecision> {
  const { actors, currentElevationById, phaseLowElevationDeg, phaseHighElevationDeg } = options;

  const decisions = new Map<number, PassMotionDecision>();
  for (const actor of actors) {
    const current = currentElevationById.get(actor.satelliteId);
    const elevationDeg = current?.elevationDeg ?? actor.lastElevationDeg;

    const phase = resolvePassPhase({
      elevationDeg,
      previousElevationDeg: actor.lastElevationDeg,
      phaseLowElevationDeg,
      phaseHighElevationDeg,
    });

    decisions.set(actor.satelliteId, {
      satelliteId: actor.satelliteId,
      phase,
      laneIndex: actor.laneIndex,
    });
  }

  return decisions;
}
