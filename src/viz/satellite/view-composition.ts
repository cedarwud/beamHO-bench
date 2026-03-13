import { NTPU_CONFIG, type Vec3 } from '@/config/ntpu.config';

/**
 * Provenance:
 * - docs/zh-TW/07-observer-sky-visual-acceptance.md (Section 2, 5, 7, 8, 10)
 * - sdd/pending/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.1, 3.2, 3.3, 3.4, 3.6, 7)
 *
 * Notes:
 * - Composition policy stays in the frontend view layer and remains separate
 *   from runtime/simulation contracts.
 * - The NTPU default scene camera remains available as an auxiliary campus view.
 */

export type ObserverSkyCompositionModeId = 'observer-sky-primary' | 'campus-overview';

export interface ObserverSkyCompositionCamera {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
}

export interface ObserverSkyCompositionControls {
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export interface ObserverSkyProjectionPolicy {
  horizonLiftRatio: number;
  domeRadiusRatio: number;
  minRenderElevationDeg: number;
}

export interface ObserverSkyEvaluationViewport {
  widthPx: number;
  heightPx: number;
}

export interface ObserverSkyScreenSpaceAcceptance {
  minHorizontalSpan: number;
  minVerticalSpan: number;
  minHorizontalBandCount: number;
  minVerticalBandCount: number;
  topClusterRegionWidth: number;
  topClusterRegionHeight: number;
  maxTopClusterShare: number;
  phaseLowElevationDeg: number;
  phaseHighElevationDeg: number;
  boundaryEdgeInset: number;
  boundaryLowerBandY: number;
  maxRetainedStepDistance: number;
}

export interface ObserverSkyCompositionConfig {
  modeId: ObserverSkyCompositionModeId;
  label: string;
  description: string;
  primaryAcceptedView: boolean;
  sourceId: string;
  camera: ObserverSkyCompositionCamera;
  controls: ObserverSkyCompositionControls;
  projection: ObserverSkyProjectionPolicy;
  evaluationViewport: ObserverSkyEvaluationViewport;
  screenSpaceAcceptance: ObserverSkyScreenSpaceAcceptance;
}

function cloneVec3(value: Vec3): Vec3 {
  return [...value] as Vec3;
}

function cloneComposition(
  value: ObserverSkyCompositionConfig,
): ObserverSkyCompositionConfig {
  return {
    ...value,
    camera: {
      ...value.camera,
      position: cloneVec3(value.camera.position),
      target: cloneVec3(value.camera.target),
    },
    controls: { ...value.controls },
    projection: { ...value.projection },
    evaluationViewport: { ...value.evaluationViewport },
    screenSpaceAcceptance: { ...value.screenSpaceAcceptance },
  };
}

const PRIMARY_EVALUATION_VIEWPORT: ObserverSkyEvaluationViewport = {
  widthPx: 1600,
  heightPx: 900,
};

const DEFAULT_SCREEN_SPACE_ACCEPTANCE: ObserverSkyScreenSpaceAcceptance = {
  // Source: ASSUME-OBSERVER-SKY-SCREENSPACE-ACCEPTANCE
  minHorizontalSpan: 0.56,
  minVerticalSpan: 0.3,
  minHorizontalBandCount: 4,
  minVerticalBandCount: 2,
  topClusterRegionWidth: 0.34,
  topClusterRegionHeight: 0.34,
  maxTopClusterShare: 0.5,
  phaseLowElevationDeg: 24,
  phaseHighElevationDeg: 46,
  boundaryEdgeInset: 0.15,
  boundaryLowerBandY: 0.58,
  maxRetainedStepDistance: 0.24,
};

const COMPOSITIONS: Record<ObserverSkyCompositionModeId, ObserverSkyCompositionConfig> = {
  'observer-sky-primary': {
    // Source: ASSUME-OBSERVER-SKY-PRIMARY-COMPOSITION
    modeId: 'observer-sky-primary',
    label: 'Observer Sky Primary',
    description:
      'Accepted god-view composition centered on the observer sky dome so rise, pass, and set remain readable.',
    primaryAcceptedView: true,
    sourceId: 'ASSUME-OBSERVER-SKY-PRIMARY-COMPOSITION',
    camera: {
      position: [0, 118, 620],
      target: [0, 155, 0],
      fov: 28,
      near: NTPU_CONFIG.camera.near,
      far: NTPU_CONFIG.camera.far,
    },
    controls: {
      enableDamping: NTPU_CONFIG.controls.enableDamping,
      dampingFactor: NTPU_CONFIG.controls.dampingFactor,
      minDistance: 280,
      maxDistance: 1300,
      minPolarAngle: 0.15,
      maxPolarAngle: 1.25,
    },
    projection: {
      horizonLiftRatio: 0.18,
      domeRadiusRatio: 2.45,
      minRenderElevationDeg: 0,
    },
    evaluationViewport: PRIMARY_EVALUATION_VIEWPORT,
    screenSpaceAcceptance: DEFAULT_SCREEN_SPACE_ACCEPTANCE,
  },
  'campus-overview': {
    modeId: 'campus-overview',
    label: 'Campus Overview',
    description:
      'Auxiliary campus-wide third-person view preserved for context, not for observer-sky acceptance.',
    primaryAcceptedView: false,
    sourceId: 'ASSUME-OBSERVER-SKY-PRIMARY-COMPOSITION',
    camera: {
      position: cloneVec3(NTPU_CONFIG.camera.initialPosition),
      target: cloneVec3(NTPU_CONFIG.camera.target),
      fov: NTPU_CONFIG.camera.fov,
      near: NTPU_CONFIG.camera.near,
      far: NTPU_CONFIG.camera.far,
    },
    controls: {
      enableDamping: NTPU_CONFIG.controls.enableDamping,
      dampingFactor: NTPU_CONFIG.controls.dampingFactor,
      minDistance: NTPU_CONFIG.controls.minDistance,
      maxDistance: NTPU_CONFIG.controls.maxDistance,
      minPolarAngle: NTPU_CONFIG.controls.minPolarAngle,
      maxPolarAngle: NTPU_CONFIG.controls.maxPolarAngle,
    },
    projection: {
      horizonLiftRatio: 0.28,
      domeRadiusRatio: 3.2,
      minRenderElevationDeg: 0,
    },
    evaluationViewport: PRIMARY_EVALUATION_VIEWPORT,
    screenSpaceAcceptance: DEFAULT_SCREEN_SPACE_ACCEPTANCE,
  },
};

export function getObserverSkyComposition(
  modeId: ObserverSkyCompositionModeId,
): ObserverSkyCompositionConfig {
  return cloneComposition(COMPOSITIONS[modeId]);
}

export function listObserverSkyCompositions(): ObserverSkyCompositionConfig[] {
  return (Object.keys(COMPOSITIONS) as ObserverSkyCompositionModeId[]).map((modeId) =>
    cloneComposition(COMPOSITIONS[modeId]),
  );
}
