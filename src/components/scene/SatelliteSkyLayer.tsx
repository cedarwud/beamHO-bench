import { useMemo, useRef } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { ConnectionLines } from '@/components/sim/ConnectionLines';
import { SatelliteModel } from '@/components/sim/SatelliteModel';
import type { SatelliteRenderMode } from '@/components/sim/satellite-render-mode';
import type { SatelliteGeometryState, SatelliteState, UEState } from '@/sim/types';
import { buildObserverSkyDisplayPipeline } from '@/viz/satellite/display-pipeline';
import type { SatelliteDisplayContinuityMemory } from '@/viz/satellite/types';
import type { ObserverSkyCompositionConfig } from '@/viz/satellite/view-composition';

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
  composition: ObserverSkyCompositionConfig;
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
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md (Section 3.3, 3.4, 7)
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
  composition,
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
  const displayFrame = useMemo(
    () => {
      const displayState = buildObserverSkyDisplayPipeline({
        profile,
        satellites: displayPool,
        composition,
        displayBudget,
        sequenceKey: continuitySequenceKey,
        snapshotTick,
        snapshotTimeSec,
        memory: continuityMemoryRef.current,
        showGhosts,
      });
      continuityMemoryRef.current = displayState.memory;
      return displayState.frame;
    },
    [
      displayPool,
      profile,
      composition,
      displayBudget,
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
