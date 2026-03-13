import { PerspectiveCamera, Vector3 } from 'three';
import type { SatelliteDisplayFrame, SatelliteDisplayState } from './types';
import type {
  ObserverSkyCompositionConfig,
  ObserverSkyEvaluationViewport,
  ObserverSkyScreenSpaceAcceptance,
} from './view-composition';

/**
 * Provenance:
 * - docs/zh-TW/07-observer-sky-visual-acceptance.md (Section 4, 5, 7, 8, 10, 11)
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.3, 3.4, 3.5, 4, 5)
 *
 * Notes:
 * - This helper evaluates the accepted frontend composition in screen space.
 * - It does not change runtime ownership or satellite projection semantics.
 */

export interface SatelliteScreenSpacePoint {
  satelliteId: number;
  zone: SatelliteDisplayState['zone'];
  elevationDeg: number;
  screenX: number;
  screenY: number;
  ndcX: number;
  ndcY: number;
}

export interface ScreenSpaceSpreadMetrics {
  pointCount: number;
  horizontalSpan: number;
  verticalSpan: number;
  horizontalBandCount: number;
  verticalBandCount: number;
  topClusterShare: number;
}

export interface PassReadabilityMetrics {
  totalComparableSatellites: number;
  phaseCounts: Record<'rising' | 'passing' | 'setting', number>;
}

export interface ContinuityReadabilityMetrics {
  retainedCount: number;
  averageRetainedStepDistance: number;
  maxRetainedStepDistance: number;
  entryCount: number;
  exitCount: number;
  boundaryEntryShare: number;
  boundaryExitShare: number;
  nonBoundaryEntries: number;
  nonBoundaryExits: number;
}

function resolveViewport(
  composition: ObserverSkyCompositionConfig,
  viewport?: ObserverSkyEvaluationViewport,
): ObserverSkyEvaluationViewport {
  return viewport ?? composition.evaluationViewport;
}

