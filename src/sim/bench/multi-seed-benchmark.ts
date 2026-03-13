import type { PaperProfile } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { BaselineBatchOptions } from './runner';
import { runBaselineBatch } from './runner';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-common-benchmark-v1-sdd.md (D1 / §3.1)
 */

export type MultiSeedMetricId =
  | 'throughput_mbps'
  | 'avg_dl_sinr_db'
  | 'handover_rate'
  | 'jain_fairness'
  | 'rlf_state1'
  | 'rlf_state2'
  | 'rlf_total'
  | 'hof_state2'
  | 'hof_state3'
  | 'hof_total'
  | 'uho'
  | 'hopp';

export interface MultiSeedMetricDefinition {
  id: MultiSeedMetricId;
  label: string;
  higherIsBetter: boolean;
}

export interface MultiSeedMetricStats {
  metricId: MultiSeedMetricId;
  n: number;
  mean: number;
  std: number;
  ci95HalfWidth: number;
  min: number;
  max: number;
}

export interface MultiSeedBaselineStats {
  baseline: RuntimeBaseline;
  metrics: MultiSeedMetricStats[];
}

export interface MultiSeedPairwiseEffect {
  baselineA: RuntimeBaseline;
  baselineB: RuntimeBaseline;
  metricId: MultiSeedMetricId;
  meanDiff: number;
  cohensD: number;
  pooledStd: number;
  nA: number;
  nB: number;
}

export interface MultiSeedSeedRow {
  baseline: RuntimeBaseline;
  seed: number;
  scenarioId: string;
  throughput_mbps: number;
  avg_dl_sinr_db: number;
  handover_rate: number;
  jain_fairness: number;
  rlf_state1: number;
  rlf_state2: number;
  rlf_total: number;
  hof_state2: number;
  hof_state3: number;
  hof_total: number;
  uho: number;
  hopp: number;
}

export interface MultiSeedRangeSpec {
  start: number;
  end: number;
  step?: number;
}

export interface MultiSeedSeedSetSpec {
  seeds?: number[];
  range?: MultiSeedRangeSpec;
}

export interface ResolvedMultiSeedSet {
  mode: 'list' | 'range';
  seeds: number[];
  range?: {
    start: number;
    end: number;
    step: number;
  };
}

export interface RunMultiSeedBenchmarkOptions {
  profile: PaperProfile;
  baselines: RuntimeBaseline[];
  tickCount: number;
  seedSet: MultiSeedSeedSetSpec;
  scenarioId?: string;
  policyRuntime?: BaselineBatchOptions['policyRuntime'];
}

export interface MultiSeedBenchmarkArtifact {
  artifactType: 'multi-seed-baseline-benchmark';
  schemaVersion: '1.0.0';
  metadata: {
    profileId: string;
    mode: PaperProfile['mode'];
    scenarioId: string;
    tickCount: number;
    baselines: RuntimeBaseline[];
    sampleSize: number;
    seedSet: ResolvedMultiSeedSet;
    policyMode: 'off' | 'on';
    tupleDigest: string;
    artifactDigest: string;
  };
  metrics: MultiSeedMetricDefinition[];
  seedRows: MultiSeedSeedRow[];
  baselineStats: MultiSeedBaselineStats[];
  pairwiseEffects: MultiSeedPairwiseEffect[];
}

interface MetricSpec extends MultiSeedMetricDefinition {
  select: (row: MultiSeedSeedRow) => number;
}

const METRIC_SPECS: readonly MetricSpec[] = [
  { id: 'throughput_mbps', label: 'Throughput (Mbps)', higherIsBetter: true, select: (row) => row.throughput_mbps },
  { id: 'avg_dl_sinr_db', label: 'Average DL SINR (dB)', higherIsBetter: true, select: (row) => row.avg_dl_sinr_db },
  { id: 'handover_rate', label: 'Handover Rate', higherIsBetter: false, select: (row) => row.handover_rate },
  { id: 'jain_fairness', label: "Jain's Fairness", higherIsBetter: true, select: (row) => row.jain_fairness },
  { id: 'rlf_state1', label: 'RLF State1', higherIsBetter: false, select: (row) => row.rlf_state1 },
  { id: 'rlf_state2', label: 'RLF State2', higherIsBetter: false, select: (row) => row.rlf_state2 },
  { id: 'rlf_total', label: 'RLF Total', higherIsBetter: false, select: (row) => row.rlf_total },
  { id: 'hof_state2', label: 'HOF State2', higherIsBetter: false, select: (row) => row.hof_state2 },
  { id: 'hof_state3', label: 'HOF State3', higherIsBetter: false, select: (row) => row.hof_state3 },
  { id: 'hof_total', label: 'HOF Total', higherIsBetter: false, select: (row) => row.hof_total },
  { id: 'uho', label: 'UHO', higherIsBetter: false, select: (row) => row.uho },
  { id: 'hopp', label: 'HOPP', higherIsBetter: false, select: (row) => row.hopp },
];

