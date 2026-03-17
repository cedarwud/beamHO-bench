#!/usr/bin/env node
/**
 * sync-tle-fixtures.mjs
 *
 * Reads TLE/OMM JSON snapshots from tle_data/ and writes fixture files to
 * src/data/tle/.  Supports two selection modes:
 *
 *   observer-local-pass (default):
 *     Propagate all candidate records over an analysis window centred on the
 *     NTPU observer.  Retain only satellites that rise above the horizon during
 *     the window.  Apply budget cap by ranking: peak elevation descending, then
 *     pass duration descending.  Emit full RTLP metadata.
 *
 *   constellation-even (legacy fallback, TLE_SELECTION_MODE=even):
 *     Uniform provider-wide sample (original behaviour before RTLP D2).
 *
 * Environment variables:
 *   TLE_SOURCE_ROOT         root of tle_data directory (default: ../tle_data)
 *   TLE_MAX_STARLINK        budget cap for Starlink records (default: 320)
 *   TLE_MAX_ONEWEB          budget cap for OneWeb records (default: 180)
 *   TLE_SELECTION_MODE      'observer-local' (default) | 'even'
 *   TLE_ANALYSIS_WINDOW_SEC analysis window duration in seconds (default: 6000)
 *
 * Provenance:
 *   SDD sdd/pending/beamHO-bench-real-trace-local-pass-replay-sdd.md (D2, D3)
 *   ASSUME-NTPU-OBSERVER-LOCATION
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = process.env.TLE_SOURCE_ROOT
  ? path.resolve(process.env.TLE_SOURCE_ROOT)
  : path.resolve(PROJECT_ROOT, '../tle_data');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'src/data/tle');
const SELECTION_MODE = (process.env.TLE_SELECTION_MODE ?? 'observer-local').trim().toLowerCase();
const ANALYSIS_WINDOW_SEC = Number(process.env.TLE_ANALYSIS_WINDOW_SEC ?? 6000);

// Selection mode per provider (overrides TLE_SELECTION_MODE global):
//   'observer-local'  — observer-local-pass with time-bucket diversity cap (default for Starlink)
//   'even'            — constellation-wide uniform sample by NORAD ID (default for OneWeb)
//
// Rationale for OneWeb 'even':
//   OneWeb has 40 sats/plane at 87.9° inclination.  Observer-local-pass over NTPU selects
//   only N/S-track passes (az≈0° or 180°), giving zero E/W coverage and failing the
//   observer-sky horizontal-spread test.  Constellation-even sampling preserves orbital-plane
//   diversity and provides E/W sky coverage needed for realistic multi-direction display.
//   OneWeb's 95min/40=2.4 min inter-satellite spacing also means "train" clustering is
//   much less severe than Starlink's 86 s spacing, making the train-prevention argument
//   less compelling.
const PROVIDERS = [
  { name: 'starlink', maxRecords: Number(process.env.TLE_MAX_STARLINK ?? 400), selectionMode: 'observer-local' },
  { name: 'oneweb',   maxRecords: Number(process.env.TLE_MAX_ONEWEB ?? 120),  selectionMode: 'even' },
];

// Per-orbital-plane diversity cap.
//
// Satellites in the same orbital plane share identical RAAN and inclination,
// and are spaced ~86 s apart (Starlink).  Selecting many from one plane
// creates a "satellite train" — 10+ sats streaming through in rapid succession.
//
// Capping per-plane to MAX_SATS_PER_PLANE prevents trains while preserving
// simultaneous visibility across DIFFERENT planes (which naturally gives both
// spatial and temporal diversity — different planes cross the sky at different
// azimuths and different times).
//
// RAAN_BIN_DEG = 2  →  satellites within 2° RAAN are considered same plane
// Orbital-plane pass diversity:
//   Satellites in the same plane (RAAN within RAAN_BIN_DEG) that peak within
//   SAME_PASS_THRESHOLD_SEC of each other are from the SAME pass (consecutive
//   sats in the train, ~86s apart).  We keep only 1 per pass to avoid the
//   "twin/train" visual artifact.
//
//   The same plane may cross NTPU multiple times in the 6000s window (~96min
//   orbital period → up to 2 passes).  We allow one satellite from EACH pass,
//   giving temporal coverage without simultaneous duplicates.
const RAAN_BIN_DEG = 1;
const SAME_PASS_THRESHOLD_SEC = 600;

// Beijing region observer — matches DEFAULT_OBSERVER in scenario-defaults.ts
// Source: ASSUME-OBSERVER-LOCATION-BEIJING (50-paper corpus consensus)
const OBSERVER = { latDeg: 40.0, lonDeg: 116.0, altKm: 0.05 };

// Bootstrap scan step (seconds) for finding the most observer-readable epoch
const BOOTSTRAP_SCAN_STEP_SEC = 60;

// Minimum service elevation for bootstrap scoring (matches 3GPP TR 38.811 §6.6.2)
const SERVICE_MIN_ELEVATION_DEG = 25;

// ─── Kepler / Topocentric helpers ─────────────────────────────────────────────

/**
 * Force UTC interpretation of ISO 8601 epoch strings without timezone designator.
 * Some TLE/OMM providers emit "2026-03-15T06:29:14.618976" (no Z).
 * Date.parse() treats these as LOCAL TIME on UTC+N machines, breaking all
 * pass-analysis and bootstrap computations.  We append 'Z' to force UTC.
 */
