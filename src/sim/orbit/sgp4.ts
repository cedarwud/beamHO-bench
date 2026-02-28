import type { PaperProfile } from '@/config/paper-profiles/types';
import onewebFixtureJson from '@/data/tle/oneweb-sample.json';
import starlinkFixtureJson from '@/data/tle/starlink-sample.json';

/**
 * Provenance:
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 *
 * Note:
 * - This module currently uses a deterministic Kepler propagation fallback over
 *   TLE mean elements. Replace internals with true SGP4 once runtime dependency
 *   (`satellite.js`) is available in this environment.
 */

type Provider = 'starlink' | 'oneweb';

interface TleFixtureRecord {
  objectName: string;
  objectId: string;
  noradId: number;
  epochUtc: string;
  meanMotionRevPerDay: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  bstar: number;
}

interface TleFixtureFile {
  generatedAtUtc: string;
  provider: Provider;
  sourceFile: string;
  sourceRecordCount: number;
  sampledRecordCount: number;
  records: TleFixtureRecord[];
}

export interface OrbitElement {
  objectName: string;
  objectId: string;
  noradId: number;
  epochUtcMs: number;
  meanMotionRevPerDay: number;
  eccentricity: number;
  inclinationRad: number;
  raanRad: number;
  argPerigeeRad: number;
  meanAnomalyRad: number;
}

export interface OrbitCatalog {
  provider: Provider;
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

const STARLINK_FIXTURE = starlinkFixtureJson as TleFixtureFile;
const ONEWEB_FIXTURE = onewebFixtureJson as TleFixtureFile;

const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_A_KM = 6378.137;
const EARTH_F = 1 / 298.257223563;
const EARTH_B_KM = EARTH_A_KM * (1 - EARTH_F);
const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeAngleRad(rad: number): number {
  const normalized = rad % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function selectProvider(profile: PaperProfile): Provider {
  if (profile.constellation.tle?.provider === 'oneweb') {
    return 'oneweb';
  }
  return 'starlink';
}

function resolveFixture(provider: Provider): TleFixtureFile {
  return provider === 'starlink' ? STARLINK_FIXTURE : ONEWEB_FIXTURE;
}

function parseOrbitElement(record: TleFixtureRecord): OrbitElement | null {
  const epochUtcMs = Date.parse(record.epochUtc);
  if (!Number.isFinite(epochUtcMs)) {
    return null;
  }

  if (
    !Number.isFinite(record.noradId) ||
    record.noradId <= 0 ||
    !Number.isFinite(record.meanMotionRevPerDay) ||
    record.meanMotionRevPerDay <= 0 ||
    !Number.isFinite(record.eccentricity) ||
    record.eccentricity < 0 ||
    record.eccentricity >= 1
  ) {
    return null;
  }

  return {
    objectName: record.objectName,
    objectId: record.objectId,
    noradId: record.noradId,
    epochUtcMs,
    meanMotionRevPerDay: record.meanMotionRevPerDay,
    eccentricity: record.eccentricity,
    inclinationRad: degToRad(record.inclinationDeg),
    raanRad: degToRad(record.raanDeg),
    argPerigeeRad: degToRad(record.argPerigeeDeg),
    meanAnomalyRad: degToRad(record.meanAnomalyDeg),
  };
}

export function loadOrbitCatalog(profile: PaperProfile): OrbitCatalog {
  const provider = selectProvider(profile);
  const fixture = resolveFixture(provider);
  const maxSatellites = profile.constellation.tle?.selection?.maxSatellites;

  const parsed = fixture.records
    .map((record) => parseOrbitElement(record))
    .filter((record): record is OrbitElement => record !== null);

  const limit =
    typeof maxSatellites === 'number' && maxSatellites > 0
      ? Math.min(maxSatellites, parsed.length)
      : parsed.length;
  const records = parsed.slice(0, limit);
  if (records.length === 0) {
    throw new Error(`No valid orbit records available for provider '${provider}'`);
  }
  const startTimeUtcMs = records.reduce(
    (maxValue, record) => Math.max(maxValue, record.epochUtcMs),
    0,
  );

  return {
    provider,
    sourceFile: fixture.sourceFile,
    sourceRecordCount: fixture.sourceRecordCount,
    sampledRecordCount: records.length,
    records,
    startTimeUtcMs,
  };
}

function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  let eccentricAnomaly = meanAnomalyRad;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const f = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomalyRad;
    const fPrime = 1 - eccentricity * Math.cos(eccentricAnomaly);
    eccentricAnomaly -= f / Math.max(fPrime, 1e-9);
  }

  return eccentricAnomaly;
}

function gmstRad(utcMs: number): number {
  const jd = utcMs / 86400000 + 2440587.5;
  const centuries = (jd - 2451545.0) / 36525.0;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * centuries * centuries -
    (centuries * centuries * centuries) / 38710000;
  return normalizeAngleRad(degToRad(gmstDeg));
}

