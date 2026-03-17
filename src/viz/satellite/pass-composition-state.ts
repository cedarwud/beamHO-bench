/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md (Section 5.1)
 * - ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
 *
 * Notes:
 * - Manages per-satellite persistent visual actor state across ticks.
 * - View-only: no writes back to simulation or handover contracts.
 */

import type { SatelliteDisplayCandidate, PassActorMemory } from './types';

/** Find the lowest non-negative integer not in the occupied set. */
function allocateLane(occupied: ReadonlySet<number>): number {
  let lane = 0;
  while (occupied.has(lane)) {
    lane++;
  }
  return lane;
}

/**
 * Advance the pass actor registry by one tick.
 *
 * - Satellites newly in the selected set → lifecycle 'entering', stable lane assigned.
 * - Satellites continuing from the previous tick → lifecycle 'tracked', lane preserved.
 * - Satellites that left the selected set → lifecycle 'exiting', lane preserved during
 *   linger countdown before removal.
 *
 * New satellites are allocated lanes in ascending satelliteId order so that
 * the laneIndex→depth mapping stays consistent with the prior sort-based policy.
 * Once assigned, each actor's lane is preserved for its full lifetime (including
 * exiting linger), preventing screen-space jumps from sort-order shuffles.
 */
export function applyPassCompositionState(options: {
  selectedCandidates: readonly SatelliteDisplayCandidate[];
  previousActors: readonly PassActorMemory[];
  tick: number;
  exitLingerTicks: number;
}): PassActorMemory[] {
  const { selectedCandidates, previousActors, tick, exitLingerTicks } = options;

  const selectedIds = new Set(selectedCandidates.map((c) => c.satellite.id));
  const prevById = new Map(previousActors.map((a) => [a.satelliteId, a]));
  const next: PassActorMemory[] = [];

  // Lanes occupied by actors that will persist into this tick.
  const occupiedLanes = new Set<number>(previousActors.map((a) => a.laneIndex));

  // Continuing satellites: promote to tracked, preserve lane.
  const newCandidates: SatelliteDisplayCandidate[] = [];
  for (const candidate of selectedCandidates) {
    const id = candidate.satellite.id;
    const prev = prevById.get(id);
    const elevationDeg = candidate.satellite.elevationDeg;
    const azimuthDeg = candidate.satellite.azimuthDeg;

    if (!prev) {
      newCandidates.push(candidate);
    } else {
      const isDescending = elevationDeg < prev.lastElevationDeg;
      const predictedExitAzimuthDeg = isDescending
        ? azimuthDeg
        : prev.predictedExitAzimuthDeg;

      next.push({
        ...prev,
        lifecycle: 'tracked',
        lastAzimuthDeg: azimuthDeg,
        lastElevationDeg: elevationDeg,
        predictedExitAzimuthDeg,
        exitTicksRemaining: 0,
      });
    }
  }

  // New satellites: allocate lanes in ascending satelliteId order so the
  // depth-spread pattern matches the prior sort-based assignment.
  newCandidates.sort((a, b) => a.satellite.id - b.satellite.id);
  for (const candidate of newCandidates) {
    const id = candidate.satellite.id;
    const elevationDeg = candidate.satellite.elevationDeg;
    const azimuthDeg = candidate.satellite.azimuthDeg;
    const laneIndex = allocateLane(occupiedLanes);
    occupiedLanes.add(laneIndex);
    next.push({
      satelliteId: id,
      lifecycle: 'entering',
      entryAzimuthDeg: azimuthDeg,
      entryElevationDeg: elevationDeg,
      predictedExitAzimuthDeg: (azimuthDeg + 180) % 360,
      lastAzimuthDeg: azimuthDeg,
      lastElevationDeg: elevationDeg,
      firstSeenTick: tick,
      exitTicksRemaining: 0,
      laneIndex,
    });
  }

  // Satellites that left the display set — give them linger time, preserve lane.
  for (const prev of previousActors) {
    if (selectedIds.has(prev.satelliteId)) {
      continue; // Already handled above.
    }
    if (prev.lifecycle === 'exiting') {
      const remaining = prev.exitTicksRemaining - 1;
      if (remaining > 0) {
        next.push({ ...prev, exitTicksRemaining: remaining });
      }
      // remaining === 0: actor removed, lane freed implicitly.
    } else {
      // Transition to exiting, lane preserved for the linger duration.
      // Update predictedExitAzimuthDeg to lastAzimuthDeg so the exit trajectory
      // fades downward along the satellite's current azimuth rather than jumping
      // cross-sky to the initial estimate ((entryAzimuthDeg + 180) % 360).
      next.push({
        ...prev,
        lifecycle: 'exiting',
        exitTicksRemaining: exitLingerTicks,
        predictedExitAzimuthDeg: prev.lastAzimuthDeg,
      });
    }
  }

  return next;
}
