import {
  buildCrossModeBenchmarkPlan,
  runCrossModeBaselineBenchmark,
} from '@/sim/bench/cross-mode-benchmark';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildCrossModeBenchmarkIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: cross-mode benchmark plan is deterministic and covers canonical profiles',
      kind: 'integration',
      run: () => {
        const first = buildCrossModeBenchmarkPlan();
        const replay = buildCrossModeBenchmarkPlan();

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic cross-mode plan for identical options.',
        );
        assertCondition(first.caseCount === 3, 'Expected cross-mode plan caseCount=3.');
        assertCondition(
          first.caseCount === first.cases.length,
          'Expected cross-mode plan caseCount to equal cases length.',
        );

        const profileIds = first.cases.map((suiteCase) => suiteCase.profileId);
        assertCondition(
          profileIds.includes('case9-default') &&
            profileIds.includes('starlink-like') &&
            profileIds.includes('oneweb-like'),
          'Expected canonical profile coverage in cross-mode plan.',
        );

        const matrixCaseIds = first.cases.map((suiteCase) => suiteCase.matrixCaseId);
        assertCondition(
          new Set(matrixCaseIds).size === matrixCaseIds.length,
          'Expected unique matrixCaseId values in cross-mode plan.',
        );

        const realTraceCount = first.cases.filter((suiteCase) => suiteCase.mode === 'real-trace').length;
        const paperBaselineCount = first.cases.filter(
          (suiteCase) => suiteCase.mode === 'paper-baseline',
        ).length;
        assertCondition(realTraceCount === 2, 'Expected two real-trace cases in cross-mode plan.');
        assertCondition(
          paperBaselineCount === 1,
          'Expected one paper-baseline case in cross-mode plan.',
        );
      },
    },
    {
      name: 'integration: cross-mode benchmark run is deterministic for fixed tuple',
      kind: 'integration',
      run: () => {
        const options = {
          baselines: ['max-rsrp'] as const,
          tickCount: 8,
          seedSet: {
            seeds: [11, 17],
          },
        };
        const first = runCrossModeBaselineBenchmark(options);
        const replay = runCrossModeBaselineBenchmark(options);

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic cross-mode benchmark run for fixed tuple.',
        );
        assertCondition(first.runs.length === 3, 'Expected three run groups in cross-mode benchmark.');

        for (const run of first.runs) {
          assertCondition(
            run.benchmark.metadata.sampleSize === 2,
            `Expected sampleSize=2 for ${run.matrixCaseId}.`,
          );
          assertCondition(
            run.benchmark.metadata.profileId === run.profileId,
            `Expected profileId consistency for ${run.matrixCaseId}.`,
          );
          assertCondition(
            run.benchmark.metadata.scenarioId === run.scenarioId,
            `Expected scenarioId consistency for ${run.matrixCaseId}.`,
          );
          assertCondition(
            run.benchmark.metadata.seedSet.seeds.length === 2,
            `Expected resolved seedSet size=2 for ${run.matrixCaseId}.`,
          );
        }
      },
    },
  ];
}
