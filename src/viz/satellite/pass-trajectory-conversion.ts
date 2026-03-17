/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md (Section 5.3)
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
 *
 * Notes:
 * - Converts physical geometry + policy decisions into visual render targets.
 * - Uses the same analytic arc formula as display-pipeline (azimuth/elevation
 *   → hemisphere dome position), augmented with lifecycle-aware entry/exit
 *   interpolation and lane offsets.
 * - View-only: no writes back to simulation or handover contracts.
 */

import type { PassActorMemory, SatelliteDisplayPhase } from './types';
import type { PassMotionDecision } from './pass-motion-policy';

export interface PassTrajectoryOutput {
  satelliteId: number;
  visualTargetPosition: [number, number, number];
  motionSourcePosition: [number, number, number];
  phase: SatelliteDisplayPhase;
  opacity: number;
}

// Arc projection constants (same as display-pipeline.ts internal formula).
// BASE_RADIUS must exceed the camera's visible x/z range at the dome base
// so that horizon-level satellites (el≈0°) are outside the frustum.
// Camera at [0,900,1200] with FOV=38° sees ±927 at y=60.
// BASE_RADIUS must exceed 927 so el=0° (radius=BASE_RADIUS) is off-screen.
// With non-linear power mapping, el=5° jumps to ~0.36 fraction = radius 620,
// so the entry transition from off-screen to visible is at el≈1-2°.
const BASE_RADIUS = 960;
const BASE_Y = 60;
// HEIGHT_SCALE controls dome height. Keep moderate so high-elevation
// satellites stay visually within the scene (not flying above it).
const HEIGHT_SCALE = 320;
// Per-lane depth offset to separate simultaneous passes without disturbing
// horizontal screen-space spread. X-axis offset is intentionally avoided
// because it shifts screen-space position and reduces horizontal band count.
const LANE_DEPTH_SPREAD_WORLD = 25;

/**
 * Project azimuth/elevation to observer-sky hemisphere world position.
 *
 * - Low elevation → near boundary/edge of dome.
 * - High elevation → near center/top.
 * - Full 360° azimuth → full horizontal spread.
 */
export function projectArcPosition(
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  // Allow negative elevations so sub-horizon satellites project BEYOND the
  // dome boundary (horizontalRadius > BASE_RADIUS, y < BASE_Y). This ensures
  // satellites enter/exit from outside the visible scene, not at the edge.
  const clamped = Math.min(90, elevationDeg);
  const azRad = (azimuthDeg * Math.PI) / 180;
  // Non-linear (sqrt) projection: compresses the outer ring and spreads
  // mid-elevation satellites toward the center. With 25-55 satellites above
  // horizon at any time, most at el 5-30°, linear projection clusters them
  // at the edge. Sqrt mapping pulls el=15° from radius 667 → 474, el=30°
  // from 533 → 319, making the scene center visually populated.
  const linearFrac = clamped / 90; // -∞..1, 0 at horizon, 1 at zenith
  const POWER = 0.35; // <1 compresses outer ring, pulls satellites toward center
  const elevFraction = linearFrac >= 0
    ? Math.pow(linearFrac, POWER)
    : -Math.pow(-linearFrac, POWER); // preserve negative for sub-horizon
  const horizontalRadius = BASE_RADIUS * (1 - elevFraction);
  return [
    horizontalRadius * Math.sin(azRad),
    BASE_Y + HEIGHT_SCALE * elevFraction,
    horizontalRadius * Math.cos(azRad),
  ];
}

function applyLaneOffset(
  position: [number, number, number],
  laneIndex: number,
): [number, number, number] {
  return [position[0], position[1], position[2] + laneIndex * LANE_DEPTH_SPREAD_WORLD];
}

/**
 * Build visual trajectory outputs for all actors.
 *
 * - entering: render from entry anchor, interpolating toward first corridor position.
 * - tracked: render at corridor-aware arc position.
 * - exiting: fade toward predicted exit boundary.
 */
export function buildPassTrajectoryOutputs(options: {
  actors: readonly PassActorMemory[];
  decisions: Map<number, PassMotionDecision>;
  currentGeometryById: Map<number, { azimuthDeg: number; elevationDeg: number }>;
  exitLingerTicks: number;
}): PassTrajectoryOutput[] {
  const { actors, decisions, currentGeometryById, exitLingerTicks } = options;
  const outputs: PassTrajectoryOutput[] = [];

  for (const actor of actors) {
    const decision = decisions.get(actor.satelliteId);
    if (!decision) {
      continue;
    }

    const geometry = currentGeometryById.get(actor.satelliteId);
    const laneIndex = decision.laneIndex;

    if (actor.lifecycle === 'entering') {
      // Use current azimuth at low elevation so the motion source stays close
      // to the visual target (bounded vertical rise), avoiding large cross-sky jumps.
      const currentAzimuth = geometry?.azimuthDeg ?? actor.entryAzimuthDeg;
      const entryAnchor = projectArcPosition(currentAzimuth, 2);
      const corridorPos = geometry
        ? applyLaneOffset(
            projectArcPosition(geometry.azimuthDeg, geometry.elevationDeg),
            laneIndex,
          )
        : entryAnchor;
      outputs.push({
        satelliteId: actor.satelliteId,
        visualTargetPosition: corridorPos,
        motionSourcePosition: entryAnchor,
        phase: decision.phase,
        opacity: 0.7,
      });
    } else if (actor.lifecycle === 'exiting') {
      // Apply the same laneOffset to exitAnchor so the fade trajectory stays in the
      // same depth lane as lastPos — avoids large per-tick Z jumps in screen space.
      const exitAnchor = applyLaneOffset(
        projectArcPosition(actor.predictedExitAzimuthDeg, 2),
        laneIndex,
      );
      const lastPos = geometry
        ? applyLaneOffset(
            projectArcPosition(geometry.azimuthDeg, geometry.elevationDeg),
            laneIndex,
          )
        : applyLaneOffset(
            // Use lastAzimuthDeg (real last known azimuth) to avoid cross-sky jump
            // when geometry is unavailable on the first exiting tick.
            projectArcPosition(actor.lastAzimuthDeg, actor.lastElevationDeg),
            laneIndex,
          );
      const safeLingerTicks = exitLingerTicks > 0 ? exitLingerTicks : 1;
      const fadeProgress = 1 - actor.exitTicksRemaining / safeLingerTicks;
      const t = Math.max(0, Math.min(1, fadeProgress));
      outputs.push({
        satelliteId: actor.satelliteId,
        visualTargetPosition: [
          lastPos[0] + (exitAnchor[0] - lastPos[0]) * t,
          lastPos[1] + (exitAnchor[1] - lastPos[1]) * t,
          lastPos[2] + (exitAnchor[2] - lastPos[2]) * t,
        ],
        motionSourcePosition: lastPos,
        phase: decision.phase,
        opacity: Math.max(0.05, 0.5 * (1 - t)),
      });
    } else {
      // tracked
      const pos = geometry
        ? applyLaneOffset(
            projectArcPosition(geometry.azimuthDeg, geometry.elevationDeg),
            laneIndex,
          )
        : applyLaneOffset(
            projectArcPosition(actor.entryAzimuthDeg, actor.lastElevationDeg),
            laneIndex,
          );
      outputs.push({
        satelliteId: actor.satelliteId,
        visualTargetPosition: pos,
        motionSourcePosition: pos,
        phase: decision.phase,
        opacity: 1.0,
      });
    }
  }

  return outputs;
}
