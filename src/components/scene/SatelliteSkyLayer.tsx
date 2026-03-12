import { useMemo } from 'react';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { ConnectionLines } from '@/components/sim/ConnectionLines';
import { SatelliteModel } from '@/components/sim/SatelliteModel';
import type { SatelliteRenderMode } from '@/components/sim/satellite-render-mode';
import type { SatelliteState, UEState } from '@/sim/types';
import { buildSatelliteDisplayFrame } from '@/viz/satellite/display-adapter';

interface SatelliteSkyLayerProps {
  profile: PaperProfile;
  satellites: readonly SatelliteState[];
  ues: readonly UEState[];
  renderMode: SatelliteRenderMode;
  glbModelPath: string;
  glbModelScale: number;
  motionTransitionSec?: number;
  enableSmoothMotion?: boolean;
  displayBudget?: number;
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
  ues,
  renderMode,
  glbModelPath,
  glbModelScale,
  motionTransitionSec = 1,
  enableSmoothMotion = true,
  displayBudget,
  showGhosts = true,
  showServingLinks = true,
  showSecondaryLinks = true,
  showPreparedLinks = true,
}: SatelliteSkyLayerProps) {
  const displayFrame = useMemo(
    () =>
      buildSatelliteDisplayFrame({
        satellites,
        config: {
          areaWidthKm: profile.scenario.areaKm.width,
          areaHeightKm: profile.scenario.areaKm.height,
          minElevationDeg: profile.constellation.minElevationDeg,
          displayBudget,
          showGhosts,
        },
      }),
    [
      satellites,
      profile.scenario.areaKm.width,
      profile.scenario.areaKm.height,
      profile.constellation.minElevationDeg,
      displayBudget,
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
