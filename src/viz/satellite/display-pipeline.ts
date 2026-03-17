import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteGeometryState } from '@/sim/types';
import {
  applySatelliteDisplayContinuity,
  buildSatelliteDisplayContinuityMemory,
} from './display-continuity';
import { buildSatelliteDisplayCandidates } from './display-selection';
import { applyPassCompositionState } from './pass-composition-state';
import { buildPassMotionDecisions } from './pass-motion-policy';
import { buildPassTrajectoryOutputs } from './pass-trajectory-conversion';
import type {
  PassActorMemory,
  SatelliteDisplayContinuityMemory,
  SatelliteDisplayFrame,
  SatelliteDisplayState,
} from './types';
import type { ObserverSkyCompositionConfig } from './view-composition';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.2, 3.5, 3.6, 6)
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md (Section 3.2, 4.1, 5, 6, D6)
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
 * - ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
 *
 * Notes:
 * - Orchestrates the full display pipeline:
 *   candidate selection → continuity → pass composition state →
 *   pass motion policy → pass trajectory conversion → frame assembly.
 * - View-only: no writes back to simulation/handover contracts.
 */

export interface ObserverSkyDisplayPipelineInput {
  profile: PaperProfile;
  satellites: readonly SatelliteGeometryState[];
  composition: ObserverSkyCompositionConfig;
  displayBudget?: number;
  sequenceKey: string;
  snapshotTick: number;
  snapshotTimeSec: number;
  memory?: SatelliteDisplayContinuityMemory | null;
  showGhosts?: boolean;
}

export function buildObserverSkyDisplayPipeline(
  input: ObserverSkyDisplayPipelineInput,
) {
  // Display budget: show more than the HO candidate set, but not all above-horizon.
  // Acceptance doc §6: display set should be larger than HO candidate set.
  // Default: keep enough budget for screen-space spread (boundary satellites
  // contribute horizontal span) while the high-pass-first phase order ensures
  // the most readable arcs appear first.
  const activeSatsInWindow =
    input.profile.constellation.activeSatellitesInWindow ??
    input.profile.constellation.satellitesPerPlane ??
    8;
  const displayBudget =
    input.displayBudget ?? Math.max(4, 2 * activeSatsInWindow);

  // Step 1: Candidate selection
  const candidates = buildSatelliteDisplayCandidates({
    satellites: input.satellites,
    config: {
      minElevationDeg: input.profile.constellation.minElevationDeg,
      displayBudget,
      showGhosts: input.showGhosts ?? true,
      phaseLowElevationDeg: input.composition.screenSpaceAcceptance.phaseLowElevationDeg,
      phaseHighElevationDeg: input.composition.screenSpaceAcceptance.phaseHighElevationDeg,
    },
  });

  // Step 2: Continuity
  const selection = applySatelliteDisplayContinuity({
    candidates,
    displayBudget,
    sequenceKey: input.sequenceKey,
    tick: input.snapshotTick,
    timeSec: input.snapshotTimeSec,
    memory: input.memory,
  });

  // Step 3: Pass composition state — lifecycle (entering / tracked / exiting)
  const previousActors: readonly PassActorMemory[] = input.memory?.passActors ?? [];
  const passActors = applyPassCompositionState({
    selectedCandidates: selection.selected,
    previousActors,
    tick: input.snapshotTick,
    exitLingerTicks: input.composition.passLayout.exitLingerTicks,
  });

  // Step 4: Pass motion policy — authoritative phase from elevation trend
  const currentGeometryById = new Map(
    input.satellites.map((s) => [
      s.id,
      { azimuthDeg: s.azimuthDeg, elevationDeg: s.elevationDeg },
    ]),
  );
  const motionDecisions = buildPassMotionDecisions({
    actors: passActors,
    currentElevationById: currentGeometryById,
    phaseLowElevationDeg: input.composition.screenSpaceAcceptance.phaseLowElevationDeg,
    phaseHighElevationDeg: input.composition.screenSpaceAcceptance.phaseHighElevationDeg,
  });

  // Step 5: Pass trajectory conversion — visual render targets
  const trajectoryOutputs = buildPassTrajectoryOutputs({
    actors: passActors,
    decisions: motionDecisions,
    currentGeometryById,
    exitLingerTicks: input.composition.passLayout.exitLingerTicks,
  });

  // Step 6: Assemble frame
  const trajectoryById = new Map(trajectoryOutputs.map((t) => [t.satelliteId, t]));
  const BASE_Y_FALLBACK = 60;

  const satellites: SatelliteDisplayState[] = passActors.map((actor) => {
    const trajectory = trajectoryById.get(actor.satelliteId);
    const geom = input.satellites.find((s) => s.id === actor.satelliteId);
    const decision = motionDecisions.get(actor.satelliteId);
    // Exiting actors don't appear in selection.selected; find their original zone.
    const candidate = selection.selected.find((c) => c.satellite.id === actor.satelliteId);
    const zone = candidate?.zone ?? 'active';

    return {
      satelliteId: actor.satelliteId,
      zone,
      renderPosition: trajectory?.visualTargetPosition ?? [0, BASE_Y_FALLBACK, 0],
      motionSourcePosition: trajectory?.motionSourcePosition,
      azimuthDeg: geom?.azimuthDeg ?? 0,
      elevationDeg: geom?.elevationDeg ?? 0,
      rangeKm: geom?.rangeKm ?? 0,
      opacity: trajectory?.opacity ?? (zone === 'active' ? 1 : 0.35),
      phase: trajectory?.phase ?? decision?.phase,
      lifecycle: actor.lifecycle,
    };
  });

  // Sort: active first, then by elevation desc
  satellites.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone === 'active' ? -1 : 1;
    if (a.elevationDeg !== b.elevationDeg) return b.elevationDeg - a.elevationDeg;
    return a.satelliteId - b.satelliteId;
  });

  const frame: SatelliteDisplayFrame = {
    satellites,
    renderPositionsById: new Map(
      satellites.map((s) => [s.satelliteId, s.renderPosition]),
    ),
  };

  const memory = buildSatelliteDisplayContinuityMemory({
    sequenceKey: input.sequenceKey,
    tick: input.snapshotTick,
    timeSec: input.snapshotTimeSec,
    selectedIds: selection.selectedIds,
    actors: input.memory?.actors,
  });
  // Attach pass actor state to carry forward.
  (memory as SatelliteDisplayContinuityMemory).passActors = passActors;

  return {
    displayBudget,
    candidates,
    selection,
    frame,
    memory,
  };
}
