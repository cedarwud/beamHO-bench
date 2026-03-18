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
  raanOffsetRad: number;
  anomalyOffsetRad: number;
  desiredSatelliteCount: number;
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

function normalizeAngleRad(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let normalized = value % TWO_PI;
  if (normalized < 0) {
    normalized += TWO_PI;
  }
  return normalized;
}

function shortestAngleDeltaRad(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let normalized = value % TWO_PI;
  if (normalized <= -Math.PI) {
    normalized += TWO_PI;
  } else if (normalized > Math.PI) {
    normalized -= TWO_PI;
  }
  return normalized;
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

function deriveObserverAnchoredOrbitOffsets(options: {
  observerLat: number;
  observerLon: number;
  inclinationRad: number;
  anchorSeed: ParametricOrbitSeed | null;
}): {
  raanOffsetRad: number;
  anomalyOffsetRad: number;
} {
  const { observerLat, observerLon, inclinationRad, anchorSeed } = options;
  if (anchorSeed === null) {
    return {
      raanOffsetRad: 0,
      anomalyOffsetRad: 0,
    };
  }

  const latRad = (observerLat * Math.PI) / 180;
  const lonRad = (observerLon * Math.PI) / 180;
  const sinInclination = Math.sin(inclinationRad);
  const sinLatitude = Math.sin(latRad);

  if (Math.abs(sinInclination) <= 1e-9) {
    return {
      raanOffsetRad: shortestAngleDeltaRad(lonRad - anchorSeed.raanRad),
      anomalyOffsetRad: shortestAngleDeltaRad(-anchorSeed.meanAnomalyAtEpochRad),
    };
  }

  const normalizedSinAnomaly = Math.max(-1, Math.min(1, sinLatitude / sinInclination));
  const baseAnomalyRad = Math.asin(normalizedSinAnomaly);
  const anomalyCandidates = [
    normalizeAngleRad(baseAnomalyRad),
    normalizeAngleRad(Math.PI - baseAnomalyRad),
  ];

  const anchoredCandidates = anomalyCandidates.map((targetAnomalyRad) => {
    const projectedX = Math.cos(targetAnomalyRad);
    const projectedY = Math.sin(targetAnomalyRad) * Math.cos(inclinationRad);
    const targetRaanRad = normalizeAngleRad(lonRad - Math.atan2(projectedY, projectedX));
    const raanOffsetRad = shortestAngleDeltaRad(targetRaanRad - anchorSeed.raanRad);
    const anomalyOffsetRad = shortestAngleDeltaRad(
      targetAnomalyRad - anchorSeed.meanAnomalyAtEpochRad,
    );
    return {
      raanOffsetRad,
      anomalyOffsetRad,
      score: Math.abs(raanOffsetRad) + Math.abs(anomalyOffsetRad),
    };
  });

  anchoredCandidates.sort((left, right) => left.score - right.score);
  return {
    raanOffsetRad: anchoredCandidates[0]?.raanOffsetRad ?? 0,
    anomalyOffsetRad: anchoredCandidates[0]?.anomalyOffsetRad ?? 0,
  };
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
}): ParametricOrbitSeed[] {
  const orbitalPlanes = asPositiveInt(options.orbitalPlanes, 1);
  const satellitesPerPlane = asPositiveInt(options.satellitesPerPlane, 1);

  const allSeeds: ParametricOrbitSeed[] = [];
  for (let planeIndex = 0; planeIndex < orbitalPlanes; planeIndex += 1) {
    const raanRad = (TWO_PI * planeIndex) / orbitalPlanes;
    // Walker-δ inter-plane phase: δ = π per constellation (F = T/2).
    // Standard Walker Star pattern used by Starlink/OneWeb papers.
    // ASSUME-WALKER-DELTA-PHASE-FACTOR
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
  return allSeeds;
}

function compareSatelliteWindowPriority(
  left: Pick<ParametricOrbitSatelliteState, 'visible' | 'elevationDeg' | 'rangeKm' | 'id'>,
  right: Pick<ParametricOrbitSatelliteState, 'visible' | 'elevationDeg' | 'rangeKm' | 'id'>,
): number {
  if (left.visible !== right.visible) {
    return left.visible ? -1 : 1;
  }
  if (left.elevationDeg !== right.elevationDeg) {
    return right.elevationDeg - left.elevationDeg;
  }
  if (left.rangeKm !== right.rangeKm) {
    return left.rangeKm - right.rangeKm;
  }
  return left.id - right.id;
}

function normalizeAzimuthDeg(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let normalized = value % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function buildAzimuthDiversifiedRanking(
  satellites: ParametricOrbitSatelliteState[],
  sectorCount: number,
): ParametricOrbitSatelliteState[] {
  if (satellites.length <= 1 || sectorCount <= 1) {
    return [...satellites].sort(compareSatelliteWindowPriority);
  }

  const ranked = [...satellites].sort(compareSatelliteWindowPriority);
  const buckets = Array.from({ length: sectorCount }, () => [] as ParametricOrbitSatelliteState[]);

  for (const satellite of ranked) {
    const azimuthDeg = normalizeAzimuthDeg(satellite.azimuthDeg);
    const sectorIndex = Math.min(
      sectorCount - 1,
      Math.floor((azimuthDeg / 360) * sectorCount),
    );
    buckets[sectorIndex].push(satellite);
  }

  const sectorOrder = buckets
    .map((bucket, index) => ({
      index,
      top: bucket[0] ?? null,
    }))
    .filter((entry): entry is { index: number; top: ParametricOrbitSatelliteState } => entry.top !== null)
    .sort((left, right) => compareSatelliteWindowPriority(left.top, right.top));

  const diversified: ParametricOrbitSatelliteState[] = [];
  let appended = true;
  while (appended) {
    appended = false;
    for (const sector of sectorOrder) {
      const satellite = buckets[sector.index]?.shift();
      if (!satellite) {
        continue;
      }
      diversified.push(satellite);
      appended = true;
    }
  }

  return diversified;
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
  const seeds = buildParametricOrbitSeeds({
    orbitalPlanes,
    satellitesPerPlane,
  });
  const anchoredOffsets = deriveObserverAnchoredOrbitOffsets({
    observerLat,
    observerLon,
    inclinationRad: (inclinationDeg * Math.PI) / 180,
    anchorSeed: seeds[0] ?? null,
  });

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
    raanOffsetRad: anchoredOffsets.raanOffsetRad,
    anomalyOffsetRad: anchoredOffsets.anomalyOffsetRad,
    desiredSatelliteCount: Math.min(activeSatellitesInWindow, Math.max(seeds.length, 1)),
    seeds,
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
    raanOffsetRad,
    anomalyOffsetRad,
    seeds,
    profile,
  } = context;

  return seeds.map((seed) => {
    const anomalyRad =
      seed.meanAnomalyAtEpochRad + anomalyOffsetRad + meanMotionRadPerSec * timeSec;
    const cosAnomaly = Math.cos(anomalyRad);
    const sinAnomaly = Math.sin(anomalyRad);
    const anchoredRaanRad = seed.raanRad + raanOffsetRad;
    const cosRaan = Math.cos(anchoredRaanRad);
    const sinRaan = Math.sin(anchoredRaanRad);
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
    const positionWorld: [number, number, number] = [
      topocentric.eastKm * kmToWorldScale,
      topocentric.upKm * kmToWorldScale,
      topocentric.northKm * kmToWorldScale,
    ];
    const groundCenterWorld: [number, number] = [groundX, groundZ];

    return {
      id: seed.id,
      positionEcef,
      positionWorld,
      positionLla: {
        lat: lla.latDeg,
        lon: lla.lonDeg,
        altKm: lla.altKm,
      },
      azimuthDeg: topocentric.azimuthDeg,
      elevationDeg: topocentric.elevationDeg,
      rangeKm: topocentric.rangeKm,
      visible: topocentric.elevationDeg >= profile.constellation.minElevationDeg,
      groundCenterWorld,
    };
  });
}

export function selectParametricOrbitRuntimeWindow(
  satellites: readonly ParametricOrbitSatelliteState[],
  desiredSatelliteCount: number,
): ParametricOrbitSatelliteState[] {
  const normalizedDesiredCount = Math.max(1, Math.floor(desiredSatelliteCount));
  const azimuthSectorCount = Math.max(
    1,
    Math.min(8, Math.ceil(normalizedDesiredCount / 2)),
  );

  if (satellites.length <= normalizedDesiredCount) {
    return buildAzimuthDiversifiedRanking([...satellites], azimuthSectorCount);
  }

  const visibleRanked = buildAzimuthDiversifiedRanking(
    satellites.filter((satellite) => satellite.visible),
    azimuthSectorCount,
  );
  const fallbackRanked = buildAzimuthDiversifiedRanking(
    satellites.filter((satellite) => !satellite.visible),
    azimuthSectorCount,
  );
  const ranked = [...visibleRanked, ...fallbackRanked];
  return ranked
    .slice(0, normalizedDesiredCount)
    .sort(compareSatelliteWindowPriority);
}
