import type { SatelliteVisibilityZoneDecision } from './types';

function normalizeElevationDeg(value: number): number {
  if (!Number.isFinite(value)) {
    return -90;
  }
  return Math.max(-90, Math.min(90, value));
}

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-view-sdd.md (Section 3.1, 3.2)
 * - STD-3GPP-TR38.811-6.6.2-1
 *
 * Notes:
 * - Frontend display semantics keep the rise-pass-set split explicit:
 *   below-horizon is hidden, above-horizon but below theta_min is ghost,
 *   and theta_min+ is active/service-visible.
 */
export function classifySatelliteVisibilityZone(
  elevationDeg: number,
  minElevationDeg: number,
): SatelliteVisibilityZoneDecision {
  const normalizedElevationDeg = normalizeElevationDeg(elevationDeg);
  const normalizedMinElevationDeg = Math.max(0, normalizeElevationDeg(minElevationDeg));

  if (normalizedElevationDeg < 0) {
    return {
      zone: 'hidden',
      elevationDeg: normalizedElevationDeg,
      minElevationDeg: normalizedMinElevationDeg,
    };
  }

  if (normalizedElevationDeg < normalizedMinElevationDeg) {
    return {
      zone: 'ghost',
      elevationDeg: normalizedElevationDeg,
      minElevationDeg: normalizedMinElevationDeg,
    };
  }

  return {
    zone: 'active',
    elevationDeg: normalizedElevationDeg,
    minElevationDeg: normalizedMinElevationDeg,
  };
}
