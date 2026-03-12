import type { ObserverSkyProjectionConfig } from './types';

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function clampFinite(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-view-sdd.md (Section 1, 3.1, 3.4)
 *
 * Notes:
 * - This is a frontend-only observer-centric sky projection.
 * - Azimuth controls horizon-side entry/exit direction and elevation controls
 *   the sky-arc height above the local observer.
 */
export function projectObserverSkyPosition(options: {
  azimuthDeg: number;
  elevationDeg: number;
  config: ObserverSkyProjectionConfig;
}): [number, number, number] {
  const azimuthDeg = clampFinite(options.azimuthDeg, 0);
  const minRenderElevationDeg = options.config.minRenderElevationDeg ?? 0;
  const elevationDeg = Math.max(
    minRenderElevationDeg,
    clampFinite(options.elevationDeg, minRenderElevationDeg),
  );
  const sceneExtentWorld =
    Math.max(options.config.areaWidthKm, options.config.areaHeightKm, 1) *
    Math.max(options.config.kmToWorldScale, 1e-9);
  const domeRadiusWorld = Math.max(180, sceneExtentWorld * (options.config.domeRadiusRatio ?? 3.2));
  const horizonLiftWorld = Math.max(
    18,
    sceneExtentWorld * (options.config.horizonLiftRatio ?? 0.28),
  );
  const azimuthRad = degToRad(azimuthDeg);
  const elevationRad = degToRad(elevationDeg);
  const horizontalRadiusWorld = domeRadiusWorld * Math.cos(elevationRad);

  return [
    horizontalRadiusWorld * Math.sin(azimuthRad),
    horizonLiftWorld + domeRadiusWorld * Math.sin(elevationRad),
    horizontalRadiusWorld * Math.cos(azimuthRad),
  ];
}
