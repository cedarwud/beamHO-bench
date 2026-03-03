import { buildScenarioMatrix } from '@/sim/bench/scenario-matrix';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildScenarioMatrixIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: scenario matrix core-v1 is deterministic, bounded, and audit-friendly',
      kind: 'integration',
      run: () => {
        const first = buildScenarioMatrix({ preset: 'core-v1' });
        const replay = buildScenarioMatrix({ preset: 'core-v1' });

        assertCondition(
          JSON.stringify(first) === JSON.stringify(replay),
          'Expected deterministic core-v1 matrix artifact for identical options.',
        );
        assertCondition(first.caseCount === 16, 'Expected bounded core-v1 matrix size of 16 cases.');
        assertCondition(first.caseCount === first.cases.length, 'Expected caseCount to match cases length.');
        assertCondition(
          first.cases.every((row) => row.matrixCaseId.startsWith('mxv1-')),
          'Expected stable matrix_case_id prefix mxv1-* for all matrix cases.',
        );

        const ids = first.cases.map((row) => row.matrixCaseId);
        assertCondition(
          new Set(ids).size === ids.length,
          'Expected matrix_case_id values to be unique in core-v1 matrix.',
        );
        assertCondition(
          first.cases.some((row) => row.mode === 'paper-baseline') &&
            first.cases.some((row) => row.mode === 'real-trace'),
          'Expected core-v1 matrix to include both paper-baseline and real-trace modes.',
        );
        assertCondition(
          first.cases.every((row) => Number.isFinite(row.axes.ueSpeedKmph)),
          'Expected ueSpeedKmph to be resolved and finite for every matrix row.',
        );
      },
    },
    {
      name: 'integration: scenario matrix extended-v1 includes broader axis combinations',
      kind: 'integration',
      run: () => {
        const core = buildScenarioMatrix({ preset: 'core-v1' });
        const extended = buildScenarioMatrix({ preset: 'extended-v1' });

        assertCondition(
          extended.caseCount > core.caseCount,
          'Expected extended-v1 matrix to contain more cases than core-v1.',
        );
        assertCondition(
          extended.cases.some((row) => row.axes.beamCount === 50),
          'Expected extended-v1 matrix to include beamCount=50 axis rows.',
        );
        assertCondition(
          extended.cases.some((row) => row.axes.smallScaleModel === 'loo'),
          'Expected extended-v1 matrix to include small-scale model loo rows.',
        );
        assertCondition(
          extended.cases.every(
            (row) =>
              row.runtimeOverrides.beam?.beamsPerSatellite === row.axes.beamCount &&
              row.runtimeOverrides.beam?.overlapRatio === row.axes.overlapRatio &&
              row.runtimeOverrides.beam?.frequencyReuse === row.axes.reuseMode &&
              row.runtimeOverrides.channel?.smallScaleModel === row.axes.smallScaleModel,
          ),
          'Expected runtimeOverrides in matrix rows to match declared axis tuple values.',
        );
      },
    },
  ];
}
