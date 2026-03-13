import type { SatelliteGeometryState } from '@/sim/types';
import type {
  RenderableSatelliteVisibilityZone,
  SatelliteDisplayCandidate,
  SatelliteDisplaySelectionConfig,
  SatelliteDisplaySelectionInput,
} from './types';
import { classifySatelliteVisibilityZone } from './visibility-zones';

function compareZonePriority(
  left: RenderableSatelliteVisibilityZone,
  right: RenderableSatelliteVisibilityZone,
): number {
  if (left === right) {
    return 0;
  }
  return left === 'active' ? -1 : 1;
}

function compareCandidatePriority(
  left: Pick<SatelliteDisplayCandidate, 'zone' | 'satellite'>,
  right: Pick<SatelliteDisplayCandidate, 'zone' | 'satellite'>,
): number {
  const zoneComparison = compareZonePriority(left.zone, right.zone);
  if (zoneComparison !== 0) {
    return zoneComparison;
  }
  if (left.satellite.elevationDeg !== right.satellite.elevationDeg) {
    return right.satellite.elevationDeg - left.satellite.elevationDeg;
  }
  if (left.satellite.rangeKm !== right.satellite.rangeKm) {
    return left.satellite.rangeKm - right.satellite.rangeKm;
  }
  return left.satellite.id - right.satellite.id;
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

export function resolveSatelliteDisplayBudget(
  displayBudget: number | undefined,
  candidateCount: number,
): number {
  if (!Number.isFinite(displayBudget) || displayBudget === undefined) {
    return candidateCount;
  }
  return Math.max(0, Math.min(candidateCount, Math.floor(displayBudget)));
}

export function resolveCoverageSectorCount(options: {
  budget: number;
  candidateCount: number;
  requestedSectorCount?: number;
}): number {
  const { budget, candidateCount, requestedSectorCount } = options;
  if (
    requestedSectorCount !== undefined &&
    Number.isFinite(requestedSectorCount) &&
    requestedSectorCount > 0
  ) {
    return Math.max(1, Math.min(candidateCount, Math.floor(requestedSectorCount)));
  }
  if (budget <= 1 || candidateCount <= 1) {
    return 1;
  }
  const targetSectorCount = Math.max(4, Math.ceil(budget / 2));
  return Math.max(1, Math.min(candidateCount, Math.min(8, targetSectorCount)));
}

function createRenderableCandidate(options: {
  satellite: SatelliteGeometryState;
  config: SatelliteDisplaySelectionConfig;
  sectorCount: number;
}): SatelliteDisplayCandidate | null {
  const { satellite, config, sectorCount } = options;
  const zoneDecision = classifySatelliteVisibilityZone(
    satellite.elevationDeg,
    config.minElevationDeg,
  );
  if (zoneDecision.zone === 'hidden') {
    return null;
  }
  if (zoneDecision.zone === 'ghost' && config.showGhosts === false) {
    return null;
  }
  const azimuthDeg = normalizeAzimuthDeg(satellite.azimuthDeg);
  const sectorIndex = Math.min(
    Math.max(sectorCount - 1, 0),
    Math.floor((azimuthDeg / 360) * sectorCount),
  );
  return {
    satellite,
    zone: zoneDecision.zone,
    sectorIndex,
    coverageRank: Number.MAX_SAFE_INTEGER,
  };
}

function buildCoverageRankedCandidates(
  candidates: readonly SatelliteDisplayCandidate[],
  sectorCount: number,
): SatelliteDisplayCandidate[] {
  if (candidates.length <= 1 || sectorCount <= 1) {
    return [...candidates]
      .sort(compareCandidatePriority)
      .map((candidate, index) => ({
        ...candidate,
        coverageRank: index,
      }));
  }

  const buckets = Array.from({ length: sectorCount }, () => [] as SatelliteDisplayCandidate[]);
  for (const candidate of candidates) {
    buckets[candidate.sectorIndex]?.push(candidate);
  }
  for (const bucket of buckets) {
    bucket.sort(compareCandidatePriority);
  }

  const sectorOrder = buckets
    .map((bucket, index) => ({
      index,
      top: bucket[0] ?? null,
    }))
    .filter(
      (entry): entry is { index: number; top: SatelliteDisplayCandidate } => entry.top !== null,
    )
    .sort((left, right) => compareCandidatePriority(left.top, right.top));

  const ranked: SatelliteDisplayCandidate[] = [];
  let appended = true;
  while (appended) {
    appended = false;
    for (const sector of sectorOrder) {
      const candidate = buckets[sector.index]?.shift();
      if (!candidate) {
        continue;
      }
      ranked.push(candidate);
      appended = true;
    }
  }

  return ranked.map((candidate, index) => ({
    ...candidate,
    coverageRank: index,
  }));
}

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md (Section 3.1, 3.3, 3.6, 6)
 * - ASSUME-OBSERVER-SKY-DISPLAY-COVERAGE-POLICY
 *
 * Notes:
 * - Display selection is deterministic for the same physical pool + config.
 * - The coverage ranking spreads picks across azimuth sectors before pure elevation ordering.
 */
export function buildSatelliteDisplayCandidates(
  input: SatelliteDisplaySelectionInput,
): SatelliteDisplayCandidate[] {
  const renderableCount = input.satellites.reduce((count, satellite) => {
    const zoneDecision = classifySatelliteVisibilityZone(
      satellite.elevationDeg,
      input.config.minElevationDeg,
    );
    if (zoneDecision.zone === 'hidden') {
      return count;
    }
    if (zoneDecision.zone === 'ghost' && input.config.showGhosts === false) {
      return count;
    }
    return count + 1;
  }, 0);
  const budget = resolveSatelliteDisplayBudget(input.config.displayBudget, renderableCount);
  const sectorCount = resolveCoverageSectorCount({
    budget,
    candidateCount: renderableCount,
    requestedSectorCount: input.config.coverageSectorCount,
  });
  const renderable = input.satellites
    .map((satellite) =>
      createRenderableCandidate({
        satellite,
        config: input.config,
        sectorCount,
      }),
    )
    .filter((candidate): candidate is SatelliteDisplayCandidate => candidate !== null);
  return buildCoverageRankedCandidates(renderable, sectorCount);
}
