import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runMultiSeedBaselineBenchmark } from '@/sim/bench/multi-seed-benchmark';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildMultiSeedBenchmarkIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: multi-seed benchmark artifact is deterministic and contains stats/effect-size fields',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const first = runMultiSeedBaselineBenchmark({
          profile,
          baselines: ['max-rsrp', 'a3', 'cho'],
          tickCount: 12,
          seedSet: {
            seeds: [11, 17, 23, 29, 31],
          },
        });
        const replay = runMultiSeedBaselineBenchmark({
          profile,
          baselines: ['max-rsrp', 'a3', 'cho'],
          tickCount: 12,
          seedSet: {
            seeds: [11, 17, 23, 29, 31],
          },
        });

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic multi-seed artifact for identical tuple.',
        );
        assertCondition(first.metadata.sampleSize === 5, 'Expected sampleSize=5 for seed list.');
        assertCondition(
          first.baselineStats.length === 3,
          'Expected one baselineStats row per requested baseline.',
        );

        const throughputStat = first.baselineStats
          .flatMap((row) => row.metrics)
          .find((metric) => metric.metricId === 'throughput_mbps');
        assertCondition(Boolean(throughputStat), 'Expected throughput_mbps metric stats.');
        assertCondition(
          Number.isFinite(throughputStat?.mean) &&
            Number.isFinite(throughputStat?.std) &&
            Number.isFinite(throughputStat?.ci95HalfWidth),
          'Expected finite mean/std/ci95 stats in multi-seed metric output.',
        );

        const effect = first.pairwiseEffects.find(
          (row) =>
            row.baselineA === 'max-rsrp' &&
            row.baselineB === 'a3' &&
            row.metricId === 'throughput_mbps',
        );
        assertCondition(Boolean(effect), 'Expected pairwise effect-size row for max-rsrp vs a3.');
        assertCondition(
          Number.isFinite(effect?.meanDiff) &&
            Number.isFinite(effect?.cohensD) &&
            Number.isFinite(effect?.pooledStd),
          'Expected finite pairwise effect-size values.',
        );
      },
    },
    {
      name: 'integration: multi-seed benchmark supports deterministic range expansion',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const artifact = runMultiSeedBaselineBenchmark({
          profile,
          baselines: ['max-rsrp', 'a3'],
          tickCount: 8,
          seedSet: {
            range: {
              start: 11,
              end: 31,
              step: 6,
            },
          },
        });

        assertCondition(artifact.metadata.seedSet.mode === 'range', 'Expected range seed mode.');
        assertCondition(
          JSON.stringify(artifact.metadata.seedSet.seeds) === JSON.stringify([11, 17, 23, 29]),
          'Expected canonical ascending expanded seed list [11,17,23,29].',
        );

        const rowSeeds = [...new Set(artifact.seedRows.map((row) => row.seed))];
        assertCondition(
          JSON.stringify(rowSeeds) === JSON.stringify([11, 17, 23, 29]),
          'Expected seed rows to reflect expanded deterministic seed set.',
        );
      },
    },
  ];
}
