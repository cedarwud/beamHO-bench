import { useMemo, useRef } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { ConnectionLines } from '@/components/sim/ConnectionLines';
import { SatelliteModel } from '@/components/sim/SatelliteModel';
import type { SatelliteRenderMode } from '@/components/sim/satellite-render-mode';
import type { SatelliteGeometryState, SatelliteState, UEState } from '@/sim/types';
import {
  applySatelliteDisplayContinuity,
  buildSatelliteDisplayContinuityMemory,
} from '@/viz/satellite/display-continuity';
import { buildSatelliteDisplayFrame } from '@/viz/satellite/display-adapter';
import { buildSatelliteDisplayCandidates } from '@/viz/satellite/display-selection';
import type { SatelliteDisplayContinuityMemory } from '@/viz/satellite/types';

interface SatelliteSkyLayerProps {
  profile: PaperProfile;
  satellites: readonly SatelliteState[];
  physicalSatellites?: readonly SatelliteGeometryState[];
  ues: readonly UEState[];
  renderMode: SatelliteRenderMode;
  glbModelPath: string;
  glbModelScale: number;
  motionTransitionSec?: number;
  enableSmoothMotion?: boolean;
  displayBudget?: number;
  continuitySequenceKey: string;
  snapshotTick: number;
  snapshotTimeSec: number;
  showGhosts?: boolean;
  showServingLinks?: boolean;
  showSecondaryLinks?: boolean;
  showPreparedLinks?: boolean;
}

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-view-sdd.md (Section 3.3, 3.4, 7)
 *
 * Notes:
 * - Scene wiring stops at this component boundary.
 * - Frontend display semantics are derived here from runtime snapshot fields.
 */
export function SatelliteSkyLayer({
  profile,
  satellites,
  physicalSatellites,
  ues,
  renderMode,
  glbModelPath,
  glbModelScale,
  motionTransitionSec = 1,
  enableSmoothMotion = true,
  displayBudget,
  continuitySequenceKey,
  snapshotTick,
  snapshotTimeSec,
  showGhosts = true,
  showServingLinks = true,
  showSecondaryLinks = true,
  showPreparedLinks = true,
}: SatelliteSkyLayerProps) {
  const continuityMemoryRef = useRef<SatelliteDisplayContinuityMemory | null>(null);
  const displayPool = physicalSatellites ?? satellites;
  const resolvedDisplayBudget = displayBudget ?? profile.constellation.activeSatellitesInWindow;
  const displayFrame = useMemo(
    () => {
      const candidates = buildSatelliteDisplayCandidates({
        satellites: displayPool,
        config: {
          minElevationDeg: profile.constellation.minElevationDeg,
          displayBudget: resolvedDisplayBudget,
          showGhosts,
        },
      });
      const selection = applySatelliteDisplayContinuity({
        candidates,
        displayBudget: resolvedDisplayBudget,
        sequenceKey: continuitySequenceKey,
        tick: snapshotTick,
        timeSec: snapshotTimeSec,
        memory: continuityMemoryRef.current,
      });
      continuityMemoryRef.current = buildSatelliteDisplayContinuityMemory({
        sequenceKey: continuitySequenceKey,
        tick: snapshotTick,
        timeSec: snapshotTimeSec,
        selectedIds: selection.selectedIds,
      });
      return buildSatelliteDisplayFrame({
        satellites: selection.selected,
        config: {
          areaWidthKm: profile.scenario.areaKm.width,
          areaHeightKm: profile.scenario.areaKm.height,
          minElevationDeg: profile.constellation.minElevationDeg,
        },
      });
    },
    [
      displayPool,
      profile.scenario.areaKm.width,
      profile.scenario.areaKm.height,
      profile.constellation.minElevationDeg,
      resolvedDisplayBudget,
      continuitySequenceKey,
      snapshotTick,
      snapshotTimeSec,
      showGhosts,
    ],
  );

  return (
    <>
      <ConnectionLines
        satelliteRenderPositions={displayFrame.renderPositionsById}
        ues={ues}
        showServing={showServingLinks}
        showSecondary={showSecondaryLinks}
        showPrepared={showPreparedLinks}
      />
      <SatelliteModel
        satellites={displayFrame.satellites}
        renderMode={renderMode}
        glbModelPath={glbModelPath}
        glbModelScale={glbModelScale}
        motionTransitionSec={motionTransitionSec}
        enableSmoothMotion={enableSmoothMotion}
      />
    </>
  );
}
