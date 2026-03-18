/**
 * Provenance:
 * - Inspired by orbit-engine Stage 4 pre-computed pass trajectories
 * - ASSUME-TRAJECTORY-CACHE-PRECOMPUTE
 *
 * Pre-computes satellite az/el trajectories at fixed intervals using SGP4.
 * Provides smooth cubic-interpolated positions for any simulation time.
 * Eliminates per-tick reactive rendering artifacts (mid-sky appearance, jitter).
 */

import type { OrbitElement, ObserverContext } from './types';
import { propagateOrbitElement } from './propagation';
import { computeTopocentricPoint } from './topocentric';

// ── Types ──

/** A single trajectory sample at a fixed time offset. */
export interface TrajectorySample {
  /** Seconds from epoch origin. */
  timeSec: number;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

/** A contiguous pass of a satellite above the tracking threshold. */
export interface SatellitePass {
  noradId: number;
  /** Index into the full sample array where this pass starts. */
  startIdx: number;
  /** Index into the full sample array where this pass ends (inclusive). */
  endIdx: number;
  /** Peak elevation during this pass. */
  maxElevationDeg: number;
  /** Time (sec from epoch) when pass starts. */
  startTimeSec: number;
  /** Time (sec from epoch) when pass ends. */
  endTimeSec: number;
}

/** Complete trajectory data for one satellite. */
interface SatelliteTrajectory {
  noradId: number;
  /** Dense az/el samples at fixed interval. */
  samples: TrajectorySample[];
  /** Identified passes (elevation above tracking threshold). */
  passes: SatellitePass[];
}

/** Position result from trajectory lookup. */
export interface TrajectoryPosition {
  noradId: number;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  /** Which pass this belongs to (for slot assignment). */
  passIndex: number;
  /** Peak elevation of this pass (for priority sorting). */
  passMaxElevDeg: number;
}

/** The pre-computed trajectory cache. */
export interface TrajectoryCache {
  /** Get all satellites with active passes at a given time. */
  getActiveAt(timeSec: number): TrajectoryPosition[];
  /** Total number of satellites with at least one pass. */
  satelliteCount: number;
  /** Total number of passes across all satellites. */
  passCount: number;
  /** Duration of the pre-computed window in seconds (includes lookback). */
  windowDurationSec: number;
  /** Effective replay duration in sim-time seconds (excludes lookback). */
  replayDurationSec: number;
}

// ── Configuration ──

/** Sample interval in seconds. 10s gives smooth cubic interpolation at 60fps. */
const SAMPLE_INTERVAL_SEC = 10;

/** Elevation threshold for tracking. Satellites below this are not rendered,
 *  but we extend passes to include sub-horizon data for smooth entry/exit. */
/** Track from slightly below horizon. With non-linear projection (power 0.35)
 *  and BASE_RADIUS=960, el=-1° projects to radius ≈ 1063 (outside camera
 *  frustum ±927). -2° gives enough margin for smooth entry. */
const TRACKING_THRESHOLD_DEG = -2;

/** Minimum pass duration (seconds) to keep. Short blips are noise. */
const MIN_PASS_DURATION_SEC = 30;

// ── Cubic Hermite interpolation ──

function cubicHermite(
  y0: number, y1: number, y2: number, y3: number, t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  // Catmull-Rom tangent estimation
  return 0.5 * (
    (2 * y1) +
    (-y0 + y2) * t +
    (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
    (-y0 + 3 * y1 - 3 * y2 + y3) * t3
  );
}

// ── Cache builder ──

/**
 * @param timeOffsetSec — if the cache starts before the simulation epoch,
 *   this is the offset so that simulation t=0 maps to sample index timeOffsetSec/SAMPLE_INTERVAL_SEC.
 *   getActiveAt(0) will return passes active at the simulation start, not the cache start.
 */
export function buildTrajectoryCache(
  records: readonly OrbitElement[],
  observer: ObserverContext,
  epochOriginMs: number,
  windowDurationSec: number,
  timeOffsetSec = 0,
): TrajectoryCache {
  const nSteps = Math.ceil(windowDurationSec / SAMPLE_INTERVAL_SEC) + 1;
  const trajectories: SatelliteTrajectory[] = [];
  let totalPassCount = 0;

  for (const record of records) {
    // Pre-compute samples at fixed intervals
    const samples: TrajectorySample[] = new Array(nSteps);
    for (let i = 0; i < nSteps; i++) {
      const timeSec = i * SAMPLE_INTERVAL_SEC;
      const utcMs = epochOriginMs + timeSec * 1000;
      const point = propagateOrbitElement(record, utcMs);
      const topo = computeTopocentricPoint(observer, point.ecefKm);
      samples[i] = {
        timeSec,
        azimuthDeg: topo.azimuthDeg,
        elevationDeg: topo.elevationDeg,
        rangeKm: topo.rangeKm,
      };
    }

    // Identify passes (contiguous periods above tracking threshold)
    const passes: SatellitePass[] = [];
    let inPass = false;
    let passStart = 0;
    let passMaxElev = -90;

    for (let i = 0; i < nSteps; i++) {
      const above = samples[i].elevationDeg > TRACKING_THRESHOLD_DEG;
      if (above && !inPass) {
        inPass = true;
        passStart = i;
        passMaxElev = samples[i].elevationDeg;
      } else if (above && inPass) {
        passMaxElev = Math.max(passMaxElev, samples[i].elevationDeg);
      } else if (!above && inPass) {
        inPass = false;
        const duration = (i - passStart) * SAMPLE_INTERVAL_SEC;
        if (duration >= MIN_PASS_DURATION_SEC && passMaxElev > 0) {
          passes.push({
            noradId: record.noradId,
            startIdx: passStart,
            endIdx: i - 1,
            maxElevationDeg: passMaxElev,
            startTimeSec: samples[passStart].timeSec,
            endTimeSec: samples[i - 1].timeSec,
          });
        }
      }
    }
    // Close open pass
    if (inPass) {
      const duration = (nSteps - 1 - passStart) * SAMPLE_INTERVAL_SEC;
      if (duration >= MIN_PASS_DURATION_SEC && passMaxElev > 0) {
        passes.push({
          noradId: record.noradId,
          startIdx: passStart,
          endIdx: nSteps - 1,
          maxElevationDeg: passMaxElev,
          startTimeSec: samples[passStart].timeSec,
          endTimeSec: samples[nSteps - 1].timeSec,
        });
      }
    }

    // Unwrap azimuth to continuous values (avoid 359°→1° jumps).
    // This ensures cubic interpolation doesn't take the long way around.
    for (let i = 1; i < nSteps; i++) {
      let diff = samples[i].azimuthDeg - samples[i - 1].azimuthDeg;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      samples[i].azimuthDeg = samples[i - 1].azimuthDeg + diff;
    }

    if (passes.length > 0) {
      trajectories.push({ noradId: record.noradId, samples, passes });
      totalPassCount += passes.length;
    }
  }

  // Build a flat list of all passes for quick time-based lookup
  const allPasses: { traj: SatelliteTrajectory; pass: SatellitePass; globalIdx: number }[] = [];
  let gi = 0;
  for (const traj of trajectories) {
    for (const pass of traj.passes) {
      allPasses.push({ traj, pass, globalIdx: gi++ });
    }
  }

  function interpolateSample(
    samples: TrajectorySample[], timeSec: number,
  ): { az: number; el: number; range: number } {
    const fi = timeSec / SAMPLE_INTERVAL_SEC;
    const i1 = Math.floor(fi);
    const t = fi - i1;

    // Clamp indices
    const maxIdx = samples.length - 1;
    const idx1 = Math.max(0, Math.min(i1, maxIdx));
    const idx0 = Math.max(0, idx1 - 1);
    const idx2 = Math.min(maxIdx, idx1 + 1);
    const idx3 = Math.min(maxIdx, idx1 + 2);

    const s0 = samples[idx0], s1 = samples[idx1];
    const s2 = samples[idx2], s3 = samples[idx3];

    // Near zenith, azimuth is ill-conditioned (atan2 singularity).
    // Switch to Cartesian hemisphere interpolation which is naturally smooth:
    // hx = cos(el)*sin(az), hy = sin(el), hz = cos(el)*cos(az)
    // cos(el)→0 at zenith dampens azimuth instability automatically.
    const highEl = s0.elevationDeg > 55 || s1.elevationDeg > 55
      || s2.elevationDeg > 55 || s3.elevationDeg > 55;

    const range = cubicHermite(s0.rangeKm, s1.rangeKm, s2.rangeKm, s3.rangeKm, t);

    if (highEl) {
      const toRad = Math.PI / 180;
      const hx0 = Math.cos(s0.elevationDeg * toRad) * Math.sin(s0.azimuthDeg * toRad);
      const hy0 = Math.sin(s0.elevationDeg * toRad);
      const hz0 = Math.cos(s0.elevationDeg * toRad) * Math.cos(s0.azimuthDeg * toRad);
      const hx1 = Math.cos(s1.elevationDeg * toRad) * Math.sin(s1.azimuthDeg * toRad);
      const hy1 = Math.sin(s1.elevationDeg * toRad);
      const hz1 = Math.cos(s1.elevationDeg * toRad) * Math.cos(s1.azimuthDeg * toRad);
      const hx2 = Math.cos(s2.elevationDeg * toRad) * Math.sin(s2.azimuthDeg * toRad);
      const hy2 = Math.sin(s2.elevationDeg * toRad);
      const hz2 = Math.cos(s2.elevationDeg * toRad) * Math.cos(s2.azimuthDeg * toRad);
      const hx3 = Math.cos(s3.elevationDeg * toRad) * Math.sin(s3.azimuthDeg * toRad);
      const hy3 = Math.sin(s3.elevationDeg * toRad);
      const hz3 = Math.cos(s3.elevationDeg * toRad) * Math.cos(s3.azimuthDeg * toRad);

      const hx = cubicHermite(hx0, hx1, hx2, hx3, t);
      const hy = cubicHermite(hy0, hy1, hy2, hy3, t);
      const hz = cubicHermite(hz0, hz1, hz2, hz3, t);

      const el = Math.asin(Math.max(-1, Math.min(1, hy))) / toRad;
      let az = Math.atan2(hx, hz) / toRad;
      if (az < 0) az += 360;

      return { az, el, range };
    }

    // Low elevation: standard az/el interpolation (azimuth already unwrapped)
    let az = cubicHermite(
      s0.azimuthDeg, s1.azimuthDeg, s2.azimuthDeg, s3.azimuthDeg, t,
    );
    az = ((az % 360) + 360) % 360;

    return {
      az,
      el: cubicHermite(
        s0.elevationDeg, s1.elevationDeg, s2.elevationDeg, s3.elevationDeg, t,
      ),
      range,
    };
  }

  return {
    satelliteCount: trajectories.length,
    passCount: totalPassCount,
    windowDurationSec,
    replayDurationSec: windowDurationSec - timeOffsetSec,

    getActiveAt(simTimeSec: number): TrajectoryPosition[] {
      // Map simulation time to cache time (cache starts timeOffsetSec before sim)
      const cacheTimeSec = simTimeSec + timeOffsetSec;
      const result: TrajectoryPosition[] = [];
      for (const { traj, pass, globalIdx } of allPasses) {
        if (cacheTimeSec < pass.startTimeSec || cacheTimeSec > pass.endTimeSec) continue;
        const pos = interpolateSample(traj.samples, cacheTimeSec);
        result.push({
          noradId: traj.noradId,
          azimuthDeg: pos.az,
          elevationDeg: pos.el,
          rangeKm: pos.range,
          passIndex: globalIdx,
          passMaxElevDeg: pass.maxElevationDeg,
        });
      }
      // Sort by pass peak elevation descending (best passes first)
      result.sort((a, b) => b.passMaxElevDeg - a.passMaxElevDeg);
      return result;
    },
  };
}