function normalizeInteger(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite integer for ${field}, got '${value}'.`);
  }
  return Math.round(value);
}

function normalizeBaselines(values: RuntimeBaseline[]): RuntimeBaseline[] {
  const seen = new Set<RuntimeBaseline>();
  const ordered: RuntimeBaseline[] = [];
  for (const baseline of values) {
    if (seen.has(baseline)) {
      continue;
    }
    seen.add(baseline);
    ordered.push(baseline);
  }
  return ordered;
}

function dedupeAndSortSeeds(values: number[]): number[] {
  const unique = new Set<number>();
  for (const rawValue of values) {
    unique.add(normalizeInteger(rawValue, 'seed'));
  }
  return [...unique].sort((left, right) => left - right);
}

function resolveSeedSet(seedSet: MultiSeedSeedSetSpec): ResolvedMultiSeedSet {
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

  const range = seedSet.range as MultiSeedRangeSpec;
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

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function sampleStd(values: number[], average: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function computeMetricStats(
  metricId: MultiSeedMetricId,
  samples: number[],
): MultiSeedMetricStats {
  const n = samples.length;
  const metricMean = mean(samples);
  const std = sampleStd(samples, metricMean);
  const ci95HalfWidth = n <= 1 ? 0 : 1.96 * (std / Math.sqrt(n));
  const minValue = samples.reduce((min, value) => (value < min ? value : min), Number.POSITIVE_INFINITY);
  const maxValue = samples.reduce((max, value) => (value > max ? value : max), Number.NEGATIVE_INFINITY);
  return {
    metricId,
    n,
    mean: metricMean,
    std,
    ci95HalfWidth,
    min: Number.isFinite(minValue) ? minValue : 0,
    max: Number.isFinite(maxValue) ? maxValue : 0,
  };
}

function computeCohensD(
  samplesA: number[],
  samplesB: number[],
): { cohensD: number; pooledStd: number } {
  const nA = samplesA.length;
  const nB = samplesB.length;
  if (nA === 0 || nB === 0) {
    return { cohensD: 0, pooledStd: 0 };
  }
  const meanA = mean(samplesA);
  const meanB = mean(samplesB);
  const stdA = sampleStd(samplesA, meanA);
  const stdB = sampleStd(samplesB, meanB);
  const denominator = nA + nB - 2;
  if (denominator <= 0) {
    return { cohensD: 0, pooledStd: 0 };
  }
  const pooledVariance = ((nA - 1) * stdA ** 2 + (nB - 1) * stdB ** 2) / denominator;
  const pooledStd = Math.sqrt(Math.max(pooledVariance, 0));
  if (pooledStd <= 0) {
    return { cohensD: 0, pooledStd: 0 };
  }
  return {
    cohensD: (meanA - meanB) / pooledStd,
    pooledStd,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
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

function resolveScenarioId(seedRows: MultiSeedSeedRow[], fallback: string): string {
  const firstScenarioId = seedRows[0]?.scenarioId ?? fallback;
  return seedRows.every((row) => row.scenarioId === firstScenarioId) ? firstScenarioId : 'mixed-scenarios';
}

export function runMultiSeedBaselineBenchmark(options: RunMultiSeedBenchmarkOptions): MultiSeedBenchmarkArtifact {
  const baselines = normalizeBaselines(options.baselines);
  if (baselines.length === 0) {
    throw new Error('runMultiSeedBaselineBenchmark requires at least one baseline.');
  }

  const seedSet = resolveSeedSet(options.seedSet);
  const tickCount = normalizeInteger(options.tickCount, 'tickCount');
  if (tickCount <= 0) {
    throw new Error('tickCount must be >= 1.');
  }

  const seedRows: MultiSeedSeedRow[] = [];
  for (const seed of seedSet.seeds) {
    const batch = runBaselineBatch({
      profile: options.profile,
      seed,
      baselines,
      tickCount,
      scenarioId: options.scenarioId,
      policyRuntime: options.policyRuntime,
    });

    for (const run of batch.runs) {
      const kpi = run.result.summary.kpi;
      seedRows.push({
        baseline: run.baseline,
        seed,
        scenarioId: run.result.metadata.scenarioId,
        throughput_mbps: kpi.throughput,
        avg_dl_sinr_db: kpi.avgDlSinr,
        handover_rate: kpi.handoverRate,
        jain_fairness: kpi.jainFairness,
        rlf_state1: kpi.rlf.state1,
        rlf_state2: kpi.rlf.state2,
        rlf_total: kpi.rlf.state1 + kpi.rlf.state2,
        hof_state2: kpi.hof.state2,
        hof_state3: kpi.hof.state3,
        hof_total: kpi.hof.state2 + kpi.hof.state3,
        uho: kpi.uho,
        hopp: kpi.hopp,
      });
    }
  }

  seedRows.sort((left, right) => {
    if (left.baseline !== right.baseline) {
      return left.baseline.localeCompare(right.baseline);
    }
    return left.seed - right.seed;
  });

  const statsByBaseline = new Map<RuntimeBaseline, MultiSeedBaselineStats>();
  for (const baseline of baselines) {
    const rows = seedRows.filter((row) => row.baseline === baseline);
    const metrics = METRIC_SPECS.map((metric) =>
      computeMetricStats(
        metric.id,
        rows.map((row) => metric.select(row)),
      ),
    );
    statsByBaseline.set(baseline, {
      baseline,
      metrics,
    });
  }

  const pairwiseEffects: MultiSeedPairwiseEffect[] = [];
  for (let leftIndex = 0; leftIndex < baselines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < baselines.length; rightIndex += 1) {
      const baselineA = baselines[leftIndex];
      const baselineB = baselines[rightIndex];
      const rowsA = seedRows.filter((row) => row.baseline === baselineA);
      const rowsB = seedRows.filter((row) => row.baseline === baselineB);

      for (const metric of METRIC_SPECS) {
        const samplesA = rowsA.map((row) => metric.select(row));
        const samplesB = rowsB.map((row) => metric.select(row));
        const meanDiff = mean(samplesA) - mean(samplesB);
        const effect = computeCohensD(samplesA, samplesB);
        pairwiseEffects.push({
          baselineA,
          baselineB,
          metricId: metric.id,
          meanDiff,
          cohensD: effect.cohensD,
          pooledStd: effect.pooledStd,
          nA: samplesA.length,
          nB: samplesB.length,
        });
      }
    }
  }

  const scenarioId = resolveScenarioId(
    seedRows,
    options.scenarioId ?? 'unknown-scenario',
  );
  const tupleMaterial = {
    profileId: options.profile.profileId,
    mode: options.profile.mode,
    scenarioId: options.scenarioId ?? scenarioId,
    tickCount,
    baselines,
    seedSet,
    policyMode: options.policyRuntime?.mode ?? 'off',
  };
  const tupleDigest = hashFNV1aHex(stableStringify(tupleMaterial));

  const artifactWithoutDigest = {
    artifactType: 'multi-seed-baseline-benchmark' as const,
    schemaVersion: '1.0.0' as const,
    metadata: {
      profileId: options.profile.profileId,
      mode: options.profile.mode,
      scenarioId,
      tickCount,
      baselines,
      sampleSize: seedSet.seeds.length,
      seedSet,
      policyMode: options.policyRuntime?.mode ?? 'off',
      tupleDigest,
    },
    metrics: METRIC_SPECS.map(({ id, label, higherIsBetter }) => ({
      id,
      label,
      higherIsBetter,
    })),
    seedRows,
    baselineStats: baselines.map(
      (baseline) => statsByBaseline.get(baseline) as MultiSeedBaselineStats,
    ),
    pairwiseEffects,
  };
  const artifactDigest = hashFNV1aHex(stableStringify(artifactWithoutDigest));

  return {
    ...artifactWithoutDigest,
    metadata: {
      ...artifactWithoutDigest.metadata,
      artifactDigest,
    },
  };
}
