import type { SatelliteState } from '@/sim/types';

export interface SceneFocusServingBeamSelection {
  satId: number;
  beamId: number;
  normalizedDistance: number;
  elevationDeg: number;
}

function isBetterSelection(
  candidate: SceneFocusServingBeamSelection,
  currentBest: SceneFocusServingBeamSelection | null,
): boolean {
  if (currentBest === null) {
    return true;
  }

  if (candidate.normalizedDistance < currentBest.normalizedDistance - 1e-9) {
    return true;
  }

  if (Math.abs(candidate.normalizedDistance - currentBest.normalizedDistance) <= 1e-9) {
    if (candidate.elevationDeg > currentBest.elevationDeg + 1e-9) {
      return true;
    }
    if (Math.abs(candidate.elevationDeg - currentBest.elevationDeg) <= 1e-9) {
      if (candidate.satId < currentBest.satId) {
        return true;
      }
      if (candidate.satId === currentBest.satId && candidate.beamId < currentBest.beamId) {
        return true;
      }
    }
  }

  return false;
}

/**
 * VISUAL-ONLY helper:
 * Find the visible beam whose footprint actually covers the scene focus point.
 * This does not alter runtime handover or KPI logic.
 */
export function resolveSceneFocusServingBeam(
  satellites: readonly SatelliteState[],
  focusWorldXz: readonly [number, number],
): SceneFocusServingBeamSelection | null {
  let best: SceneFocusServingBeamSelection | null = null;

  for (const satellite of satellites) {
    if (!satellite.visible) {
      continue;
    }

    for (const beam of satellite.beams) {
      const dx = focusWorldXz[0] - beam.centerWorld[0];
      const dz = focusWorldXz[1] - beam.centerWorld[2];
      const distanceWorld = Math.hypot(dx, dz);
      if (distanceWorld > beam.radiusWorld) {
        continue;
      }

      const candidate: SceneFocusServingBeamSelection = {
        satId: satellite.id,
        beamId: beam.beamId,
        normalizedDistance: distanceWorld / Math.max(beam.radiusWorld, 1e-9),
        elevationDeg: satellite.elevationDeg,
      };

      if (isBetterSelection(candidate, best)) {
        best = candidate;
      }
    }
  }

  return best;
}
