import { loadPaperProfile, type CanonicalProfileId, type DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile, ProfileMode } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import {
  runMultiSeedBaselineBenchmark,
  type MultiSeedBenchmarkArtifact,
  type MultiSeedSeedSetSpec,
} from './multi-seed-benchmark';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-cross-mode-reproducible-benchmark-sdd.md (D1)
 *
 * Notes:
 * - Cross-mode benchmark pack keeps a stable tuple contract over canonical profiles.
 */

export interface CrossModeResolvedSeedSet {
  mode: 'list' | 'range';
  seeds: number[];
  range?: {
    start: number;
    end: number;
    step: number;
  };
}

export interface CrossModeBenchmarkPlanCase {
  matrixCaseId: string;
  profileId: CanonicalProfileId;
  mode: ProfileMode;
  scenarioId: string;
  baselines: RuntimeBaseline[];
  tickCount: number;
  seedSet: CrossModeResolvedSeedSet;
  runtimeOverrides: DeepPartial<PaperProfile>;
  tupleDigest: string;
}

export interface CrossModeBenchmarkPlanArtifact {
  artifactType: 'cross-mode-benchmark-plan';
  schemaVersion: '1.0.0';
  caseCount: number;
  cases: CrossModeBenchmarkPlanCase[];
  tupleDigest: string;
}

export interface CrossModeBenchmarkRunCase {
  matrixCaseId: string;
  profileId: CanonicalProfileId;
  mode: ProfileMode;
  scenarioId: string;
  tupleDigest: string;
  benchmark: MultiSeedBenchmarkArtifact;
}

export interface CrossModeBenchmarkRunArtifact {
  artifactType: 'cross-mode-benchmark-run';
  schemaVersion: '1.0.0';
  plan: CrossModeBenchmarkPlanArtifact;
  runs: CrossModeBenchmarkRunCase[];
  artifactDigest: string;
}

export interface BuildCrossModeBenchmarkPlanOptions {
  baselines?: readonly RuntimeBaseline[];
  seedSet?: MultiSeedSeedSetSpec;
  tickCount?: number;
  profileSequence?: CanonicalProfileId[];
  runtimeOverridesByProfile?: Partial<Record<CanonicalProfileId, DeepPartial<PaperProfile>>>;
  scenarioIdByProfile?: Partial<Record<CanonicalProfileId, string>>;
}

const DEFAULT_BASELINES: RuntimeBaseline[] = [
  'max-rsrp',
  'max-elevation',
  'max-remaining-time',
];

const DEFAULT_SEED_SET: MultiSeedSeedSetSpec = {
  seeds: [11, 17, 23],
};

const DEFAULT_PROFILE_SEQUENCE: CanonicalProfileId[] = [
  'case9-default',
  'starlink-like',
  'oneweb-like',
];

