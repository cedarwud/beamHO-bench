import type {
  MultiSeedBenchmarkArtifact,
  MultiSeedMetricId,
  MultiSeedPairwiseEffect,
  MultiSeedSeedRow,
} from './multi-seed-benchmark';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-common-benchmark-v1-sdd.md (D4 / §3.4)
 */

export interface MultiSeedPaperTuple {
  profile_id: string;
  matrix_case_id: string;
  seed_set: number[];
  tick_count: number;
}

export interface MultiSeedDistributionArtifactRow {
  tuple: MultiSeedPaperTuple & { baseline: string };
  metric_id: MultiSeedMetricId;
  values: number[];
  cdf: Array<{
    value: number;
    cumulative_probability: number;
  }>;
  boxplot: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
  };
}

export interface MultiSeedRankingStabilityRow {
  tuple: MultiSeedPaperTuple;
  metric_id: MultiSeedMetricId;
  higher_is_better: boolean;
  ranking_by_mean: Array<{
    baseline: string;
    mean: number;
  }>;
  winner_by_mean: string | null;
  winner_frequency_by_seed: Array<{
    baseline: string;
    win_count: number;
    win_ratio: number;
  }>;
  winner_stability_ratio: number;
}

export interface MultiSeedSignificanceRow {
  tuple: MultiSeedPaperTuple;
  metric_id: MultiSeedMetricId;
  baseline_a: string;
  baseline_b: string;
  method: 'paired-normal-approx';
  paired_sample_size: number;
  mean_diff: number;
  cohens_d: number;
  z_score: number;
  p_value_two_sided: number;
  significant_at_0_05: boolean;
}

export interface MultiSeedPaperReportArtifact {
  artifactType: 'multi-seed-paper-report';
  schemaVersion: '1.0.0';
  tuple: MultiSeedPaperTuple;
  sourceTupleDigest: string;
  sourceArtifactDigest: string;
  distributions: MultiSeedDistributionArtifactRow[];
  ranking_stability: MultiSeedRankingStabilityRow[];
  significance_summary: MultiSeedSignificanceRow[];
}

export interface BuildMultiSeedPaperReportOptions {
  matrixCaseId?: string;
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const position = (sortedValues.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const t = position - lower;
  return sortedValues[lower] * (1 - t) + sortedValues[upper] * t;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values: number[], average: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-absX * absX));
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erfApprox(x / Math.sqrt(2)));
}

function getMetricValue(row: MultiSeedSeedRow, metricId: MultiSeedMetricId): number {
  switch (metricId) {
    case 'throughput_mbps':
      return row.throughput_mbps;
    case 'avg_dl_sinr_db':
      return row.avg_dl_sinr_db;
    case 'handover_rate':
      return row.handover_rate;
    case 'jain_fairness':
      return row.jain_fairness;
    case 'rlf_state1':
      return row.rlf_state1;
    case 'rlf_state2':
      return row.rlf_state2;
    case 'rlf_total':
      return row.rlf_total;
    case 'hof_state2':
      return row.hof_state2;
    case 'hof_state3':
      return row.hof_state3;
    case 'hof_total':
      return row.hof_total;
    case 'uho':
      return row.uho;
    case 'hopp':
      return row.hopp;
    default:
      return 0;
  }
}

function computePairedSignificance(
  rowsA: MultiSeedSeedRow[],
  rowsB: MultiSeedSeedRow[],
  metricId: MultiSeedMetricId,
): {
  pairedSampleSize: number;
  meanDiff: number;
  zScore: number;
  pValueTwoSided: number;
} {
  const valueBySeedB = new Map<number, number>(
    rowsB.map((row) => [row.seed, getMetricValue(row, metricId)]),
  );
  const diffs: number[] = [];
  for (const rowA of rowsA) {
    const valueB = valueBySeedB.get(rowA.seed);
    if (!Number.isFinite(valueB)) {
      continue;
    }
    diffs.push(getMetricValue(rowA, metricId) - (valueB as number));
  }
  if (diffs.length === 0) {
    return {
      pairedSampleSize: 0,
      meanDiff: 0,
      zScore: 0,
      pValueTwoSided: 1,
    };
  }
  const meanDiff = mean(diffs);
  const stdDiff = sampleStd(diffs, meanDiff);
  if (stdDiff <= 0 || diffs.length <= 1) {
    return {
      pairedSampleSize: diffs.length,
      meanDiff,
      zScore: 0,
      pValueTwoSided: 1,
    };
  }
  const standardError = stdDiff / Math.sqrt(diffs.length);
  if (standardError <= 0) {
    return {
      pairedSampleSize: diffs.length,
      meanDiff,
      zScore: 0,
      pValueTwoSided: 1,
    };
  }
  const zScore = meanDiff / standardError;
  const pValueTwoSided = 2 * (1 - normalCdf(Math.abs(zScore)));
  return {
    pairedSampleSize: diffs.length,
    meanDiff,
    zScore,
    pValueTwoSided: Math.max(0, Math.min(1, pValueTwoSided)),
  };
}

function buildDistributions(
  benchmark: MultiSeedBenchmarkArtifact,
  tuple: MultiSeedPaperTuple,
): MultiSeedDistributionArtifactRow[] {
  const rows: MultiSeedDistributionArtifactRow[] = [];
  for (const baseline of benchmark.metadata.baselines) {
    const seedRows = benchmark.seedRows.filter((row) => row.baseline === baseline);
    for (const metric of benchmark.metrics) {
      const values = seedRows.map((row) => getMetricValue(row, metric.id));
      const sortedValues = [...values].sort((left, right) => left - right);
      const average = mean(sortedValues);
      rows.push({
        tuple: {
          ...tuple,
          baseline,
        },
        metric_id: metric.id,
        values: sortedValues,
        cdf: sortedValues.map((value, index) => ({
          value,
          cumulative_probability: (index + 1) / Math.max(sortedValues.length, 1),
        })),
        boxplot: {
          min: sortedValues[0] ?? 0,
          q1: quantile(sortedValues, 0.25),
          median: quantile(sortedValues, 0.5),
          q3: quantile(sortedValues, 0.75),
          max: sortedValues[sortedValues.length - 1] ?? 0,
          mean: average,
        },
      });
    }
  }
  return rows;
}

