import type { SatelliteState } from '@/sim/types';

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

export interface SatelliteDisplayAdapterConfig {
  areaWidthKm: number;
  areaHeightKm: number;
  minElevationDeg: number;
  kmToWorldScale?: number;
  displayBudget?: number;
  showGhosts?: boolean;
  activeOpacity?: number;
  ghostOpacity?: number;
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
  satellites: readonly SatelliteState[];
  config: SatelliteDisplayAdapterConfig;
}