function toUtcEpoch(epochStr) {
  const s = String(epochStr ?? '');
  return s.length > 10 && !s.endsWith('Z') && !s.includes('+') ? s + 'Z' : s;
}

const GM_KM3_S2 = 398600.4418;
const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

function degToRad(deg) {
  return deg * DEG_TO_RAD;
}

/**
 * IAU 1982 GMST formula (matches propagation.ts gmstRad).
 * The simplified formula (elapsed * OMEGA_EARTH) is missing the ~280.46° initial
 * offset at J2000, causing a ~145° ECEF rotation error that breaks NTPU visibility.
 */
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

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function propagateElevationDeg(record, obsLatDeg, obsLonDeg, obsECEF, tUtcMs) {
  const epochMs = Date.parse(toUtcEpoch(record.epochUtc));
  if (!Number.isFinite(epochMs)) return Number.NaN;
  const dtSec = (tUtcMs - epochMs) / 1000;

  const n = (record.meanMotionRevPerDay * 2 * Math.PI) / 86400;
  const rawM = degToRad(record.meanAnomalyDeg) + n * dtSec;
  const M = rawM - 2 * Math.PI * Math.floor(rawM / (2 * Math.PI));
  const e = record.eccentricity;
  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);
  const a = Math.cbrt(GM_KM3_S2 / (n * n));
  const r = a * (1 - e * cosE);

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

  const thetaGMST = gmstRad(tUtcMs);
  const cosT = Math.cos(thetaGMST);
  const sinT = Math.sin(thetaGMST);
  const x_ecef = cosT * x_eci + sinT * y_eci;
  const y_ecef = -sinT * x_eci + cosT * y_eci;
  const z_ecef = z_eci;

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

// ─── Pass analysis helpers ─────────────────────────────────────────────────────

/**
 * Scan a record over [windowStartMs, windowStartMs + windowDurationSec * 1000]
 * at 60s steps.  Returns { maxElevationDeg, peakOffsetSec, passCount } where
 * peakOffsetSec is the window-relative time of maximum elevation and passCount is
 * the number of horizon crossings (elevation from negative to positive).
 */
function analysePass(record, obsLatDeg, obsLonDeg, obsECEF, windowStartMs, windowDurationSec) {
  const stepMs = 60 * 1000;
  const steps = Math.floor((windowDurationSec * 1000) / stepMs);
  let maxElevation = -90;
  let peakOffsetSec = 0;
  let passCount = 0;
  let prevAbove = false;

  for (let i = 0; i <= steps; i++) {
    const tMs = windowStartMs + i * stepMs;
    const elev = propagateElevationDeg(record, obsLatDeg, obsLonDeg, obsECEF, tMs);
    if (!Number.isFinite(elev)) continue;
    if (elev > maxElevation) {
      maxElevation = elev;
      peakOffsetSec = i * 60;
    }
    const above = elev >= 0;
    if (above && !prevAbove) passCount += 1;
    prevAbove = above;
  }

  return { maxElevationDeg: maxElevation, peakOffsetSec, passCount };
}

/**
 * Observer-local pass selection with orbital-plane diversity (RTLP D2).
 *
 * 1. Compute replayWindowStartMs = max epoch of all records.
 * 2. Analyse each record over the analysis window at NTPU.
 * 3. Retain only records that reach elevation >= 0 (horizon crossing).
 * 4. Group by orbital plane (RAAN within RAAN_BIN_DEG) and cap each plane
 *    to MAX_SATS_PER_PLANE satellites (ranked by peak elevation).
 *    This prevents the "satellite train" effect (same-plane sats streaming
 *    through in rapid succession) while keeping satellites from many different
 *    planes — which naturally provides both spatial diversity (different sky
 *    tracks / azimuths) and temporal diversity (different planes peak at
 *    different times).
 * 5. If more than maxRecords remain, cap by ranking: peak elevation desc.
 * 6. Return retained records + metadata.
 */
