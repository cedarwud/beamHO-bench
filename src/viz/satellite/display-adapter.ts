import type { SatelliteState } from '@/sim/types';
import { projectObserverSkyPosition } from './observer-sky-projection';
import type {
  RenderableSatelliteVisibilityZone,
  SatelliteDisplayAdapterConfig,
  SatelliteDisplayAdapterInput,
  SatelliteDisplayFrame,
  SatelliteDisplayState,
} from './types';
import { classifySatelliteVisibilityZone } from './visibility-zones';

function compareZonePriority(
  left: RenderableSatelliteVisibilityZone,
  right: RenderableSatelliteVisibilityZone,
): number {
  if (left === right) {
    return 0;
  }
  return left === 'active' ? -1 : 1;
}

function compareDisplayPriority(
  left: {
    satellite: SatelliteState;
    zone: RenderableSatelliteVisibilityZone;
  },
  right: {
    satellite: SatelliteState;
    zone: RenderableSatelliteVisibilityZone;
  },
): number {
  const zoneComparison = compareZonePriority(left.zone, right.zone);
  if (zoneComparison !== 0) {
    return zoneComparison;
  }
  if (left.satellite.elevationDeg !== right.satellite.elevationDeg) {
    return right.satellite.elevationDeg - left.satellite.elevationDeg;
  }
  if (left.satellite.rangeKm !== right.satellite.rangeKm) {
    return left.satellite.rangeKm - right.satellite.rangeKm;
  }
  return left.satellite.id - right.satellite.id;
}

function resolveOpacity(options: {
  zone: RenderableSatelliteVisibilityZone;
  config: SatelliteDisplayAdapterConfig;
}): number {
  if (options.zone === 'ghost') {
    return options.config.ghostOpacity ?? 0.35;
  }
  return options.config.activeOpacity ?? 1;
}

function estimateKmToWorldScale(satellites: readonly SatelliteState[]): number {
  const estimates = satellites
    .map((satellite) => {
      if (!Number.isFinite(satellite.rangeKm) || satellite.rangeKm <= 0) {
        return null;
      }
      const [x, y, z] = satellite.positionWorld;
      const magnitudeWorld = Math.hypot(x, y, z);
      if (!Number.isFinite(magnitudeWorld) || magnitudeWorld <= 0) {
        return null;
      }
      return magnitudeWorld / satellite.rangeKm;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (estimates.length === 0) {
    return 0.6;
  }

  return estimates[Math.floor(estimates.length / 2)] ?? estimates[0] ?? 0.6;
}

function toDisplayState(options: {
  satellite: SatelliteState;
  zone: RenderableSatelliteVisibilityZone;
  config: SatelliteDisplayAdapterConfig;
  kmToWorldScale: number;
}): SatelliteDisplayState {
  const { satellite, zone, config, kmToWorldScale } = options;
  return {
    satelliteId: satellite.id,
    zone,
    renderPosition: projectObserverSkyPosition({
      azimuthDeg: satellite.azimuthDeg,
      elevationDeg: satellite.elevationDeg,
      config: {
        areaWidthKm: config.areaWidthKm,
        areaHeightKm: config.areaHeightKm,
        kmToWorldScale,
        minRenderElevationDeg: 0,
      },
    }),
    azimuthDeg: satellite.azimuthDeg,
    elevationDeg: satellite.elevationDeg,
    rangeKm: satellite.rangeKm,
    opacity: resolveOpacity({ zone, config }),
  };
}

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-view-sdd.md (Section 3.2, 3.3, 3.4, 6)
 *
 * Notes:
 * - This adapter is deterministic for the same snapshot + config.
 * - Hidden satellites are removed here so renderer-only components never need
 *   to interpret frontend visibility semantics.
 */
export function buildSatelliteDisplayFrame(
  input: SatelliteDisplayAdapterInput,
): SatelliteDisplayFrame {
  const { satellites, config } = input;
  const kmToWorldScale = config.kmToWorldScale ?? estimateKmToWorldScale(satellites);
  const showGhosts = config.showGhosts ?? true;
  const renderable = satellites
    .map((satellite) => {
      const zoneDecision = classifySatelliteVisibilityZone(
        satellite.elevationDeg,
        config.minElevationDeg,
      );
      if (zoneDecision.zone === 'hidden') {
        return null;
      }
      if (zoneDecision.zone === 'ghost' && !showGhosts) {
        return null;
      }
      return {
        satellite,
        zone: zoneDecision.zone,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        satellite: SatelliteState;
        zone: RenderableSatelliteVisibilityZone;
      } => candidate !== null,
    )
    .sort(compareDisplayPriority)
    .map(({ satellite, zone }) =>
      toDisplayState({
        satellite,
        zone,
        config,
        kmToWorldScale,
      }),
    );
  const budget = config.displayBudget;
  const selected =
    budget !== undefined && Number.isFinite(budget) && budget >= 0
      ? renderable.slice(0, Math.floor(budget))
      : renderable;

  return {
    satellites: selected,
    renderPositionsById: new Map(
      selected.map((satellite) => [satellite.satelliteId, satellite.renderPosition]),
    ),
  };
}
