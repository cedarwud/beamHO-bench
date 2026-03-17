#!/usr/bin/env node
/**
 * enrich-tle-fixtures.mjs
 *
 * Reads existing TLE fixture files and adds observer-local metadata:
 *   - replayWindowStartUtc (= max epoch of all records)
 *   - replayWindowDurationSec (6000 s ≈ 1 LEO orbital period)
 *   - bootstrapStartOffsetSec (epoch within window that maximises NTPU-visible count)
 *   - observer (NTPU lat/lon/alt)
 *   - selectionPolicy (describes the current 'constellation-even' policy)
 *   - replayModeSupport
 *
 * Does NOT require the tle_data source directory; operates only on committed
 * fixture JSON files in src/data/tle/.
 *
 * Provenance: SDD sdd/pending/beamHO-bench-real-trace-local-pass-replay-sdd.md (D3)
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const FIXTURE_DIR = path.resolve(PROJECT_ROOT, 'src/data/tle');

// Beijing region observer — matches DEFAULT_OBSERVER in scenario-defaults.ts
// Source: ASSUME-OBSERVER-LOCATION-BEIJING (50-paper corpus consensus)
const OBSERVER = { latDeg: 40.0, lonDeg: 116.0, altKm: 0.05 };

// Analysis window: 6000 s ≈ 100 min ≈ one LEO orbital period
const REPLAY_WINDOW_DURATION_SEC = 6000;

// Bootstrap scan step in seconds
const BOOTSTRAP_SCAN_STEP_SEC = 60;

// Minimum elevation for "service visible" in bootstrap scoring (deg)
// Matches 3GPP TR 38.811 §6.6.2 default used in profiles
const SERVICE_MIN_ELEVATION_DEG = 25;

// ─── Kepler / Topocentric helpers ────────────────────────────────────────────

const GM_KM3_S2 = 398600.4418;
const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

function degToRad(deg) {
  return deg * DEG_TO_RAD;
}

/** IAU 1982 GMST (matches propagation.ts gmstRad — avoids ~280° initial-offset bug). */
function gmstRad(utcMs) {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  let rad = (gmstDeg % 360) * DEG_TO_RAD;
  if (rad < 0) rad += TWO_PI;
  return rad;
}

/** WGS84 observer ECEF position in km. */
/**
 * Fixture records store epochUtc normalised by sync-tle-fixtures.mjs (with Z
 * suffix).  But older fixtures may lack Z.  Force UTC interpretation so that
 * Date.parse() is timezone-independent on UTC+N machines.
 */
function toUtcEpoch(epochUtc) {
  const s = String(epochUtc ?? '');
  return s.length > 10 && !s.endsWith('Z') && !s.includes('+') ? s + 'Z' : s;
}

function observerECEF(latDeg, lonDeg, altKm) {
  const a = 6378.137;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  return [
    (N + altKm) * cosLat * cosLon,
    (N + altKm) * cosLat * sinLon,
    (N * (1 - e2) + altKm) * sinLat,
  ];
}

/** Newton's method for Kepler equation M = E - e*sin(E). */
function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/**
 * Propagate a TLE record at tUtcMs using simplified Kepler (no J2).
 * Returns elevation in degrees from the given observer ECEF.
 */
function propagateElevationDeg(record, obsLatDeg, obsLonDeg, obsECEF, tUtcMs) {
  const epochMs = Date.parse(toUtcEpoch(record.epochUtc));
  if (!Number.isFinite(epochMs)) return Number.NaN;
  const dtSec = (tUtcMs - epochMs) / 1000;

  const n = (record.meanMotionRevPerDay * 2 * Math.PI) / 86400; // rad/s
  const rawM = degToRad(record.meanAnomalyDeg) + n * dtSec;
  const M = rawM - 2 * Math.PI * Math.floor(rawM / (2 * Math.PI));
  const e = record.eccentricity;
  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);

  // True anomaly
  const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);

  // Semi-major axis and orbital radius
  const a = Math.cbrt(GM_KM3_S2 / (n * n));
  const r = a * (1 - e * cosE);

  // Perifocal → ECI rotation matrix
  const incRad = degToRad(record.inclinationDeg);
  const raanRad = degToRad(record.raanDeg);
  const argPRad = degToRad(record.argPerigeeDeg);

  const cosO = Math.cos(raanRad);
  const sinO = Math.sin(raanRad);
  const cosI = Math.cos(incRad);
  const sinI = Math.sin(incRad);
  const cosW = Math.cos(argPRad);
  const sinW = Math.sin(argPRad);
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);

  const x_eci =
    r * ((cosO * cosW - sinO * sinW * cosI) * cosNu + (-cosO * sinW - sinO * cosW * cosI) * sinNu);
  const y_eci =
    r * ((sinO * cosW + cosO * sinW * cosI) * cosNu + (-sinO * sinW + cosO * cosW * cosI) * sinNu);
  const z_eci = r * (sinW * sinI * cosNu + cosW * sinI * sinNu);

  // ECI → ECEF via IAU 1982 GMST (matches propagation.ts)
  const thetaGMST = gmstRad(tUtcMs);
  const cosT = Math.cos(thetaGMST);
  const sinT = Math.sin(thetaGMST);
  const x_ecef = cosT * x_eci + sinT * y_eci;
  const y_ecef = -sinT * x_eci + cosT * y_eci;
  const z_ecef = z_eci;

  // Topocentric Up component
  const [ox, oy, oz] = obsECEF;
  const dx = x_ecef - ox;
  const dy = y_ecef - oy;
  const dz = z_ecef - oz;
  const rangeKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (rangeKm < 1) return Number.NaN;

  const latRad = degToRad(obsLatDeg);
  const lonRad = degToRad(obsLonDeg);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);

  const rU = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;
  return (Math.asin(rU / rangeKm) * 180) / Math.PI;
}