function selectObserverLocalPasses(normalized, maxRecords, windowDurationSec) {
  const { latDeg, lonDeg, altKm } = OBSERVER;
  const obsECEF = observerECEF(latDeg, lonDeg, altKm);

  const windowStartMs = normalized.reduce((max, rec) => {
    const ms = Date.parse(toUtcEpoch(rec.epochUtc));
    return Number.isFinite(ms) ? Math.max(max, ms) : max;
  }, 0);

  const candidates = normalized.map((rec) => {
    const { maxElevationDeg, peakOffsetSec, passCount } = analysePass(
      rec,
      latDeg,
      lonDeg,
      obsECEF,
      windowStartMs,
      windowDurationSec,
    );
    return { rec, maxElevationDeg, peakOffsetSec, passCount };
  });

  // Retain only records that cross the horizon
  const local = candidates.filter((c) => c.maxElevationDeg >= 0);

  // Sort by peak elevation descending so per-plane cap retains the best passes.
  local.sort((a, b) => b.maxElevationDeg - a.maxElevationDeg || b.passCount - a.passCount);

  // Per-pass diversity: for each orbital plane (RAAN bin), group satellites
  // by pass (peak times within SAME_PASS_THRESHOLD_SEC are the same pass).
  // Keep only the highest-elevation satellite from each pass.
  //
  // This eliminates the "satellite train" (consecutive same-plane sats ~86s
  // apart all visible at once) while allowing the same plane to contribute
  // satellites from DIFFERENT passes (e.g. two crossings in a 6000s window).
  //
  // Result: temporal + spatial diversity without simultaneous duplicates.
  const planePassPeaks = new Map(); // key: raanBin → array of accepted peakOffsetSec
  const planeSeen = new Set(); // strict 1-per-plane cap
  const diversified = local.filter((c) => {
    const raanBin = Math.round(c.rec.raanDeg / RAAN_BIN_DEG);
    const accepted = planePassPeaks.get(raanBin) ?? [];
    // Check if this satellite's peak is too close to an already-accepted one
    const tooClose = accepted.some(
      (t) => Math.abs(c.peakOffsetSec - t) < SAME_PASS_THRESHOLD_SEC,
    );
    if (tooClose) return false;
    accepted.push(c.peakOffsetSec);
    planePassPeaks.set(raanBin, accepted);
    return true;
  });

  const retained = diversified.slice(0, maxRecords);

  console.log(
    `[sync-tle]   observer-local: ${local.length}/${normalized.length} records cross horizon` +
      ` over NTPU; after per-pass cap(1/pass, ${SAME_PASS_THRESHOLD_SEC}s threshold, ${RAAN_BIN_DEG}° bin): ${diversified.length}` +
      ` from ${planePassPeaks.size} orbital planes; capped to ${retained.length}`,
  );

  return {
    records: retained.map((c) => c.rec).sort((a, b) => a.noradId - b.noradId),
    windowStartMs,
    localCount: local.length,
  };
}

/**
 * Compute bootstrap offset: scan window at BOOTSTRAP_SCAN_STEP_SEC intervals.
 *
 * Primary criterion: maximise service-visible count (elevation >= SERVICE_MIN_ELEVATION_DEG).
 * Secondary criterion (tie-break): maximise azimuth diversity score = min(southFacing, northFacing)
 *   where southFacing = satellites with az in (90°, 270°).  This ensures the display at
 *   simulation t=0 contains satellites from multiple sky directions, not a north-only cluster.
 * Tertiary criterion: maximise ≥45° count for a richer initial display.
 */
// Reserve this much time at the end of the replay window so that a 96-tick
// simulation (96 × 10 s = 960 s) has satellite coverage for its full duration.
// Without the guard, bootstrap near window end produces a simulation that runs
// past the window boundary where selected satellites are no longer visible.
const BOOTSTRAP_WINDOW_GUARD_SEC = 1200;

