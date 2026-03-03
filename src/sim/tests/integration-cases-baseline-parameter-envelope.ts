import { buildBaselineParameterEnvelopeArtifact } from '@/sim/bench/baseline-parameter-envelope';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildBaselineParameterEnvelopeIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: baseline-parameter envelope artifact is deterministic and covers canonical tiers',
      kind: 'integration',
      run: () => {
        const first = buildBaselineParameterEnvelopeArtifact();
        const replay = buildBaselineParameterEnvelopeArtifact();

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic baseline-parameter envelope artifact for fixed options.',
        );
        assertCondition(first.caseCount === 72, `Expected caseCount=72, got ${first.caseCount}.`);
        assertCondition(
          first.caseCount === first.cases.length,
          'Expected caseCount to match cases length in baseline-parameter envelope artifact.',
        );

        const profileIds = new Set(first.cases.map((suiteCase) => suiteCase.profileId));
        assertCondition(
          profileIds.has('case9-default') &&
            profileIds.has('starlink-like') &&
            profileIds.has('oneweb-like'),
          'Expected canonical profile coverage in baseline-parameter envelope artifact.',
        );

        const modes = new Set(first.cases.map((suiteCase) => suiteCase.mode));
        assertCondition(
          modes.has('paper-baseline') && modes.has('real-trace'),
          'Expected dual-mode coverage in baseline-parameter envelope artifact.',
        );

        const minElevationSet = new Set(first.cases.map((suiteCase) => suiteCase.axes.minElevationDeg));
        const ueCountSet = new Set(first.cases.map((suiteCase) => suiteCase.axes.ueCount));
        const ueSpeedSet = new Set(first.cases.map((suiteCase) => suiteCase.axes.ueSpeedKmph));
        assertCondition(
          [10, 20, 35].every((value) => minElevationSet.has(value)),
          'Expected minElevation tiers 10/20/35 in baseline-parameter envelope artifact.',
        );
        assertCondition(
          [50, 100].every((value) => ueCountSet.has(value)),
          'Expected UE count tiers 50/100 in baseline-parameter envelope artifact.',
        );
        assertCondition(
          [0, 3, 30, 60].every((value) => ueSpeedSet.has(value)),
          'Expected UE speed tiers 0/3/30/60 in baseline-parameter envelope artifact.',
        );

        const matrixCaseIds = first.cases.map((suiteCase) => suiteCase.matrixCaseId);
        assertCondition(
          new Set(matrixCaseIds).size === matrixCaseIds.length,
          'Expected unique matrixCaseId values in baseline-parameter envelope artifact.',
        );

        for (const suiteCase of first.cases) {
          assertCondition(
            suiteCase.runtimeOverrides.constellation?.minElevationDeg ===
              suiteCase.axes.minElevationDeg,
            `Expected minElevation runtime override consistency for ${suiteCase.matrixCaseId}.`,
          );
          assertCondition(
            suiteCase.runtimeOverrides.ue?.count === suiteCase.axes.ueCount,
            `Expected UE count runtime override consistency for ${suiteCase.matrixCaseId}.`,
          );
          assertCondition(
            suiteCase.runtimeOverrides.ue?.speedKmphOptions?.length === 1 &&
              suiteCase.runtimeOverrides.ue?.speedKmphOptions?.[0] === suiteCase.axes.ueSpeedKmph,
            `Expected UE speed runtime override consistency for ${suiteCase.matrixCaseId}.`,
          );
          assertCondition(
            typeof suiteCase.tupleDigest === 'string' && suiteCase.tupleDigest.length > 0,
            `Expected non-empty tupleDigest for ${suiteCase.matrixCaseId}.`,
          );
        }
      },
    },
    {
      name: 'integration: baseline-parameter envelope axes are deduplicated and sorted deterministically',
      kind: 'integration',
      run: () => {
        const artifact = buildBaselineParameterEnvelopeArtifact({
          axes: {
            profileSequence: ['starlink-like', 'starlink-like'],
            minElevationDegTiers: [35, 10, 35],
            ueCountTiers: [100, 50, 100],
            ueSpeedKmphTiers: [60, 0, 60],
          },
        });

        assertCondition(artifact.caseCount === 8, `Expected caseCount=8, got ${artifact.caseCount}.`);
        assertCondition(
          JSON.stringify(artifact.axes.minElevationDegTiers) === JSON.stringify([10, 35]),
          `Expected normalized minElevation tiers [10,35], got ${JSON.stringify(artifact.axes.minElevationDegTiers)}.`,
        );
        assertCondition(
          JSON.stringify(artifact.axes.ueCountTiers) === JSON.stringify([50, 100]),
          `Expected normalized UE count tiers [50,100], got ${JSON.stringify(artifact.axes.ueCountTiers)}.`,
        );
        assertCondition(
          JSON.stringify(artifact.axes.ueSpeedKmphTiers) === JSON.stringify([0, 60]),
          `Expected normalized UE speed tiers [0,60], got ${JSON.stringify(artifact.axes.ueSpeedKmphTiers)}.`,
        );
        assertCondition(
          JSON.stringify(artifact.axes.profileSequence) === JSON.stringify(['starlink-like']),
          `Expected normalized profile sequence ['starlink-like'], got ${JSON.stringify(artifact.axes.profileSequence)}.`,
        );
      },
    },
  ];
}
