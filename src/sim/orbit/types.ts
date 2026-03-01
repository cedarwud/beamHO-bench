import type { SatRec } from 'satellite.js';

export type Provider = 'starlink' | 'oneweb';
export type OrbitPropagationEngine = 'kepler-fallback' | 'sgp4-satellitejs';

export interface OrbitElement {
  objectName: string;
  objectId: string;
  noradId: number;
  epochUtcMs: number;
  meanMotionRevPerDay: number;
  meanMotionDot: number;
  meanMotionDdot: number;
  elementSetNo: number;
  revAtEpoch: number;
  eccentricity: number;
  inclinationRad: number;
  raanRad: number;
  argPerigeeRad: number;
  meanAnomalyRad: number;
  bstar: number;
  satrec: SatRec | null;
}

export interface OrbitCatalog {
  provider: Provider;
  propagationEngine: OrbitPropagationEngine;
  sourceFile: string;
  sourceRecordCount: number;
  sampledRecordCount: number;
  records: OrbitElement[];
  startTimeUtcMs: number;
}

export interface ObserverContext {
  latDeg: number;
  lonDeg: number;
  latRad: number;
  lonRad: number;
  ecefKm: [number, number, number];
  sinLat: number;
  cosLat: number;
  sinLon: number;
  cosLon: number;
}

export interface OrbitPoint {
  ecefKm: [number, number, number];
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export interface TopocentricPoint {
  eastKm: number;
  northKm: number;
  upKm: number;
  rangeKm: number;
  azimuthDeg: number;
  elevationDeg: number;
}
