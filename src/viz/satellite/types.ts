import type { SatelliteGeometryState } from '@/sim/types';

export type SatelliteVisibilityZone = 'hidden' | 'ghost' | 'active';

export type RenderableSatelliteVisibilityZone = Exclude<SatelliteVisibilityZone, 'hidden'>;
export type SatelliteDisplayPhase =
  | 'boundary-ingress'
  | 'mid-pass'
  | 'high-pass'
  | 'boundary-egress';
export type SatelliteDisplayEdge = 'left' | 'right';
export type SatelliteDisplayLifecycle = 'entering' | 'tracked' | 'exiting';

export interface SatelliteDisplayState {
  satelliteId: number;
  zone: RenderableSatelliteVisibilityZone;
  renderPosition: [number, number, number];
  motionSourcePosition?: [number, number, number];
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  opacity: number;
  modelScale?: number;
  phase?: SatelliteDisplayPhase;
  edge?: SatelliteDisplayEdge;
  lifecycle?: SatelliteDisplayLifecycle;
}

export interface SatelliteDisplayFrame {
  satellites: SatelliteDisplayState[];
  renderPositionsById: Map<number, [number, number, number]>;
}

export interface SatelliteDisplayCandidate {
  satellite: SatelliteGeometryState;
  zone: RenderableSatelliteVisibilityZone;
  sectorIndex: number;
  phase: SatelliteDisplayPhase;
  coverageRank: number;
}

export interface SatelliteDisplaySelectionConfig {
  minElevationDeg: number;
  displayBudget?: number;
  showGhosts?: boolean;
  coverageSectorCount?: number;
  phaseLowElevationDeg?: number;
  phaseHighElevationDeg?: number;
}

export interface SatelliteDisplaySelectionInput {
  satellites: readonly SatelliteGeometryState[];
  config: SatelliteDisplaySelectionConfig;
}

export interface SatelliteDisplaySelectionState {
  budget: number;
  coverageSectorCount: number;
  candidates: SatelliteDisplayCandidate[];
  selected: SatelliteDisplayCandidate[];
  selectedIds: number[];
  retainedIds: number[];
  droppedIds: number[];
}

export interface SatelliteDisplayContinuityConfig {
  retentionRankSlack?: number;
}

export interface SatelliteDisplayContinuityMemory {
  sequenceKey: string;
  tick: number;
  timeSec: number;
  selectedIds: number[];
  actors?: SatelliteDisplayActorMemory[];
}

export interface SatelliteDisplayContinuityInput {
  candidates: readonly SatelliteDisplayCandidate[];
  displayBudget?: number;
  sequenceKey: string;
  tick: number;
  timeSec: number;
  memory?: SatelliteDisplayContinuityMemory | null;
  config?: SatelliteDisplayContinuityConfig;
}

export interface SatelliteDisplayActorMemory {
  satelliteId: number;
  renderPosition: [number, number, number];
  phase: SatelliteDisplayPhase;
  edge: SatelliteDisplayEdge;
  zone: RenderableSatelliteVisibilityZone;
  opacity: number;
  exitTicksRemaining: number;
}

export interface SatelliteDisplayAdapterConfig {
  areaWidthKm: number;
  areaHeightKm: number;
  minElevationDeg: number;
  kmToWorldScale?: number;
  activeOpacity?: number;
  ghostOpacity?: number;
  projection?: {
    horizonLiftRatio?: number;
    domeRadiusRatio?: number;
    lateralStretchRatio?: number;
    depthCompressionRatio?: number;
    verticalCurveExponent?: number;
    minRenderElevationDeg?: number;
  };
}

export interface SatelliteVisibilityZoneDecision {
  zone: SatelliteVisibilityZone;
  elevationDeg: number;
  minElevationDeg: number;
}

export interface ObserverSkyProjectionConfig {
  areaWidthKm: number;
  areaHeightKm: number;
  kmToWorldScale: number;
  horizonLiftRatio?: number;
  domeRadiusRatio?: number;
  lateralStretchRatio?: number;
  depthCompressionRatio?: number;
  verticalCurveExponent?: number;
  minRenderElevationDeg?: number;
}

export interface SatelliteDisplayAdapterInput {
  satellites: readonly SatelliteDisplayCandidate[];
  config: SatelliteDisplayAdapterConfig;
}
