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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md (Section 1, 3.1, 3.4)
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md (Section D2)
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
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
  const normalizedElevation = clamp01((elevationDeg - minRenderElevationDeg) / Math.max(1, 90 - minRenderElevationDeg));
  const sceneExtentWorld =
    Math.max(options.config.areaWidthKm, options.config.areaHeightKm, 1) *
    Math.max(options.config.kmToWorldScale, 1e-9);
  const domeRadiusWorld = Math.max(320, sceneExtentWorld * (options.config.domeRadiusRatio ?? 3.2));
  const horizonLiftWorld = Math.max(
    32,
    sceneExtentWorld * (options.config.horizonLiftRatio ?? 0.28),
  );
  const azimuthRad = degToRad(azimuthDeg);
  // VISUAL-ONLY: controls elevation-to-radius mapping curvature
  const verticalCurveExponent = Math.max(0.35, options.config.verticalCurveExponent ?? 1);
  const boundaryWeight = Math.pow(1 - normalizedElevation, 0.58);
  const horizontalRadiusWorld = domeRadiusWorld * boundaryWeight;
  const lateralStretchRatio = Math.max(0.25, options.config.lateralStretchRatio ?? 1);
  const depthCompressionRatio = Math.max(0.2, options.config.depthCompressionRatio ?? 1);
  const verticalProgress = Math.pow(normalizedElevation, verticalCurveExponent);
  const verticalWorld = horizonLiftWorld + domeRadiusWorld * 0.72 * verticalProgress;

  return [
    horizontalRadiusWorld * lateralStretchRatio * Math.sin(azimuthRad),
    verticalWorld,
    horizontalRadiusWorld * depthCompressionRatio * Math.cos(azimuthRad),
  ];
}
