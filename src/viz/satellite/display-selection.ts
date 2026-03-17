import type { SatelliteGeometryState } from '@/sim/types';
import type {
  RenderableSatelliteVisibilityZone,
  SatelliteDisplayCandidate,
  SatelliteDisplayPhase,
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

function resolvePhaseThresholds(config: SatelliteDisplaySelectionConfig): {
  low: number;
  high: number;
} {
  const low = Number.isFinite(config.phaseLowElevationDeg)
    ? Math.max(0, Math.floor(config.phaseLowElevationDeg ?? 0))
    : Math.max(22, Math.floor(config.minElevationDeg + 12));
  const highCandidate = Number.isFinite(config.phaseHighElevationDeg)
    ? Math.max(low + 1, Math.floor(config.phaseHighElevationDeg ?? low + 1))
    : Math.max(46, low + 18);

  return {
    low,
    high: Math.min(89, highCandidate),
  };
}

function compareByRangeAndId(
  left: SatelliteGeometryState,
  right: SatelliteGeometryState,
): number {
  if (left.rangeKm !== right.rangeKm) {
    return left.rangeKm - right.rangeKm;
  }
  return left.id - right.id;
}

function comparePhasePriority(
  left: SatelliteDisplayCandidate,
  right: SatelliteDisplayCandidate,
  thresholds: { low: number; high: number },
): number {
  const zoneComparison = compareZonePriority(left.zone, right.zone);
  if (zoneComparison !== 0) {
    return zoneComparison;
  }

  if (left.phase !== right.phase) {
    // Rank by phase priority so sorting is meaningful across phases.
    // Note: authoritative phase determination uses real elevation trend
    // in pass-motion-policy.ts; the sin(azimuth) heuristic here is only
    // for budget slot allocation at the selection stage.
    const phaseOrder: Record<string, number> = {
      'high-pass': 0,
      'mid-pass': 1,
      'boundary-ingress': 2,
      'boundary-egress': 3,
    };
    return (phaseOrder[left.phase] ?? 4) - (phaseOrder[right.phase] ?? 4);
  }

  if (left.phase === 'high-pass') {
    if (left.satellite.elevationDeg !== right.satellite.elevationDeg) {
      return right.satellite.elevationDeg - left.satellite.elevationDeg;
    }
    return compareByRangeAndId(left.satellite, right.satellite);
  }

  if (left.phase === 'mid-pass') {
    const targetElevation = (thresholds.low + thresholds.high) / 2;
    const leftDistance = Math.abs(left.satellite.elevationDeg - targetElevation);
    const rightDistance = Math.abs(right.satellite.elevationDeg - targetElevation);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return compareByRangeAndId(left.satellite, right.satellite);
  }

  if (left.satellite.elevationDeg !== right.satellite.elevationDeg) {
    return left.satellite.elevationDeg - right.satellite.elevationDeg;
  }

  return compareByRangeAndId(left.satellite, right.satellite);
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

function resolveDisplayPhase(options: {
  satellite: SatelliteGeometryState;
  config: SatelliteDisplaySelectionConfig;
}): SatelliteDisplayPhase {
  const thresholds = resolvePhaseThresholds(options.config);
  if (options.satellite.elevationDeg < thresholds.low) {
    const azimuthDeg = normalizeAzimuthDeg(options.satellite.azimuthDeg);
    return Math.sin((azimuthDeg * Math.PI) / 180) < 0
      ? 'boundary-ingress'
      : 'boundary-egress';
  }
  if (options.satellite.elevationDeg < thresholds.high) {
    return 'mid-pass';
  }
  return 'high-pass';
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
    phase: resolveDisplayPhase({ satellite, config }),
    coverageRank: Number.MAX_SAFE_INTEGER,
  };
}

function buildSectorRankedPhaseCandidates(options: {
  candidates: readonly SatelliteDisplayCandidate[];
  sectorCount: number;
  thresholds: { low: number; high: number };
}): SatelliteDisplayCandidate[] {
  const { candidates, sectorCount, thresholds } = options;
  if (candidates.length <= 1 || sectorCount <= 1) {
    return [...candidates].sort((left, right) =>
      comparePhasePriority(left, right, thresholds),
    );
  }

  const buckets = Array.from({ length: sectorCount }, () => [] as SatelliteDisplayCandidate[]);
  for (const candidate of candidates) {
    buckets[candidate.sectorIndex]?.push(candidate);
  }
  for (const bucket of buckets) {
    bucket.sort((left, right) => comparePhasePriority(left, right, thresholds));
  }

  const sectorOrder = buckets
    .map((bucket, index) => ({
      index,
      top: bucket[0] ?? null,
    }))
    .filter(
      (entry): entry is { index: number; top: SatelliteDisplayCandidate } => entry.top !== null,
    )
    .sort((left, right) => comparePhasePriority(left.top, right.top, thresholds));

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

  return ranked;
}

function buildPhaseLayeredRanking(options: {
  candidates: readonly SatelliteDisplayCandidate[];
  sectorCount: number;
  thresholds: { low: number; high: number };
}): SatelliteDisplayCandidate[] {
  // Prioritise high-elevation passes so the display set shows readable arcs.
  // Previous order started with boundary-ingress, which filled the budget
  // with near-horizon satellites that never traced a visible arc.
  const phaseOrder: SatelliteDisplayPhase[] = [
    'high-pass',
    'mid-pass',
    'high-pass',
    'mid-pass',
    'boundary-ingress',
    'boundary-egress',
  ];

  const perPhase = new Map<SatelliteDisplayPhase, SatelliteDisplayCandidate[]>();
  for (const phase of [
    'boundary-ingress',
    'mid-pass',
    'high-pass',
    'boundary-egress',
  ] as SatelliteDisplayPhase[]) {
    const phaseCandidates = options.candidates.filter((candidate) => candidate.phase === phase);
    perPhase.set(
      phase,
      buildSectorRankedPhaseCandidates({
        candidates: phaseCandidates,
        sectorCount: options.sectorCount,
        thresholds: options.thresholds,
      }),
    );
  }

  const ranked: SatelliteDisplayCandidate[] = [];
  let appended = true;
  while (appended) {
    appended = false;
    for (const phase of phaseOrder) {
      const bucket = perPhase.get(phase);
      const candidate = bucket?.shift();
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
 * - sdd/pending/beamHO-bench-observer-sky-projection-selection-correction-sdd.md (Section 3.2, 3.3, 3.5, 6)
 * - ASSUME-OBSERVER-SKY-DISPLAY-COVERAGE-POLICY
 * - ASSUME-OBSERVER-SKY-PHASE-SELECTION-POLICY
 *
 * Notes:
 * - Display selection is deterministic for the same physical pool + config.
 * - Ranking now interleaves boundary, mid-pass, and higher-pass layers so the
 *   visible set preserves phase spread instead of behaving like a high-elevation top-N cut.
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
  const thresholds = resolvePhaseThresholds(input.config);
  const renderable = input.satellites
    .map((satellite) =>
      createRenderableCandidate({
        satellite,
        config: input.config,
        sectorCount,
      }),
    )
    .filter((candidate): candidate is SatelliteDisplayCandidate => candidate !== null);
  return buildPhaseLayeredRanking({
    candidates: renderable,
    sectorCount,
    thresholds,
  });
}