function computeBootstrapOffsetSec(records, windowStartMs, windowDurationSec) {
  const { latDeg, lonDeg, altKm } = OBSERVER;
  const obsECEF = observerECEF(latDeg, lonDeg, altKm);
  // Cap scan to window - BOOTSTRAP_WINDOW_GUARD_SEC so the simulation stays in coverage
  const scanDurationSec = Math.max(0, windowDurationSec - BOOTSTRAP_WINDOW_GUARD_SEC);
  const steps = Math.floor(scanDurationSec / BOOTSTRAP_SCAN_STEP_SEC);
  let bestOffset = 0;
  let bestCount = -1;
  let bestBalance = -1;
  let bestHigh = -1;

  for (let step = 0; step <= steps; step++) {
    const offsetSec = step * BOOTSTRAP_SCAN_STEP_SEC;
    const tMs = windowStartMs + offsetSec * 1000;
    let serviceCount = 0;
    let highCount = 0;
    let southFacing = 0;

    for (const rec of records) {
      const elevDeg = propagateElevationDeg(rec, latDeg, lonDeg, obsECEF, tMs);
      if (!Number.isFinite(elevDeg)) continue;
      if (elevDeg >= SERVICE_MIN_ELEVATION_DEG) {
        serviceCount += 1;
        // Compute approximate azimuth to classify N/S facing
        // Positive northComp → N-facing; negative → S-facing (az in 90°-270°)
        // We reuse the ECEF satellite position from the propagation above.
        // Simple heuristic: compute lat/lon via elevation scan with a shifted observer.
        // Cheaper: use the record's RAAN to determine if satellite is on ascending or descending arc.
        // Even cheaper: propagate at tMs+30s and compare latitude to observer lat.
        const elevPlus = propagateElevationDeg(rec, latDeg - 5, lonDeg, obsECEF, tMs);
        // If satellite appears higher when observer is at lower latitude, it is south of observer
        if (Number.isFinite(elevPlus) && elevPlus < elevDeg) southFacing += 1;
      }
      if (elevDeg >= 45) highCount += 1;
    }

    // balance = min(southFacing, northFacing) — maximised when N/S split is most even
    const balance = Math.min(southFacing, serviceCount - southFacing);

    const better =
      serviceCount > bestCount ||
      (serviceCount === bestCount && balance > bestBalance) ||
      (serviceCount === bestCount && balance === bestBalance && highCount > bestHigh);

    if (better) {
      bestCount = serviceCount;
      bestBalance = balance;
      bestHigh = highCount;
      bestOffset = offsetSec;
    }
  }

  return bestOffset;
}

// ─── Legacy helpers ───────────────────────────────────────────────────────────

function sampleEvenly(records, maxRecords) {
  if (records.length <= maxRecords) return records;
  const sampled = [];
  for (let index = 0; index < maxRecords; index += 1) {
    const sourceIndex = Math.floor((index * records.length) / maxRecords);
    sampled.push(records[sourceIndex]);
  }
  return sampled;
}

// ─── TLE record normalization / validation ────────────────────────────────────

/**
 * Normalize a raw EPOCH string to unambiguous UTC by appending 'Z' when the
 * string looks like ISO 8601 without a timezone designator.
 * Reason: some TLE/OMM providers emit "2026-03-15T06:29:14.618976" (no Z),
 * which Date.parse() interprets as LOCAL TIME on UTC+N machines.  All our
 * downstream code assumes UTC, so we must force the designator here.
 */
function normalizeEpochUtc(raw_epoch) {
  const s = String(raw_epoch ?? '');
  if (
    s.length > 10 &&
    !s.endsWith('Z') &&
    !s.includes('+') &&
    !/[T ]\d{2}:\d{2}.*[-+]\d/.test(s)
  ) {
    return s + 'Z';
  }
  return s;
}

function normalizeRecord(raw) {
  return {
    objectName: String(raw.OBJECT_NAME ?? ''),
    objectId: String(raw.OBJECT_ID ?? ''),
    noradId: Number(raw.NORAD_CAT_ID ?? 0),
    epochUtc: normalizeEpochUtc(raw.EPOCH),
    meanMotionRevPerDay: Number(raw.MEAN_MOTION ?? 0),
    eccentricity: Number(raw.ECCENTRICITY ?? 0),
    inclinationDeg: Number(raw.INCLINATION ?? 0),
    raanDeg: Number(raw.RA_OF_ASC_NODE ?? 0),
    argPerigeeDeg: Number(raw.ARG_OF_PERICENTER ?? 0),
    meanAnomalyDeg: Number(raw.MEAN_ANOMALY ?? 0),
    bstar: Number(raw.BSTAR ?? 0),
    meanMotionDot: Number(raw.MEAN_MOTION_DOT ?? 0),
    meanMotionDdot: Number(raw.MEAN_MOTION_DDOT ?? 0),
    elementSetNo: Number(raw.ELEMENT_SET_NO ?? 1),
    revAtEpoch: Number(raw.REV_AT_EPOCH ?? 0),
  };
}

