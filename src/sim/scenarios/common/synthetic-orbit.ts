import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  computeTopocentricPoint,
  createObserverContext,
  geoToWorldXZ,
  type ObserverContext,
} from '@/sim/orbit/sgp4';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - ASSUME-PAPER-BASELINE-SYNTHETIC-TRAJECTORY-MODE
 * - ASSUME-WALKER-CIRCULAR-PHASING
 *
 * Notes:
 * - This module provides deterministic synthetic orbit kinematics for paper-baseline mode.
 * - It is intentionally parameterized by profile constellation fields and does not parse TLE.
 */

const TWO_PI = Math.PI * 2;
const EARTH_RADIUS_KM = 6378.137;
const EARTH_MU_KM3_PER_SEC2 = 398600.4418;
const EARTH_E2 = 6.69437999014e-3;

export interface ParametricOrbitSeed {
  id: number;
  planeIndex: number;
  slotIndex: number;
  raanRad: number;
  meanAnomalyAtEpochRad: number;
}

export interface ParametricOrbitContext {
  profile: PaperProfile;
  observer: ObserverContext;
  observerLat: number;
  observerLon: number;
  kmToWorldScale: number;
  inclinationRad: number;
  semiMajorAxisKm: number;
  meanMotionRadPerSec: number;
  seeds: ParametricOrbitSeed[];
}

export interface ParametricOrbitSatelliteState {
  id: number;
  positionEcef: [number, number, number];
  positionWorld: [number, number, number];
  positionLla: {
    lat: number;
    lon: number;
    altKm: number;
  };
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  visible: boolean;
  groundCenterWorld: [number, number];
}

function asPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.round(value));
}

function asPositiveNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(value, 1e-9);
}

function normalizeDeg(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(180, value));
}

function deriveMeanMotionRadPerSec(options: {
  altitudeKm: number;
  satelliteSpeedKmps?: number;
}): number {
  const orbitRadiusKm = asPositiveNumber(EARTH_RADIUS_KM + options.altitudeKm, EARTH_RADIUS_KM + 600);
  if (Number.isFinite(options.satelliteSpeedKmps) && (options.satelliteSpeedKmps ?? 0) > 0) {
    return asPositiveNumber((options.satelliteSpeedKmps as number) / orbitRadiusKm, 1e-6);
  }
  return Math.sqrt(EARTH_MU_KM3_PER_SEC2 / (orbitRadiusKm ** 3));
}

function normalizeLongitudeDeg(value: number): number {
  let normalized = value;
  while (normalized < -180) {
    normalized += 360;
  }
  while (normalized > 180) {
    normalized -= 360;
  }
  return normalized;
}

function ecefToGeodetic(ecefKm: [number, number, number]): {
  latDeg: number;
  lonDeg: number;
  altKm: number;
} {
  const [x, y, z] = ecefKm;
  const lonRad = Math.atan2(y, x);
  const p = Math.hypot(x, y);

  let latRad = Math.atan2(z, p * (1 - EARTH_E2));
  let altKm = 0;

  for (let index = 0; index < 6; index += 1) {
    const sinLat = Math.sin(latRad);
    const n = EARTH_RADIUS_KM / Math.sqrt(1 - EARTH_E2 * sinLat * sinLat);
    altKm = p / Math.max(Math.cos(latRad), 1e-9) - n;
    latRad = Math.atan2(z, p * (1 - (EARTH_E2 * n) / Math.max(n + altKm, 1e-9)));
  }

  return {
    latDeg: (latRad * 180) / Math.PI,
    lonDeg: normalizeLongitudeDeg((lonRad * 180) / Math.PI),
    altKm,
  };
}

function buildParametricOrbitSeeds(options: {
  orbitalPlanes: number;
  satellitesPerPlane: number;
  activeSatellitesInWindow: number;
}): ParametricOrbitSeed[] {
  const orbitalPlanes = asPositiveInt(options.orbitalPlanes, 1);
  const satellitesPerPlane = asPositiveInt(options.satellitesPerPlane, 1);
  const totalSatelliteCount = orbitalPlanes * satellitesPerPlane;
  const activeSatellitesInWindow = Math.min(
    asPositiveInt(options.activeSatellitesInWindow, 1),
    totalSatelliteCount,
  );

  const allSeeds: ParametricOrbitSeed[] = [];
  for (let planeIndex = 0; planeIndex < orbitalPlanes; planeIndex += 1) {
    const raanRad = (TWO_PI * planeIndex) / orbitalPlanes;
    const planePhaseRad = (Math.PI * planeIndex) / orbitalPlanes;
    for (let slotIndex = 0; slotIndex < satellitesPerPlane; slotIndex += 1) {
      const slotPhaseRad = (TWO_PI * slotIndex) / satellitesPerPlane;
      allSeeds.push({
        id: planeIndex * 1000 + slotIndex,
        planeIndex,
        slotIndex,
        raanRad,
        // Source: ASSUME-WALKER-CIRCULAR-PHASING
        // Deterministic per-plane phase staggering keeps synthetic seed set reproducible.
        meanAnomalyAtEpochRad: slotPhaseRad + planePhaseRad,
      });
    }
  }

  if (activeSatellitesInWindow >= allSeeds.length) {
    return allSeeds;
  }

  const selected: ParametricOrbitSeed[] = [];
  const stride = allSeeds.length / activeSatellitesInWindow;
  for (let index = 0; index < activeSatellitesInWindow; index += 1) {
    const seedIndex = Math.floor(index * stride);
    selected.push(allSeeds[seedIndex]);
  }
  return selected;
}

