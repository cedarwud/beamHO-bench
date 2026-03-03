import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runMultiSeedBaselineBenchmark } from '@/sim/bench/multi-seed-benchmark';
import { buildMultiSeedPaperReportArtifact } from '@/sim/bench/multi-seed-reporting';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildMultiSeedReportingIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: multi-seed paper report exports deterministic cdf/boxplot raw artifacts',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const benchmark = runMultiSeedBaselineBenchmark({
          profile,
          baselines: ['max-rsrp', 'a3', 'cho'],
          tickCount: 12,
          seedSet: {
            seeds: [11, 17, 23, 29, 31],
          },
        });
        const first = buildMultiSeedPaperReportArtifact(benchmark, {
          matrixCaseId: 'mxv1-pb-b16-ov25-s3-pedestrian-ruFR1-ssnone',
        });
        const replay = buildMultiSeedPaperReportArtifact(benchmark, {
          matrixCaseId: 'mxv1-pb-b16-ov25-s3-pedestrian-ruFR1-ssnone',
        });

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic multi-seed paper report for identical benchmark tuple.',
        );
        assertCondition(
          first.distributions.length === benchmark.metadata.baselines.length * benchmark.metrics.length,
          'Expected one distribution row per baseline x metric.',
        );
        assertCondition(
          first.distributions.every(
            (row) =>
              row.values.length === benchmark.metadata.sampleSize &&
              row.cdf.length === benchmark.metadata.sampleSize &&
              row.tuple.profile_id === benchmark.metadata.profileId &&
              row.tuple.tick_count === benchmark.metadata.tickCount,
          ),
          'Expected cdf/boxplot rows to carry complete tuple fields and sample coverage.',
        );
      },
    },
    {
      name: 'integration: multi-seed paper report exports ranking stability and significance summary',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const benchmark = runMultiSeedBaselineBenchmark({
          profile,
          baselines: ['max-rsrp', 'a3', 'cho'],
          tickCount: 10,
          seedSet: {
            seeds: [11, 17, 23, 29],
          },
        });
        const report = buildMultiSeedPaperReportArtifact(benchmark, {
          matrixCaseId: 'mxv1-pb-b16-ov25-s60-vehicular-rur4-ssshadowed-rician',
        });

        assertCondition(
          report.ranking_stability.length === benchmark.metrics.length,
          'Expected one ranking-stability row per metric.',
        );
        assertCondition(
          report.ranking_stability.every((row) => {
            const totalWins = row.winner_frequency_by_seed.reduce(
              (sum, winner) => sum + winner.win_count,
              0,
            );
            return totalWins === benchmark.metadata.sampleSize;
          }),
          'Expected per-metric winner frequency counts to sum to sample size.',
        );
        assertCondition(
          report.significance_summary.length === benchmark.pairwiseEffects.length,
          'Expected significance summary to cover all pairwise effect rows.',
        );
        assertCondition(
          report.significance_summary.every(
            (row) =>
              Number.isFinite(row.mean_diff) &&
              Number.isFinite(row.cohens_d) &&
              Number.isFinite(row.z_score) &&
              Number.isFinite(row.p_value_two_sided) &&
              row.p_value_two_sided >= 0 &&
              row.p_value_two_sided <= 1,
          ),
          'Expected finite significance summary statistics with bounded p-value range.',
        );
      },
    },
  ];
}
