import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  gstime,
  sgp4 as sgp4Propagate,
} from 'satellite.js';
import { degToRad, normalizeAngleRad, radToDeg } from './math';
import type { OrbitElement, OrbitPoint } from './types';

const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_A_KM = 6378.137;
const EARTH_F = 1 / 298.257223563;
const EARTH_B_KM = EARTH_A_KM * (1 - EARTH_F);
const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;
const MAX_SGP4_FALLBACK_WARNINGS = 5;
let sgp4FallbackWarningCount = 0;

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

function isFiniteKmVector(value: { x: number; y: number; z: number }): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function warnSgp4Fallback(noradId: number): void {
  if (sgp4FallbackWarningCount >= MAX_SGP4_FALLBACK_WARNINGS) {
    return;
  }

  sgp4FallbackWarningCount += 1;
  console.warn(
    `[orbit] SGP4 propagation failed for NORAD ${noradId}; using Kepler fallback for this object.`,
  );

  if (sgp4FallbackWarningCount === MAX_SGP4_FALLBACK_WARNINGS) {
    console.warn('[orbit] Further SGP4 fallback warnings are suppressed.');
  }
}

function propagateOrbitElementSgp4(
  element: OrbitElement,
  atUtcMs: number,
): OrbitPoint | null {
  if (!element.satrec) {
    return null;
  }

  try {
    const tsinceMinutes = (atUtcMs - element.epochUtcMs) / 60000;
    const state = sgp4Propagate(element.satrec, tsinceMinutes);
    if (!state || !state.position || !isFiniteKmVector(state.position)) {
      return null;
    }

    const gmst = gstime(new Date(atUtcMs));
    const ecef = eciToEcf(state.position, gmst);
    if (!isFiniteKmVector(ecef)) {
      return null;
    }

    const geo = eciToGeodetic(state.position, gmst);
    const latDeg = degreesLat(geo.latitude);
    const lonDeg = degreesLong(geo.longitude);
    if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || !Number.isFinite(geo.height)) {
      return null;
    }

    return {
      ecefKm: [ecef.x, ecef.y, ecef.z],
      latDeg,
      lonDeg,
      altKm: geo.height,
    };
  } catch {
    return null;
  }
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

function propagateOrbitElementKepler(
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

export function propagateOrbitElement(
  element: OrbitElement,
  atUtcMs: number,
): OrbitPoint {
  const sgp4Point = propagateOrbitElementSgp4(element, atUtcMs);
  if (sgp4Point) {
    return sgp4Point;
  }
  if (element.satrec) {
    warnSgp4Fallback(element.noradId);
  }
  return propagateOrbitElementKepler(element, atUtcMs);
}
