import { projectObserverSkyPosition } from './observer-sky-projection';
import type {
  SatelliteDisplayCandidate,
  RenderableSatelliteVisibilityZone,
  SatelliteDisplayAdapterConfig,
  SatelliteDisplayAdapterInput,
  SatelliteDisplayFrame,
  SatelliteDisplayState,
} from './types';

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
    satellite: SatelliteDisplayCandidate;
    zone: RenderableSatelliteVisibilityZone;
  },
  right: {
    satellite: SatelliteDisplayCandidate;
    zone: RenderableSatelliteVisibilityZone;
  },
): number {
  const zoneComparison = compareZonePriority(left.zone, right.zone);
  if (zoneComparison !== 0) {
    return zoneComparison;
  }
  if (left.satellite.satellite.elevationDeg !== right.satellite.satellite.elevationDeg) {
    return right.satellite.satellite.elevationDeg - left.satellite.satellite.elevationDeg;
  }
  if (left.satellite.satellite.rangeKm !== right.satellite.satellite.rangeKm) {
    return left.satellite.satellite.rangeKm - right.satellite.satellite.rangeKm;
  }
  return left.satellite.satellite.id - right.satellite.satellite.id;
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

function estimateKmToWorldScale(satellites: readonly SatelliteDisplayCandidate[]): number {
  const estimates = satellites
    .map((satellite) => {
      if (!Number.isFinite(satellite.satellite.rangeKm) || satellite.satellite.rangeKm <= 0) {
        return null;
      }
      const [x, y, z] = satellite.satellite.positionWorld;
      const magnitudeWorld = Math.hypot(x, y, z);
      if (!Number.isFinite(magnitudeWorld) || magnitudeWorld <= 0) {
        return null;
      }
      return magnitudeWorld / satellite.satellite.rangeKm;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (estimates.length === 0) {
    return 0.6;
  }

  return estimates[Math.floor(estimates.length / 2)] ?? estimates[0] ?? 0.6;
}

function toDisplayState(options: {
  satellite: SatelliteDisplayCandidate;
  zone: RenderableSatelliteVisibilityZone;
  config: SatelliteDisplayAdapterConfig;
  kmToWorldScale: number;
}): SatelliteDisplayState {
  const { satellite, zone, config, kmToWorldScale } = options;
  return {
    satelliteId: satellite.satellite.id,
    zone,
    renderPosition: projectObserverSkyPosition({
      azimuthDeg: satellite.satellite.azimuthDeg,
      elevationDeg: satellite.satellite.elevationDeg,
      config: {
        areaWidthKm: config.areaWidthKm,
        areaHeightKm: config.areaHeightKm,
        kmToWorldScale,
        horizonLiftRatio: config.projection?.horizonLiftRatio,
        domeRadiusRatio: config.projection?.domeRadiusRatio,
        minRenderElevationDeg: config.projection?.minRenderElevationDeg ?? 0,
      },
    }),
    azimuthDeg: satellite.satellite.azimuthDeg,
    elevationDeg: satellite.satellite.elevationDeg,
    rangeKm: satellite.satellite.rangeKm,
    opacity: resolveOpacity({ zone, config }),
  };
}

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md (Section 3.2, 3.3, 3.4, 6)
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md (Section 3.1, 3.3, 3.6, 6)
 *
 * Notes:
 * - This adapter is deterministic for the same candidate set + config.
 * - Hidden/ghost selection and continuity are resolved before this assembly step.
 */
export function buildSatelliteDisplayFrame(
  input: SatelliteDisplayAdapterInput,
): SatelliteDisplayFrame {
  const { satellites, config } = input;
  const kmToWorldScale = config.kmToWorldScale ?? estimateKmToWorldScale(satellites);
  const selected = satellites
    .map((candidate) => ({
      satellite: candidate,
      zone: candidate.zone,
    }))
    .sort(compareDisplayPriority)
    .map(({ satellite, zone }) =>
      toDisplayState({
        satellite,
        zone,
        config,
        kmToWorldScale,
      }),
    );

  return {
    satellites: selected,
    renderPositionsById: new Map(
      selected.map((satellite) => [satellite.satelliteId, satellite.renderPosition]),
    ),
  };
}
