import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  buildBaselineComparisonChartArtifact,
  buildBaselineComparisonChartFileName,
} from '@/sim/bench/comparison-chart-artifact';
import { runBaselineBatch } from '@/sim/bench/runner';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildComparisonChartIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: baseline comparison chart artifact includes metadata-rich filename and rows',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp', 'a3', 'cho'],
          tickCount: 12,
        });

        const artifact = buildBaselineComparisonChartArtifact(batch);
        const replayArtifact = buildBaselineComparisonChartArtifact(batch);
        const fileName = buildBaselineComparisonChartFileName(batch);

        assertCondition(
          fileName.includes(profile.profileId) &&
            fileName.includes('seed-42') &&
            fileName.includes('ticks-12'),
          'Expected chart filename to include profile/seed/tick metadata.',
        );
        assertCondition(
          artifact.metadata.profileId === batch.profileId &&
            artifact.metadata.seed === batch.seed &&
            artifact.metadata.tickCount === batch.tickCount,
          'Expected chart metadata to match baseline batch tuple.',
        );
        assertCondition(
          artifact.rows.length === batch.runs.length,
          'Expected chart row count to match baseline run count.',
        );
        assertCondition(
          artifact.rows.every((row) =>
            batch.runs.some((run) => run.baseline === row.baseline),
          ),
          'Expected chart rows to map baseline ids from batch runs.',
        );
        assertCondition(
          artifact.metrics.some((metric) => metric.id === 'throughput_mbps') &&
            artifact.metrics.some((metric) => metric.id === 'hof_total'),
          'Expected chart metric set to include throughput and HOF totals.',
        );
        assertCondition(
          JSON.stringify(artifact) === JSON.stringify(replayArtifact),
          'Expected chart artifact generation to be deterministic for fixed batch input.',
        );
      },
    },
  ];
}