export function createParametricOrbitContext(options: {
  profile: PaperProfile;
  observerLat: number;
  observerLon: number;
  kmToWorldScale: number;
}): ParametricOrbitContext {
  const { profile, observerLat, observerLon, kmToWorldScale } = options;
  const orbitalPlanes = asPositiveInt(profile.constellation.orbitalPlanes, 1);
  const satellitesPerPlane = asPositiveInt(profile.constellation.satellitesPerPlane, 1);
  const activeSatellitesInWindow = asPositiveInt(
    profile.constellation.activeSatellitesInWindow ?? satellitesPerPlane,
    satellitesPerPlane,
  );
  const inclinationDeg = normalizeDeg(profile.constellation.inclinationDeg);

  return {
    profile,
    observer: createObserverContext(observerLat, observerLon, 0),
    observerLat,
    observerLon,
    kmToWorldScale,
    inclinationRad: (inclinationDeg * Math.PI) / 180,
    semiMajorAxisKm: asPositiveNumber(
      EARTH_RADIUS_KM + profile.constellation.altitudeKm,
      EARTH_RADIUS_KM + 600,
    ),
    meanMotionRadPerSec: deriveMeanMotionRadPerSec({
      altitudeKm: profile.constellation.altitudeKm,
      satelliteSpeedKmps: profile.constellation.satelliteSpeedKmps,
    }),
    seeds: buildParametricOrbitSeeds({
      orbitalPlanes,
      satellitesPerPlane,
      activeSatellitesInWindow,
    }),
  };
}

export function buildParametricOrbitSatelliteStateAtTime(
  context: ParametricOrbitContext,
  timeSec: number,
): ParametricOrbitSatelliteState[] {
  const {
    observer,
    observerLat,
    observerLon,
    kmToWorldScale,
    inclinationRad,
    semiMajorAxisKm,
    meanMotionRadPerSec,
    seeds,
    profile,
  } = context;

  return seeds.map((seed) => {
    const anomalyRad = seed.meanAnomalyAtEpochRad + meanMotionRadPerSec * timeSec;
    const cosAnomaly = Math.cos(anomalyRad);
    const sinAnomaly = Math.sin(anomalyRad);
    const cosRaan = Math.cos(seed.raanRad);
    const sinRaan = Math.sin(seed.raanRad);
    const cosInclination = Math.cos(inclinationRad);
    const sinInclination = Math.sin(inclinationRad);

    const xEcefKm =
      semiMajorAxisKm * (cosRaan * cosAnomaly - sinRaan * sinAnomaly * cosInclination);
    const yEcefKm =
      semiMajorAxisKm * (sinRaan * cosAnomaly + cosRaan * sinAnomaly * cosInclination);
    const zEcefKm = semiMajorAxisKm * (sinAnomaly * sinInclination);

    const positionEcef: [number, number, number] = [xEcefKm, yEcefKm, zEcefKm];
    const lla = ecefToGeodetic(positionEcef);
    const topocentric = computeTopocentricPoint(observer, positionEcef);
    const [groundX, groundZ] = geoToWorldXZ(
      lla.latDeg,
      lla.lonDeg,
      observerLat,
      observerLon,
      kmToWorldScale,
    );

    return {
      id: seed.id,
      positionEcef,
      positionWorld: [
        topocentric.eastKm * kmToWorldScale,
        topocentric.upKm * kmToWorldScale,
        topocentric.northKm * kmToWorldScale,
      ],
      positionLla: {
        lat: lla.latDeg,
        lon: lla.lonDeg,
        altKm: lla.altKm,
      },
      azimuthDeg: topocentric.azimuthDeg,
      elevationDeg: topocentric.elevationDeg,
      rangeKm: topocentric.rangeKm,
      visible: topocentric.elevationDeg >= profile.constellation.minElevationDeg,
      groundCenterWorld: [groundX, groundZ],
    };
  });
}