export function propagateOrbitElement(
  element: OrbitElement,
  atUtcMs: number,
): OrbitPoint {
  const meanMotionRadPerSec = (element.meanMotionRevPerDay * TWO_PI) / DAY_SEC;
  const semiMajorAxisKm = Math.cbrt(
    MU_EARTH_KM3_S2 / (meanMotionRadPerSec * meanMotionRadPerSec),
  );
  const deltaSec = (atUtcMs - element.epochUtcMs) / 1000;
  const meanAnomalyRad = normalizeAngleRad(
    element.meanAnomalyRad + meanMotionRadPerSec * deltaSec,
  );
  const eccentricAnomalyRad = solveEccentricAnomaly(
    meanAnomalyRad,
    element.eccentricity,
  );

  const trueAnomalyRad =
    2 *
    Math.atan2(
      Math.sqrt(1 + element.eccentricity) * Math.sin(eccentricAnomalyRad / 2),
      Math.sqrt(1 - element.eccentricity) * Math.cos(eccentricAnomalyRad / 2),
    );

  const radiusKm =
    semiMajorAxisKm * (1 - element.eccentricity * Math.cos(eccentricAnomalyRad));
  const argumentOfLatitude = element.argPerigeeRad + trueAnomalyRad;

  const cosOmega = Math.cos(element.raanRad);
  const sinOmega = Math.sin(element.raanRad);
  const cosI = Math.cos(element.inclinationRad);
  const sinI = Math.sin(element.inclinationRad);
  const cosU = Math.cos(argumentOfLatitude);
  const sinU = Math.sin(argumentOfLatitude);

  const xEciKm = radiusKm * (cosOmega * cosU - sinOmega * sinU * cosI);
  const yEciKm = radiusKm * (sinOmega * cosU + cosOmega * sinU * cosI);
  const zEciKm = radiusKm * (sinU * sinI);

  const theta = gmstRad(atUtcMs);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const xEcefKm = cosTheta * xEciKm + sinTheta * yEciKm;
  const yEcefKm = -sinTheta * xEciKm + cosTheta * yEciKm;
  const zEcefKm = zEciKm;

  const geo = ecefToGeodetic([xEcefKm, yEcefKm, zEcefKm]);

  return {
    ecefKm: [xEcefKm, yEcefKm, zEcefKm],
    latDeg: geo.latDeg,
    lonDeg: geo.lonDeg,
    altKm: geo.altKm,
  };
}

function geodeticToEcef(
  latDeg: number,
  lonDeg: number,
  altKm: number,
): [number, number, number] {
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);
  const e2 = 1 - (EARTH_B_KM * EARTH_B_KM) / (EARTH_A_KM * EARTH_A_KM);
  const n = EARTH_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);

  return [
    (n + altKm) * cosLat * cosLon,
    (n + altKm) * cosLat * sinLon,
    (n * (1 - e2) + altKm) * sinLat,
  ];
}

function ecefToGeodetic(ecefKm: [number, number, number]): {
  latDeg: number;
  lonDeg: number;
  altKm: number;
} {
  const [x, y, z] = ecefKm;
  const e2 = 1 - (EARTH_B_KM * EARTH_B_KM) / (EARTH_A_KM * EARTH_A_KM);
  const p = Math.hypot(x, y);
  const lonRad = Math.atan2(y, x);

  let latRad = Math.atan2(z, p * (1 - e2));
  let altKm = 0;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const sinLat = Math.sin(latRad);
    const n = EARTH_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);
    altKm = p / Math.max(Math.cos(latRad), 1e-9) - n;
    latRad = Math.atan2(z, p * (1 - (e2 * n) / Math.max(n + altKm, 1e-9)));
  }

  return {
    latDeg: radToDeg(latRad),
    lonDeg: radToDeg(lonRad),
    altKm,
  };
}

export function createObserverContext(
  latDeg: number,
  lonDeg: number,
  altKm = 0,
): ObserverContext {
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  return {
    latDeg,
    lonDeg,
    latRad,
    lonRad,
    ecefKm: geodeticToEcef(latDeg, lonDeg, altKm),
    sinLat: Math.sin(latRad),
    cosLat: Math.cos(latRad),
    sinLon: Math.sin(lonRad),
    cosLon: Math.cos(lonRad),
  };
}

export function computeTopocentricPoint(
  observer: ObserverContext,
  satEcefKm: [number, number, number],
): TopocentricPoint {
  const dx = satEcefKm[0] - observer.ecefKm[0];
  const dy = satEcefKm[1] - observer.ecefKm[1];
  const dz = satEcefKm[2] - observer.ecefKm[2];

  const eastKm = -observer.sinLon * dx + observer.cosLon * dy;
  const northKm =
    -observer.sinLat * observer.cosLon * dx -
    observer.sinLat * observer.sinLon * dy +
    observer.cosLat * dz;
  const upKm =
    observer.cosLat * observer.cosLon * dx +
    observer.cosLat * observer.sinLon * dy +
    observer.sinLat * dz;

  const rangeKm = Math.hypot(eastKm, northKm, upKm);
  const elevationRad = Math.asin(clamp(upKm / Math.max(rangeKm, 1e-9), -1, 1));
  let azimuthDeg = radToDeg(Math.atan2(eastKm, northKm));
  if (azimuthDeg < 0) {
    azimuthDeg += 360;
  }

  return {
    eastKm,
    northKm,
    upKm,
    rangeKm,
    azimuthDeg,
    elevationDeg: radToDeg(elevationRad),
  };
}

export function geoToWorldXZ(
  latDeg: number,
  lonDeg: number,
  observerLatDeg: number,
  observerLonDeg: number,
  kmToWorldScale: number,
): [number, number] {
  const kmNorth = (latDeg - observerLatDeg) * 110.574;
  const kmEast =
    (lonDeg - observerLonDeg) * (111.32 * Math.cos(degToRad(observerLatDeg)));
  return [kmEast * kmToWorldScale, kmNorth * kmToWorldScale];
}
