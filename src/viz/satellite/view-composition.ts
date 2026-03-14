import { NTPU_CONFIG, type Vec3 } from '@/config/ntpu.config';

/**
 * Provenance:
 * - docs/zh-TW/07-observer-sky-visual-acceptance.md (Section 2, 5, 7, 8, 10)
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.1, 3.2, 3.3, 3.4, 3.6, 7)
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
  lateralStretchRatio: number;
  depthCompressionRatio: number;
  centerRetentionRatio: number;
  verticalCurveExponent: number;
  minRenderElevationDeg: number;
}

export interface ObserverSkyPassLayoutPolicy {
  boundaryAnchorXRatio: number;
  boundaryAnchorYRatio: number;
  laneSpreadRatio: number;
  laneDepthSpreadRatio: number;
  phaseLateralBiasRatio: {
    boundary: number;
    mid: number;
    high: number;
  };
  phaseVerticalBiasRatio: {
    boundary: number;
    mid: number;
    high: number;
  };
  phaseEntryLeadRatio: {
    boundary: number;
    mid: number;
    high: number;
  };
  exitLingerTicks: number;
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
  passLayout: ObserverSkyPassLayoutPolicy;
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
    passLayout: {
      ...value.passLayout,
      phaseLateralBiasRatio: { ...value.passLayout.phaseLateralBiasRatio },
      phaseVerticalBiasRatio: { ...value.passLayout.phaseVerticalBiasRatio },
      phaseEntryLeadRatio: { ...value.passLayout.phaseEntryLeadRatio },
    },
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
  boundaryEdgeInset: 0.25,
  boundaryLowerBandY: 0.42,
  maxRetainedStepDistance: 0.32,
};

const PRIMARY_PASS_LAYOUT: ObserverSkyPassLayoutPolicy = {
  // Source: ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
  boundaryAnchorXRatio: 1.18,
  boundaryAnchorYRatio: 0.22,
  laneSpreadRatio: 0.22,
  laneDepthSpreadRatio: 0.08,
  phaseLateralBiasRatio: {
    boundary: 0.18,
    mid: 0.11,
    high: 0.05,
  },
  phaseVerticalBiasRatio: {
    boundary: -0.08,
    mid: 0,
    high: 0.09,
  },
  phaseEntryLeadRatio: {
    boundary: 0.14,
    mid: 0.18,
    high: 0.12,
  },
  exitLingerTicks: 8,
};

const CAMPUS_PASS_LAYOUT: ObserverSkyPassLayoutPolicy = {
  // Source: ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
  boundaryAnchorXRatio: 1.08,
  boundaryAnchorYRatio: 0.18,
  laneSpreadRatio: 0.12,
  laneDepthSpreadRatio: 0.05,
  phaseLateralBiasRatio: {
    boundary: 0.08,
    mid: 0.04,
    high: 0.02,
  },
  phaseVerticalBiasRatio: {
    boundary: -0.04,
    mid: 0,
    high: 0.04,
  },
  phaseEntryLeadRatio: {
    boundary: 0.08,
    mid: 0.1,
    high: 0.08,
  },
  exitLingerTicks: 6,
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
      position: [0, 900, 1200],
      target: [0, 100, 0],
      fov: 38,
      near: NTPU_CONFIG.camera.near,
      far: NTPU_CONFIG.camera.far,
    },
    controls: {
      enableDamping: NTPU_CONFIG.controls.enableDamping,
      dampingFactor: NTPU_CONFIG.controls.dampingFactor,
      minDistance: 400,
      maxDistance: 1600,
      minPolarAngle: 0.15,
      maxPolarAngle: Math.PI / 2,
    },
    projection: {
      // Source: ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
      horizonLiftRatio: 0.18,
      domeRadiusRatio: 4.5,
      lateralStretchRatio: 1.3,
      depthCompressionRatio: 0.65,
      centerRetentionRatio: 0,
      verticalCurveExponent: 0.55,
      minRenderElevationDeg: 0,
    },
    passLayout: PRIMARY_PASS_LAYOUT,
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
      lateralStretchRatio: 1,
      depthCompressionRatio: 1,
      centerRetentionRatio: 0,
      verticalCurveExponent: 1,
      minRenderElevationDeg: 0,
    },
    passLayout: CAMPUS_PASS_LAYOUT,
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
