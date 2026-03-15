import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteGeometryState } from '@/sim/types';
import {
  applySatelliteDisplayContinuity,
  buildSatelliteDisplayContinuityMemory,
} from './display-continuity';
import { buildSatelliteDisplayCandidates } from './display-selection';
import type {
  SatelliteDisplayContinuityMemory,
  SatelliteDisplayFrame,
  SatelliteDisplayState,
} from './types';
import type { ObserverSkyCompositionConfig } from './view-composition';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.2, 3.5, 3.6, 6)
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
 *
 * Notes:
 * - Analytic arc projection adapted from simworld DynamicSatelliteRenderer.
 * - Elevation drives transit progress (0°=horizon → 90°=zenith → 0°=horizon).
 * - Azimuth drives the arc's horizontal sweep direction.
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

/**
 * Hemisphere arc position from azimuth/elevation.
 *
 * - Azimuth controls the horizontal sweep direction on the dome.
 * - Elevation controls height: 0° = horizon edge, 90° = zenith.
 * - Horizontal radius shrinks with elevation so overhead sats are near center.
 *
 * As a satellite naturally sweeps in azimuth with elevation rising then
 * falling, it traces a continuous rise→pass→set arc with no reversal.
 */
function projectArcPosition(
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  const baseRadius = 600;
  const baseY = 60;
  const heightScale = 320;

  const clampedElevation = Math.max(0, Math.min(90, elevationDeg));
  const elevationRad = (clampedElevation * Math.PI) / 180;
  const azimuthRad = (azimuthDeg * Math.PI) / 180;

  // Horizontal radius shrinks as elevation increases (cos 0°=1, cos 90°=0)
  const horizontalRadius = baseRadius * Math.cos(elevationRad);

  const x = horizontalRadius * Math.sin(azimuthRad);
  const z = horizontalRadius * Math.cos(azimuthRad);
  const y = baseY + heightScale * Math.sin(elevationRad);

  return [x, y, z];
}

export function buildObserverSkyDisplayPipeline(
  input: ObserverSkyDisplayPipelineInput,
) {
  // Display budget: show more than the HO candidate set, but not all above-horizon.
  // Acceptance doc §6: display set should be larger than HO candidate set.
  // Use 2× activeSatellitesInWindow as a reasonable sky-visible pool.
  const displayBudget = input.displayBudget ?? 1;

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

  // Step 3: Analytic arc projection
  const satellites: SatelliteDisplayState[] = selection.selected.map((c) => ({
    satelliteId: c.satellite.id,
    zone: c.zone,
    renderPosition: projectArcPosition(c.satellite.azimuthDeg, c.satellite.elevationDeg),
    azimuthDeg: c.satellite.azimuthDeg,
    elevationDeg: c.satellite.elevationDeg,
    rangeKm: c.satellite.rangeKm,
    opacity: c.zone === 'active' ? 1 : 0.35,
    phase: c.phase,
  }));

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
  });

  return {
    displayBudget,
    candidates,
    selection,
    frame,
    memory,
  };
}
