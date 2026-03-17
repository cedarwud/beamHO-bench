/**
 * Shared constants and types for scenario builders (case9-analytic, real-trace).
 *
 * Provenance:
 * - ASSUME-OBSERVER-LOCATION-BEIJING
 * - STD-3GPP-TR38.811-6.6.2-1
 */

import type { KpiResult, SatelliteGeometryState, SatelliteState, UEState } from '@/sim/types';

/**
 * Default observer location: Beijing region (40°N, 116°E).
 *
 * ASSUME-OBSERVER-LOCATION-BEIJING
 * Changed from NTPU (24.94°N, 121.37°E) to align with the most common
 * simulation reference across the 50-paper corpus (5+ papers use 40°N, 116°E):
 *   - PAP-2024-MADRL-CORE, PAP-2024-MAFDDQN, PAP-2024-MORL-MULTIBEAM,
 *     PAP-2025-OHO-USERCENTRIC, PAP-2025-BIPARTITE-HO
 * At 40°N with Starlink inclination 53°, max elevation reaches ~77°,
 * producing representative high-elevation passes near observer zenith.
 * The 3D scene NTPU building GLB is retained as visual decoration only.
 */
export const DEFAULT_OBSERVER = {
  lat: 40.0,
  lon: 116.0,
};

/** Zero-valued KPI accumulator for snapshot initialization. */
export const EMPTY_KPI: KpiResult = {
  throughput: 0,
  handoverRate: 0,
  hof: {
    state2: 0,
    state3: 0,
  },
  rlf: {
    state1: 0,
    state2: 0,
  },
  uho: 0,
  hopp: 0,
  avgDlSinr: 0,
  jainFairness: 0,
};

/**
 * Assign initial serving satellite + beam for each UE at tick 0.
 * Picks the highest-elevation visible satellite with beams, giving each UE
 * a distinct satellite when possible.
 */
export function assignInitialServing(
  ues: UEState[],
  satellites: SatelliteState[],
): void {
  // Sort candidates by elevation descending
  const candidates = satellites
    .filter((s) => s.visible && s.beams.length > 0)
    .sort((a, b) => b.elevationDeg - a.elevationDeg);

  const usedSatIds = new Set<number>();

  for (const ue of ues) {
    // Try to pick a satellite not yet used by another UE
    let pick = candidates.find((s) => !usedSatIds.has(s.id));
    // Fallback: reuse the highest if all are taken
    if (!pick && candidates.length > 0) pick = candidates[0];
    if (pick) {
      ue.servingSatId = pick.id;
      ue.servingBeamId = pick.beams[0].beamId;
      usedSatIds.add(pick.id);

      // Assign secondary (handover candidate) — next-best visible satellite
      const secondary = candidates.find(
        (s) => s.id !== pick!.id && !usedSatIds.has(s.id),
      );
      if (secondary) {
        ue.secondarySatId = secondary.id;
        ue.secondaryBeamId = secondary.beams[0].beamId;
      }
    }
  }
}

/** Per-tick satellite geometry + runtime state bundle. */
export interface SatelliteStateFrame {
  runtimeSatellites: SatelliteState[];
  observerSkyPhysicalSatellites?: SatelliteGeometryState[];
}
