import { buildReproBundleV1Artifact } from '@/sim/bench/repro-bundle-v1';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildReproBundleV1IntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: repro-bundle v1 artifact is deterministic and covers canonical profiles',
      kind: 'integration',
      run: () => {
        const first = buildReproBundleV1Artifact();
        const replay = buildReproBundleV1Artifact();

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic repro-bundle v1 artifact for fixed options.',
        );
        assertCondition(
          first.profileCoverage.includes('case9-default') &&
            first.profileCoverage.includes('starlink-like') &&
            first.profileCoverage.includes('oneweb-like'),
          'Expected canonical profile coverage in repro-bundle v1 artifact.',
        );
        assertCondition(
          first.components.crossMode.plan.caseCount === 3,
          `Expected cross-mode caseCount=3, got ${first.components.crossMode.plan.caseCount}.`,
        );
        assertCondition(
          first.components.baselineParameterEnvelope.caseCount === 72,
          `Expected baseline envelope caseCount=72, got ${first.components.baselineParameterEnvelope.caseCount}.`,
        );
        assertCondition(
          first.componentDigests.crossModeArtifactDigest === first.components.crossMode.artifactDigest,
          'Expected cross-mode digest consistency in repro-bundle component digests.',
        );
        assertCondition(
          first.componentDigests.baselineEnvelopeTupleDigest ===
            first.components.baselineParameterEnvelope.tupleDigest,
          'Expected baseline-envelope digest consistency in repro-bundle component digests.',
        );
        assertCondition(
          typeof first.tupleDigest === 'string' &&
            first.tupleDigest.length > 0 &&
            typeof first.artifactDigest === 'string' &&
            first.artifactDigest.length > 0,
          'Expected non-empty tuple/artifact digests in repro-bundle v1 artifact.',
        );
      },
    },
    {
      name: 'integration: repro-bundle v1 supports deterministic narrowed options',
      kind: 'integration',
      run: () => {
        const options = {
          crossModeOptions: {
            baselines: ['max-rsrp'] as const,
            tickCount: 8,
            seedSet: {
              seeds: [11, 17],
            },
          },
          baselineEnvelopeOptions: {
            axes: {
              profileSequence: ['case9-default'],
              minElevationDegTiers: [10, 20],
              ueCountTiers: [50],
              ueSpeedKmphTiers: [0, 30],
            },
          },
        };
        const first = buildReproBundleV1Artifact(options);
        const replay = buildReproBundleV1Artifact(options);

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic repro-bundle v1 artifact for narrowed options.',
        );
        assertCondition(
          first.components.crossMode.runs.every(
            (run) => run.benchmark.metadata.sampleSize === 2 && run.benchmark.metadata.tickCount === 8,
          ),
          'Expected narrowed cross-mode benchmark tuple (sampleSize=2, tickCount=8).',
        );
        assertCondition(
          first.components.baselineParameterEnvelope.caseCount === 4,
          `Expected narrowed baseline envelope caseCount=4, got ${first.components.baselineParameterEnvelope.caseCount}.`,
        );
        assertCondition(
          JSON.stringify(first.profileCoverage) === JSON.stringify(['case9-default', 'oneweb-like', 'starlink-like']),
          `Expected stable sorted profile coverage, got ${JSON.stringify(first.profileCoverage)}.`,
        );
      },
    },
  ];
}
