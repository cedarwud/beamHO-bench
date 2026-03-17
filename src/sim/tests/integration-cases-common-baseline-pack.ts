import { buildCommonBaselineV2ValidationDefinitions } from '@/sim/bench/common-baseline-pack';
import { buildValidationDefinitions } from '@/sim/bench/validation-definitions';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

const EXPECTED_IDS = [
  'VAL-CB2-PROPAGATION-REALISM-SWEEP',
  'VAL-CB2-PROTOCOL-RLF-TIMING-SWEEP',
  'VAL-CB2-CHO-MC-GEOMETRY-SWEEP',
  'VAL-CB2-STRESS-LOAD-SWEEP',
] as const;

const EXPECTED_CASE_COUNTS: Record<(typeof EXPECTED_IDS)[number], number> = {
  'VAL-CB2-PROPAGATION-REALISM-SWEEP': 4,
  'VAL-CB2-PROTOCOL-RLF-TIMING-SWEEP': 3,
  'VAL-CB2-CHO-MC-GEOMETRY-SWEEP': 3,
  'VAL-CB2-STRESS-LOAD-SWEEP': 3,
};

export function buildCommonBaselinePackIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: common-baseline v2 validation pack is deterministic and bounded',
      kind: 'integration',
      run: () => {
        const first = buildCommonBaselineV2ValidationDefinitions();
        const second = buildCommonBaselineV2ValidationDefinitions();

        assertCondition(
          JSON.stringify(first) === JSON.stringify(second),
          'Expected deterministic common-baseline pack generation.',
        );

        for (const definition of first) {
          assertCondition(
            definition.cases.length > 0,
            `Expected non-empty case list for ${definition.validationId}.`,
          );
          for (const suiteCase of definition.cases) {
            assertCondition(
              suiteCase.tickCount <= 300,
              `Expected bounded tickCount<=300 for ${definition.validationId}/${suiteCase.caseId}.`,
            );
            assertCondition(
              suiteCase.baselines.length > 0,
              `Expected non-empty baseline set for ${definition.validationId}/${suiteCase.caseId}.`,
            );
          }
        }
      },
    },
    {
      name: 'integration: common-baseline v2 validation ids are wired into validation definitions',
      kind: 'integration',
      run: () => {
        const definitions = buildValidationDefinitions();
        const byId = new Map(definitions.map((definition) => [definition.validationId, definition]));

        for (const id of EXPECTED_IDS) {
          const definition = byId.get(id);
          assertCondition(Boolean(definition), `Expected validation definition '${id}' to be present.`);
          assertCondition(
            definition?.cases.length === EXPECTED_CASE_COUNTS[id],
            `Expected ${id} case count=${EXPECTED_CASE_COUNTS[id]}, got ${definition?.cases.length ?? 0}.`,
          );
          assertCondition(
            definition?.requiresFullFidelity === true,
            `Expected ${id} requiresFullFidelity=true.`,
          );
        }
      },
    },
  ];
}
