import type { SatelliteGeometryState } from '@/sim/types';

export type SatelliteVisibilityZone = 'hidden' | 'ghost' | 'active';

export type RenderableSatelliteVisibilityZone = Exclude<SatelliteVisibilityZone, 'hidden'>;

export interface SatelliteDisplayState {
  satelliteId: number;
  zone: RenderableSatelliteVisibilityZone;
  renderPosition: [number, number, number];
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  opacity: number;
  modelScale?: number;
}

export interface SatelliteDisplayFrame {
  satellites: SatelliteDisplayState[];
  renderPositionsById: Map<number, [number, number, number]>;
}

export interface SatelliteDisplayCandidate {
  satellite: SatelliteGeometryState;
  zone: RenderableSatelliteVisibilityZone;
  sectorIndex: number;
  coverageRank: number;
}

export interface SatelliteDisplaySelectionConfig {
  minElevationDeg: number;
  displayBudget?: number;
  showGhosts?: boolean;
  coverageSectorCount?: number;
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
  minRenderElevationDeg?: number;
}

export interface SatelliteDisplayAdapterInput {
  satellites: readonly SatelliteDisplayCandidate[];
  config: SatelliteDisplayAdapterConfig;
}