// ─── Metadata computation ─────────────────────────────────────────────────────

/**
 * Find the maximum epoch across all records, used as replay window start.
 * Deterministic: same fixture always yields same replayWindowStartUtcMs.
 */
function computeReplayWindowStartMs(records) {
  let maxMs = 0;
  for (const rec of records) {
    const ms = Date.parse(toUtcEpoch(rec.epochUtc));
    if (Number.isFinite(ms)) maxMs = Math.max(maxMs, ms);
  }
  return maxMs;
}

/**
 * Scan the replay window at BOOTSTRAP_SCAN_STEP_SEC intervals.
 * At each step count how many records have elevation ≥ SERVICE_MIN_ELEVATION_DEG.
 * Return the offset (seconds from window start) that maximises the count.
 * Ties: prefer the smallest offset (earliest readable frame).
 */
function computeBootstrapOffsetSec(records, windowStartMs, windowDurationSec, obsECEF) {
  const { latDeg, lonDeg } = OBSERVER;
  const steps = Math.floor(windowDurationSec / BOOTSTRAP_SCAN_STEP_SEC);
  let bestOffset = 0;
  let bestCount = -1;
  let bestHighCount = -1;

  for (let step = 0; step <= steps; step++) {
    const offsetSec = step * BOOTSTRAP_SCAN_STEP_SEC;
    const tMs = windowStartMs + offsetSec * 1000;
    let serviceCount = 0;
    let highCount = 0;

    for (const rec of records) {
      const elev = propagateElevationDeg(rec, latDeg, lonDeg, obsECEF, tMs);
      if (!Number.isFinite(elev)) continue;
      if (elev >= SERVICE_MIN_ELEVATION_DEG) serviceCount += 1;
      if (elev >= 45) highCount += 1;
    }

    if (
      serviceCount > bestCount ||
      (serviceCount === bestCount && highCount > bestHighCount)
    ) {
      bestCount = serviceCount;
      bestHighCount = highCount;
      bestOffset = offsetSec;
    }
  }

  return bestOffset;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function enrichFixture(fixtureFile) {
  const raw = JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'));

  // Idempotency: skip if already enriched with current schema version
  if (raw.selectionPolicy && raw.replayWindowStartUtc && raw.observer) {
    console.log(`[enrich-tle] ${path.basename(fixtureFile)}: already enriched, re-computing bootstrap.`);
  }

  const records = raw.records ?? [];
  const windowStartMs = computeReplayWindowStartMs(records);
  if (!windowStartMs) {
    throw new Error(`${fixtureFile}: no valid epochUtc found in records`);
  }

  const obsECEF = observerECEF(OBSERVER.latDeg, OBSERVER.lonDeg, OBSERVER.altKm);

  console.log(`[enrich-tle] ${path.basename(fixtureFile)}: computing bootstrap offset over ${records.length} records...`);
  const bootstrapStartOffsetSec = computeBootstrapOffsetSec(
    records,
    windowStartMs,
    REPLAY_WINDOW_DURATION_SEC,
    obsECEF,
  );

  const enriched = {
    ...raw,
    replayWindowStartUtc: new Date(windowStartMs).toISOString(),
    replayWindowDurationSec: REPLAY_WINDOW_DURATION_SEC,
    bootstrapStartOffsetSec,
    observer: {
      latDeg: OBSERVER.latDeg,
      lonDeg: OBSERVER.lonDeg,
      altKm: OBSERVER.altKm,
    },
    selectionPolicy: {
      mode: 'constellation-even',
      serviceMinElevationDeg: SERVICE_MIN_ELEVATION_DEG,
      analysisWindowSec: REPLAY_WINDOW_DURATION_SEC,
      rankingPolicyId: 'even-norad-order',
      note: 'Current fixture was generated with constellation-wide even sampling. Future fixtures should use observer-local-pass mode (RTLP D2).',
    },
    replayModeSupport: {
      researchDefault: true,
      demoLoopSupported: true,
    },
  };

  fs.writeFileSync(fixtureFile, `${JSON.stringify(enriched, null, 2)}\n`, 'utf-8');
  console.log(
    `[enrich-tle] ${path.basename(fixtureFile)}: done — bootstrapStartOffsetSec=${bootstrapStartOffsetSec}`,
  );
}

const fixtureFiles = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('-sample.json'))
  .map((name) => path.join(FIXTURE_DIR, name));

if (fixtureFiles.length === 0) {
  throw new Error(`No *-sample.json fixtures found in ${FIXTURE_DIR}`);
}

for (const file of fixtureFiles) {
  enrichFixture(file);
}