const DEFAULT_SCENARIO_BY_PROFILE: Record<CanonicalProfileId, string> = {
  'case9-default': 'cmr-case9-default',
  'starlink-like': 'cmr-realtrace-starlink-like',
  'oneweb-like': 'cmr-realtrace-oneweb-like',
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const raw = JSON.stringify(value);
    return raw ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function hashFNV1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeInteger(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite integer for ${field}, got '${value}'.`);
  }
  return Math.round(value);
}

function normalizeBaselines(values: readonly RuntimeBaseline[]): RuntimeBaseline[] {
  const seen = new Set<RuntimeBaseline>();
  const normalized: RuntimeBaseline[] = [];
  for (const baseline of values) {
    if (seen.has(baseline)) {
      continue;
    }
    seen.add(baseline);
    normalized.push(baseline);
  }
  if (normalized.length === 0) {
    throw new Error('Cross-mode benchmark requires at least one baseline.');
  }
  return normalized;
}

function dedupeAndSortSeeds(values: number[]): number[] {
  const unique = new Set<number>();
  for (const rawValue of values) {
    unique.add(normalizeInteger(rawValue, 'seed'));
  }
  return [...unique].sort((left, right) => left - right);
}

function resolveSeedSet(seedSet: MultiSeedSeedSetSpec): CrossModeResolvedSeedSet {
  const hasSeeds = Array.isArray(seedSet.seeds);
  const hasRange = Boolean(seedSet.range);
  if (hasSeeds && hasRange) {
    throw new Error("seedSet must provide exactly one of 'seeds' or 'range'.");
  }
  if (!hasSeeds && !hasRange) {
    throw new Error("seedSet must include 'seeds' or 'range'.");
  }

  if (hasSeeds) {
    const normalized = dedupeAndSortSeeds(seedSet.seeds ?? []);
    if (normalized.length === 0) {
      throw new Error('seedSet.seeds must include at least one seed.');
    }
    return {
      mode: 'list',
      seeds: normalized,
    };
  }

  const range = seedSet.range as { start: number; end: number; step?: number };
  const start = normalizeInteger(range.start, 'seedSet.range.start');
  const end = normalizeInteger(range.end, 'seedSet.range.end');
  const requestedStep = range.step ?? 1;
  const step = normalizeInteger(Math.abs(requestedStep), 'seedSet.range.step');
  if (step <= 0) {
    throw new Error('seedSet.range.step must be >= 1.');
  }

  const seeds: number[] = [];
  const direction = start <= end ? 1 : -1;
  for (let value = start; direction > 0 ? value <= end : value >= end; value += direction * step) {
    seeds.push(value);
  }

  const normalizedSeeds = dedupeAndSortSeeds(seeds);
  if (normalizedSeeds.length === 0) {
    throw new Error('seedSet.range expansion produced zero seeds.');
  }

  return {
    mode: 'range',
    seeds: normalizedSeeds,
    range: {
      start,
      end,
      step,
    },
  };
}

function normalizeTickCount(value: number): number {
  const tickCount = normalizeInteger(value, 'tickCount');
  if (tickCount <= 0) {
    throw new Error('tickCount must be >= 1.');
  }
  return tickCount;
}

function normalizeProfileSequence(sequence: CanonicalProfileId[]): CanonicalProfileId[] {
  const seen = new Set<CanonicalProfileId>();
  const normalized: CanonicalProfileId[] = [];
  for (const profileId of sequence) {
    if (seen.has(profileId)) {
      continue;
    }
    seen.add(profileId);
    normalized.push(profileId);
  }
  if (normalized.length === 0) {
    throw new Error('profileSequence must include at least one canonical profile.');
  }
  return normalized;
}

function buildMatrixCaseId(profileId: CanonicalProfileId): string {
  return `cmrv1-${profileId.replace(/-/g, '_')}`;
}

export function buildCrossModeBenchmarkPlan(
  options: BuildCrossModeBenchmarkPlanOptions = {},
): CrossModeBenchmarkPlanArtifact {
  const baselines = normalizeBaselines(options.baselines ?? DEFAULT_BASELINES);
  const seedSet = resolveSeedSet(options.seedSet ?? DEFAULT_SEED_SET);
  const tickCount = normalizeTickCount(options.tickCount ?? 60);
  const profileSequence = normalizeProfileSequence(
    options.profileSequence ?? DEFAULT_PROFILE_SEQUENCE,
  );

  const cases = profileSequence.map((profileId) => {
    const runtimeOverrides = options.runtimeOverridesByProfile?.[profileId] ?? {};
    const profile = loadPaperProfile(profileId, runtimeOverrides);
    const scenarioId = options.scenarioIdByProfile?.[profileId] ?? DEFAULT_SCENARIO_BY_PROFILE[profileId];
    const matrixCaseId = buildMatrixCaseId(profileId);
    const tupleMaterial = {
      matrixCaseId,
      profileId,
      mode: profile.mode,
      scenarioId,
      baselines,
      tickCount,
      seedSet,
      runtimeOverrides,
    };

    return {
      matrixCaseId,
      profileId,
      mode: profile.mode,
      scenarioId,
      baselines,
      tickCount,
      seedSet,
      runtimeOverrides,
      tupleDigest: hashFNV1aHex(stableStringify(tupleMaterial)),
    };
  });

  const tupleDigest = hashFNV1aHex(stableStringify(cases));

  return {
    artifactType: 'cross-mode-benchmark-plan',
    schemaVersion: '1.0.0',
    caseCount: cases.length,
    cases,
    tupleDigest,
  };
}

export function runCrossModeBaselineBenchmark(
  options: BuildCrossModeBenchmarkPlanOptions = {},
): CrossModeBenchmarkRunArtifact {
  const plan = buildCrossModeBenchmarkPlan(options);
  const runs = plan.cases.map((suiteCase) => {
    const profile = loadPaperProfile(suiteCase.profileId, suiteCase.runtimeOverrides);
    const benchmark = runMultiSeedBaselineBenchmark({
      profile,
      baselines: suiteCase.baselines,
      tickCount: suiteCase.tickCount,
      seedSet: suiteCase.seedSet,
      scenarioId: suiteCase.scenarioId,
    });

    return {
      matrixCaseId: suiteCase.matrixCaseId,
      profileId: suiteCase.profileId,
      mode: suiteCase.mode,
      scenarioId: suiteCase.scenarioId,
      tupleDigest: suiteCase.tupleDigest,
      benchmark,
    };
  });

  const artifactDigest = hashFNV1aHex(stableStringify({ plan, runs }));
  return {
    artifactType: 'cross-mode-benchmark-run',
    schemaVersion: '1.0.0',
    plan,
    runs,
    artifactDigest,
  };
}