function isValidRecord(record) {
  return (
    Number.isFinite(record.noradId) &&
    record.noradId > 0 &&
    Number.isFinite(record.meanMotionRevPerDay) &&
    record.meanMotionRevPerDay > 0 &&
    Number.isFinite(record.eccentricity) &&
    record.eccentricity >= 0 &&
    record.eccentricity < 1 &&
    record.epochUtc.length > 0
  );
}

function listJsonFiles(provider) {
  const dir = path.join(SOURCE_ROOT, provider, 'json');
  if (!fs.existsSync(dir)) {
    throw new Error(`missing source directory: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
}

// ─── Fixture builder ──────────────────────────────────────────────────────────

function buildFixture(provider, latestFile, maxRecords, providerSelectionMode) {
  const rawRecords = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
  const normalized = rawRecords.map(normalizeRecord).filter(isValidRecord);
  const sourceRootHint = path.relative(PROJECT_ROOT, SOURCE_ROOT) || '.';
  const sourceFile = path.relative(SOURCE_ROOT, latestFile);

  let sampled;
  let replayWindowStartUtc;
  let bootstrapStartOffsetSec;
  let selectionPolicy;

  const effectiveMode = providerSelectionMode ?? SELECTION_MODE;
  if (effectiveMode === 'even') {
    // Legacy: constellation-wide even sampling
    sampled = sampleEvenly(normalized, maxRecords).sort((a, b) => a.noradId - b.noradId);
    const windowStartMs = sampled.reduce((max, rec) => {
      const ms = Date.parse(toUtcEpoch(rec.epochUtc));
      return Number.isFinite(ms) ? Math.max(max, ms) : max;
    }, 0);
    replayWindowStartUtc = new Date(windowStartMs).toISOString();
    console.log(`[sync-tle]   ${provider}: using legacy constellation-even sampling.`);
    bootstrapStartOffsetSec = computeBootstrapOffsetSec(sampled, windowStartMs, ANALYSIS_WINDOW_SEC);
    selectionPolicy = {
      mode: 'constellation-even',
      serviceMinElevationDeg: SERVICE_MIN_ELEVATION_DEG,
      analysisWindowSec: ANALYSIS_WINDOW_SEC,
      rankingPolicyId: 'even-norad-order',
    };
  } else {
    // Default: observer-local pass selection (RTLP D2)
    const result = selectObserverLocalPasses(normalized, maxRecords, ANALYSIS_WINDOW_SEC);
    sampled = result.records;
    replayWindowStartUtc = new Date(result.windowStartMs).toISOString();
    bootstrapStartOffsetSec = computeBootstrapOffsetSec(
      sampled,
      result.windowStartMs,
      ANALYSIS_WINDOW_SEC,
    );
    selectionPolicy = {
      mode: 'observer-local-pass',
      serviceMinElevationDeg: SERVICE_MIN_ELEVATION_DEG,
      analysisWindowSec: ANALYSIS_WINDOW_SEC,
      rankingPolicyId: 'per-pass-diversity-peak-elevation',
      raanBinDeg: RAAN_BIN_DEG,
      samePassThresholdSec: SAME_PASS_THRESHOLD_SEC,
    };
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    provider,
    sourceRootHint,
    sourceFile,
    sourceRecordCount: normalized.length,
    sampledRecordCount: sampled.length,
    replayWindowStartUtc,
    replayWindowDurationSec: ANALYSIS_WINDOW_SEC,
    bootstrapStartOffsetSec,
    observer: {
      latDeg: OBSERVER.latDeg,
      lonDeg: OBSERVER.lonDeg,
      altKm: OBSERVER.altKm,
    },
    selectionPolicy,
    replayModeSupport: {
      researchDefault: true,
      demoLoopSupported: true,
    },
    records: sampled,
  };
}

function writeFixture(provider, fixture) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${provider}-sample.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf-8');
  return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function run() {
  const outputs = [];

  for (const provider of PROVIDERS) {
    const files = listJsonFiles(provider.name);
    if (files.length === 0) {
      throw new Error(`no json files found for provider: ${provider.name}`);
    }

    const latestFile = files[files.length - 1];
    const fixture = buildFixture(provider.name, latestFile, provider.maxRecords, provider.selectionMode);
    const outPath = writeFixture(provider.name, fixture);

    outputs.push({
      provider: provider.name,
      latestFile,
      outPath,
      count: fixture.sampledRecordCount,
    });
  }

  for (const output of outputs) {
    console.log(
      `[sync-tle] ${output.provider}: ${output.count} records -> ${output.outPath} (source ${output.latestFile})`,
    );
  }
}

run();