function buildRankingStability(
  benchmark: MultiSeedBenchmarkArtifact,
  tuple: MultiSeedPaperTuple,
): MultiSeedRankingStabilityRow[] {
  const output: MultiSeedRankingStabilityRow[] = [];
  for (const metric of benchmark.metrics) {
    const statsRows = benchmark.baselineStats
      .map((row) => ({
        baseline: row.baseline,
        mean: row.metrics.find((entry) => entry.metricId === metric.id)?.mean ?? 0,
      }))
      .sort((left, right) =>
        metric.higherIsBetter ? right.mean - left.mean : left.mean - right.mean,
      );
    const winnerByMean = statsRows[0]?.baseline ?? null;

    const winnerCounter = new Map<string, number>();
    for (const seed of benchmark.metadata.seedSet.seeds) {
      const candidates = benchmark.seedRows.filter((row) => row.seed === seed);
      let winner: MultiSeedSeedRow | null = null;
      for (const row of candidates) {
        const value = getMetricValue(row, metric.id);
        if (!winner) {
          winner = row;
          continue;
        }
        const winnerValue = getMetricValue(winner, metric.id);
        const better = metric.higherIsBetter ? value > winnerValue : value < winnerValue;
        if (better) {
          winner = row;
        }
      }
      if (winner) {
        winnerCounter.set(winner.baseline, (winnerCounter.get(winner.baseline) ?? 0) + 1);
      }
    }

    const winnerFrequencyBySeed = benchmark.metadata.baselines.map((baseline) => {
      const winCount = winnerCounter.get(baseline) ?? 0;
      return {
        baseline,
        win_count: winCount,
        win_ratio: winCount / Math.max(benchmark.metadata.sampleSize, 1),
      };
    });
    const winnerStabilityRatio = winnerFrequencyBySeed.reduce(
      (max, row) => (row.win_ratio > max ? row.win_ratio : max),
      0,
    );

    output.push({
      tuple,
      metric_id: metric.id,
      higher_is_better: metric.higherIsBetter,
      ranking_by_mean: statsRows,
      winner_by_mean: winnerByMean,
      winner_frequency_by_seed: winnerFrequencyBySeed,
      winner_stability_ratio: winnerStabilityRatio,
    });
  }
  return output;
}

function buildSignificanceSummary(
  benchmark: MultiSeedBenchmarkArtifact,
  tuple: MultiSeedPaperTuple,
): MultiSeedSignificanceRow[] {
  const rowsByBaseline = new Map<string, MultiSeedSeedRow[]>();
  for (const baseline of benchmark.metadata.baselines) {
    rowsByBaseline.set(
      baseline,
      benchmark.seedRows
        .filter((row) => row.baseline === baseline)
        .sort((left, right) => left.seed - right.seed),
    );
  }

  const output: MultiSeedSignificanceRow[] = [];
  for (const pairwise of benchmark.pairwiseEffects) {
    const rowsA = rowsByBaseline.get(pairwise.baselineA) ?? [];
    const rowsB = rowsByBaseline.get(pairwise.baselineB) ?? [];
    const significance = computePairedSignificance(rowsA, rowsB, pairwise.metricId);
    output.push({
      tuple,
      metric_id: pairwise.metricId,
      baseline_a: pairwise.baselineA,
      baseline_b: pairwise.baselineB,
      method: 'paired-normal-approx',
      paired_sample_size: significance.pairedSampleSize,
      mean_diff: significance.meanDiff,
      cohens_d: pairwise.cohensD,
      z_score: significance.zScore,
      p_value_two_sided: significance.pValueTwoSided,
      significant_at_0_05: significance.pValueTwoSided < 0.05,
    });
  }
  return output;
}

export function buildMultiSeedPaperReportArtifact(
  benchmark: MultiSeedBenchmarkArtifact,
  options: BuildMultiSeedPaperReportOptions = {},
): MultiSeedPaperReportArtifact {
  const tuple: MultiSeedPaperTuple = {
    profile_id: benchmark.metadata.profileId,
    matrix_case_id: options.matrixCaseId ?? 'matrix-unset',
    seed_set: [...benchmark.metadata.seedSet.seeds],
    tick_count: benchmark.metadata.tickCount,
  };

  return {
    artifactType: 'multi-seed-paper-report',
    schemaVersion: '1.0.0',
    tuple,
    sourceTupleDigest: benchmark.metadata.tupleDigest,
    sourceArtifactDigest: benchmark.metadata.artifactDigest,
    distributions: buildDistributions(benchmark, tuple),
    ranking_stability: buildRankingStability(benchmark, tuple),
    significance_summary: buildSignificanceSummary(benchmark, tuple),
  };
}

export function findPairwiseEffect(
  effects: MultiSeedPairwiseEffect[],
  baselineA: string,
  baselineB: string,
  metricId: MultiSeedMetricId,
): MultiSeedPairwiseEffect | null {
  for (const effect of effects) {
    if (
      effect.baselineA === baselineA &&
      effect.baselineB === baselineB &&
      effect.metricId === metricId
    ) {
      return effect;
    }
  }
  return null;
}
