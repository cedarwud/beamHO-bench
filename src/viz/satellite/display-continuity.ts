import type {
  SatelliteDisplayCandidate,
  SatelliteDisplayContinuityInput,
  SatelliteDisplayContinuityMemory,
  SatelliteDisplaySelectionState,
} from './types';
import { resolveSatelliteDisplayBudget } from './display-selection';

function buildCandidateRankById(
  candidates: readonly SatelliteDisplayCandidate[],
): Map<number, number> {
  return new Map(candidates.map((candidate, index) => [candidate.satellite.id, index]));
}

function compareCandidateIdsByRank(rankById: Map<number, number>) {
  return (leftId: number, rightId: number): number => {
    const leftRank = rankById.get(leftId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankById.get(rightId) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return leftId - rightId;
  };
}

function isContinuousSequence(
  previous: SatelliteDisplayContinuityMemory | null | undefined,
  input: SatelliteDisplayContinuityInput,
): boolean {
  if (!previous) {
    return false;
  }
  if (previous.sequenceKey !== input.sequenceKey) {
    return false;
  }
  if (input.tick === previous.tick && input.timeSec === previous.timeSec) {
    return true;
  }
  if (input.tick !== previous.tick + 1) {
    return false;
  }
  return input.timeSec >= previous.timeSec;
}

function resolveRetentionRankSlack(displayBudget: number, configured: number | undefined): number {
  if (configured !== undefined && Number.isFinite(configured) && configured >= 0) {
    return Math.floor(configured);
  }
  return Math.max(2, Math.ceil(displayBudget / 3));
}

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md (Section 3.4, 3.6, 6)
 *
 * Notes:
 * - Continuity memory is frontend-owned and never mutates simulation/runtime state.
 * - Replacement is bounded by a rank slack so new high-priority passes can enter without full-window churn.
 */
export function applySatelliteDisplayContinuity(
  input: SatelliteDisplayContinuityInput,
): SatelliteDisplaySelectionState {
  const budget = resolveSatelliteDisplayBudget(input.displayBudget, input.candidates.length);
  const coverageSectorCount = input.candidates.reduce(
    (maxValue, candidate) => Math.max(maxValue, candidate.sectorIndex + 1),
    0,
  );
  const rankById = buildCandidateRankById(input.candidates);
  const previousMemory = isContinuousSequence(input.memory, input) ? input.memory : null;
  const previousIds = previousMemory?.selectedIds ?? [];
  const retentionRankSlack = resolveRetentionRankSlack(
    budget,
    input.config?.retentionRankSlack,
  );
  const retentionLimit = budget + retentionRankSlack;
  const compareIdsByRank = compareCandidateIdsByRank(rankById);

  const retainedIds = previousIds
    .filter((satelliteId) => {
      const rank = rankById.get(satelliteId);
      return rank !== undefined && rank < retentionLimit;
    })
    .sort(compareIdsByRank)
    .slice(0, budget);

  const retainedIdSet = new Set(retainedIds);
  const selected = input.candidates
    .filter((candidate) => retainedIdSet.has(candidate.satellite.id))
    .concat(
      input.candidates.filter((candidate) => !retainedIdSet.has(candidate.satellite.id)),
    )
    .slice(0, budget);
  const selectedIds = selected.map((candidate) => candidate.satellite.id);
  const selectedIdSet = new Set(selectedIds);
  const droppedIds = previousIds
    .filter((satelliteId) => !selectedIdSet.has(satelliteId))
    .sort(compareIdsByRank);

  return {
    budget,
    coverageSectorCount,
    candidates: [...input.candidates],
    selected,
    selectedIds,
    retainedIds,
    droppedIds,
  };
}

export function buildSatelliteDisplayContinuityMemory(options: {
  sequenceKey: string;
  tick: number;
  timeSec: number;
  selectedIds: readonly number[];
  actors?: ReadonlyArray<NonNullable<SatelliteDisplayContinuityMemory['actors']>[number]>;
}): SatelliteDisplayContinuityMemory {
  return {
    sequenceKey: options.sequenceKey,
    tick: options.tick,
    timeSec: options.timeSec,
    selectedIds: [...options.selectedIds],
    actors: options.actors ? [...options.actors] : undefined,
  };
}
