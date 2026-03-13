import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteGeometryState } from '@/sim/types';
import {
  applySatelliteDisplayContinuity,
  buildSatelliteDisplayContinuityMemory,
} from './display-continuity';
import { buildSatelliteDisplayFrame } from './display-adapter';
import { buildSatelliteDisplayCandidates } from './display-selection';
import type { SatelliteDisplayContinuityMemory } from './types';
import type { ObserverSkyCompositionConfig } from './view-composition';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.2, 3.5, 3.6, 6)
 * - sdd/pending/beamHO-bench-observer-sky-visual-correction-sdd.md (Section 3.1, 3.3, 3.6, 6)
 *
 * Notes:
 * - This module keeps the observer-sky display pipeline deterministic while
 *   letting MainScene choose the accepted composition mode explicitly.
 * - View-only continuity memory remains frontend-owned.
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
  const displayBudget =
    input.displayBudget ?? input.profile.constellation.activeSatellitesInWindow;
  const candidates = buildSatelliteDisplayCandidates({
    satellites: input.satellites,
    config: {
      minElevationDeg: input.profile.constellation.minElevationDeg,
      displayBudget,
      showGhosts: input.showGhosts,
    },
  });
  const selection = applySatelliteDisplayContinuity({
    candidates,
    displayBudget,
    sequenceKey: input.sequenceKey,
    tick: input.snapshotTick,
    timeSec: input.snapshotTimeSec,
    memory: input.memory,
  });
  const frame = buildSatelliteDisplayFrame({
    satellites: selection.selected,
    config: {
      areaWidthKm: input.profile.scenario.areaKm.width,
      areaHeightKm: input.profile.scenario.areaKm.height,
      minElevationDeg: input.profile.constellation.minElevationDeg,
      projection: input.composition.projection,
    },
  });
  const memory = buildSatelliteDisplayContinuityMemory({
    sequenceKey: input.sequenceKey,
    tick: input.snapshotTick,
    timeSec: input.snapshotTimeSec,
    selectedIds: selection.selectedIds,
  });

  return {
    displayBudget,
    candidates,
    selection,
    frame,
    memory,
  };
}