function createCompositionCamera(
  composition: ObserverSkyCompositionConfig,
  viewport: ObserverSkyEvaluationViewport,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    composition.camera.fov,
    viewport.widthPx / Math.max(viewport.heightPx, 1),
    composition.camera.near,
    composition.camera.far,
  );
  camera.position.set(...composition.camera.position);
  camera.lookAt(...composition.camera.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function toScreenSpacePoint(
  camera: PerspectiveCamera,
  satellite: SatelliteDisplayState,
): SatelliteScreenSpacePoint {
  const projected = new Vector3(...satellite.renderPosition).project(camera);
  return {
    satelliteId: satellite.satelliteId,
    zone: satellite.zone,
    elevationDeg: satellite.elevationDeg,
    ndcX: projected.x,
    ndcY: projected.y,
    screenX: (projected.x + 1) / 2,
    screenY: (1 - projected.y) / 2,
  };
}

function countOccupiedBands(
  values: readonly number[],
  bandCount: number,
): number {
  if (values.length === 0 || bandCount <= 0) {
    return 0;
  }
  const occupied = new Set<number>();
  for (const value of values) {
    const clamped = Math.min(0.999999, Math.max(0, value));
    occupied.add(Math.min(bandCount - 1, Math.floor(clamped * bandCount)));
  }
  return occupied.size;
}

function computeSpan(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function isInTopClusterRegion(
  point: SatelliteScreenSpacePoint,
  acceptance: ObserverSkyScreenSpaceAcceptance,
): boolean {
  const halfWidth = acceptance.topClusterRegionWidth / 2;
  return (
    point.screenX >= 0.5 - halfWidth &&
    point.screenX <= 0.5 + halfWidth &&
    point.screenY <= acceptance.topClusterRegionHeight
  );
}

function isBoundaryLikePoint(
  point: SatelliteScreenSpacePoint,
  acceptance: ObserverSkyScreenSpaceAcceptance,
): boolean {
  return (
    point.screenX <= acceptance.boundaryEdgeInset ||
    point.screenX >= 1 - acceptance.boundaryEdgeInset ||
    point.screenY >= acceptance.boundaryLowerBandY
  );
}

function classifyPassPhase(options: {
  previous: SatelliteDisplayState;
  current: SatelliteDisplayState;
  next: SatelliteDisplayState;
  acceptance: ObserverSkyScreenSpaceAcceptance;
}): 'rising' | 'passing' | 'setting' {
  const { previous, current, next, acceptance } = options;
  const deltaIn = current.elevationDeg - previous.elevationDeg;
  const deltaOut = next.elevationDeg - current.elevationDeg;

  if (current.elevationDeg >= acceptance.phaseHighElevationDeg || (deltaIn > 0 && deltaOut < 0)) {
    return 'passing';
  }
  if (deltaIn >= 0 && deltaOut >= 0) {
    return 'rising';
  }
  if (deltaIn <= 0 && deltaOut <= 0) {
    return 'setting';
  }
  if (deltaOut > 0 || current.elevationDeg <= acceptance.phaseLowElevationDeg) {
    return 'rising';
  }
  if (deltaIn < 0) {
    return 'setting';
  }
  return 'passing';
}

export function projectSatelliteFrameToScreenSpace(options: {
  frame: SatelliteDisplayFrame;
  composition: ObserverSkyCompositionConfig;
  viewport?: ObserverSkyEvaluationViewport;
}): SatelliteScreenSpacePoint[] {
  const viewport = resolveViewport(options.composition, options.viewport);
  const camera = createCompositionCamera(options.composition, viewport);
  return options.frame.satellites.map((satellite) => toScreenSpacePoint(camera, satellite));
}

export function evaluateScreenSpaceSpread(options: {
  frame: SatelliteDisplayFrame;
  composition: ObserverSkyCompositionConfig;
  viewport?: ObserverSkyEvaluationViewport;
}): ScreenSpaceSpreadMetrics {
  const points = projectSatelliteFrameToScreenSpace(options);
  const acceptance = options.composition.screenSpaceAcceptance;
  const horizontalValues = points.map((point) => point.screenX);
  const verticalValues = points.map((point) => point.screenY);
  const topClusterCount = points.filter((point) => isInTopClusterRegion(point, acceptance)).length;

  return {
    pointCount: points.length,
    horizontalSpan: computeSpan(horizontalValues),
    verticalSpan: computeSpan(verticalValues),
    horizontalBandCount: countOccupiedBands(
      horizontalValues,
      acceptance.minHorizontalBandCount,
    ),
    verticalBandCount: countOccupiedBands(
      verticalValues,
      acceptance.minVerticalBandCount,
    ),
    topClusterShare: points.length > 0 ? topClusterCount / points.length : 0,
  };
}

export function evaluatePassReadability(options: {
  previousFrame: SatelliteDisplayFrame;
  currentFrame: SatelliteDisplayFrame;
  nextFrame: SatelliteDisplayFrame;
  composition: ObserverSkyCompositionConfig;
}): PassReadabilityMetrics {
  const previousById = new Map(
    options.previousFrame.satellites.map((satellite) => [satellite.satelliteId, satellite]),
  );
  const nextById = new Map(
    options.nextFrame.satellites.map((satellite) => [satellite.satelliteId, satellite]),
  );
  const acceptance = options.composition.screenSpaceAcceptance;
  const phaseCounts: PassReadabilityMetrics['phaseCounts'] = {
    rising: 0,
    passing: 0,
    setting: 0,
  };

  for (const satellite of options.currentFrame.satellites) {
    const previous = previousById.get(satellite.satelliteId);
    const next = nextById.get(satellite.satelliteId);
    if (!previous || !next) {
      continue;
    }
    phaseCounts[
      classifyPassPhase({
        previous,
        current: satellite,
        next,
        acceptance,
      })
    ] += 1;
  }

  return {
    totalComparableSatellites: Object.values(phaseCounts).reduce((sum, count) => sum + count, 0),
    phaseCounts,
  };
}

export function evaluateContinuityReadability(options: {
  previousFrame: SatelliteDisplayFrame;
  currentFrame: SatelliteDisplayFrame;
  composition: ObserverSkyCompositionConfig;
  viewport?: ObserverSkyEvaluationViewport;
}): ContinuityReadabilityMetrics {
  const acceptance = options.composition.screenSpaceAcceptance;
  const previousPoints = projectSatelliteFrameToScreenSpace({
    frame: options.previousFrame,
    composition: options.composition,
    viewport: options.viewport,
  });
  const currentPoints = projectSatelliteFrameToScreenSpace({
    frame: options.currentFrame,
    composition: options.composition,
    viewport: options.viewport,
  });
  const previousById = new Map(previousPoints.map((point) => [point.satelliteId, point]));
  const currentById = new Map(currentPoints.map((point) => [point.satelliteId, point]));
  const retainedDistances: number[] = [];
  const entries: SatelliteScreenSpacePoint[] = [];
  const exits: SatelliteScreenSpacePoint[] = [];

  for (const point of currentPoints) {
    const previous = previousById.get(point.satelliteId);
    if (!previous) {
      entries.push(point);
      continue;
    }
    retainedDistances.push(
      Math.hypot(point.screenX - previous.screenX, point.screenY - previous.screenY),
    );
  }

  for (const point of previousPoints) {
    if (!currentById.has(point.satelliteId)) {
      exits.push(point);
    }
  }

  const boundaryEntryCount = entries.filter((point) =>
    isBoundaryLikePoint(point, acceptance),
  ).length;
  const boundaryExitCount = exits.filter((point) =>
    isBoundaryLikePoint(point, acceptance),
  ).length;

  return {
    retainedCount: retainedDistances.length,
    averageRetainedStepDistance:
      retainedDistances.length > 0
        ? retainedDistances.reduce((sum, value) => sum + value, 0) / retainedDistances.length
        : 0,
    maxRetainedStepDistance:
      retainedDistances.length > 0 ? Math.max(...retainedDistances) : 0,
    entryCount: entries.length,
    exitCount: exits.length,
    boundaryEntryShare: entries.length > 0 ? boundaryEntryCount / entries.length : 1,
    boundaryExitShare: exits.length > 0 ? boundaryExitCount / exits.length : 1,
    nonBoundaryEntries: entries.length - boundaryEntryCount,
    nonBoundaryExits: exits.length - boundaryExitCount,
  };
}
