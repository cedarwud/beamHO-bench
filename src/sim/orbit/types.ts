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
  /** @deprecated Use replayWindowStartUtcMs. Kept for backward compat. */
  startTimeUtcMs: number;
  /**
   * Fixture-defined replay window start (UTC ms).
   * Deterministic for the same fixture; independent of wall-clock date.
   * Source: SDD RTLP §4.1 epoch contract.
   */
  replayWindowStartUtcMs: number;
  /**
   * Replay window duration in seconds (default 6000 s ≈ 100 min).
   * Used for demo-loop mode seam boundary.
   */
  replayWindowDurationSec: number;
  /**
   * Offset in seconds from replayWindowStartUtcMs that maximises NTPU-visible
   * satellite count (deterministic bootstrap, based on physical geometry only).
   * 0 if fixture does not include bootstrap metadata.
   */
  bootstrapStartOffsetSec: number;
  /**
   * Selection policy mode from fixture metadata.
   * 'constellation-even' = current default; 'observer-local-pass' = RTLP D2 target.
   */
  selectionPolicyMode: 'constellation-even' | 'observer-local-pass' | 'unknown';
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
