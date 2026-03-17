import { buildServiceContinuityBaselineValidationDefinitions } from '@/sim/bench/service-continuity-baseline-pack';
import { buildValidationDefinitions } from '@/sim/bench/validation-definitions';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

const EXPECTED_IDS = [
  'VAL-SCB-STARLINK-SEAMLESS-SWEEP',
  'VAL-SCB-ONEWEB-DAPS-TIMING-SWEEP',
  'VAL-SCB-COUPLED-SCHEDULER-CONTINUITY-SWEEP',
] as const;

const EXPECTED_CASE_COUNTS: Record<(typeof EXPECTED_IDS)[number], number> = {
  'VAL-SCB-STARLINK-SEAMLESS-SWEEP': 3,
  'VAL-SCB-ONEWEB-DAPS-TIMING-SWEEP': 3,
  'VAL-SCB-COUPLED-SCHEDULER-CONTINUITY-SWEEP': 3,
};

export function buildServiceContinuityPackIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: service continuity baseline pack is deterministic and bounded',
      kind: 'integration',
      run: () => {
        const first = buildServiceContinuityBaselineValidationDefinitions();
        const second = buildServiceContinuityBaselineValidationDefinitions();

        assertCondition(
          JSON.stringify(first) === JSON.stringify(second),
          'Expected deterministic service continuity baseline pack generation.',
        );

        const profileIds = new Set(first.map((definition) => definition.profileId));
        assertCondition(
          profileIds.has('starlink-like') &&
            profileIds.has('starlink-like') &&
            profileIds.has('oneweb-like'),
          'Expected canonical profile coverage in service continuity baseline pack.',
        );

        for (const definition of first) {
          assertCondition(
            definition.requiresFullFidelity === true,
            `Expected ${definition.validationId} requiresFullFidelity=true.`,
          );
          assertCondition(
            definition.cases.length > 0,
            `Expected non-empty case list for ${definition.validationId}.`,
          );
          for (const suiteCase of definition.cases) {
            assertCondition(
              suiteCase.tickCount <= 180,
              `Expected bounded tickCount<=180 for ${definition.validationId}/${suiteCase.caseId}.`,
            );
            assertCondition(
              suiteCase.baselines.length > 0,
              `Expected non-empty baselines for ${definition.validationId}/${suiteCase.caseId}.`,
            );
          }
        }
      },
    },
    {
      name: 'integration: service continuity baseline ids are wired into validation definitions',
      kind: 'integration',
      run: () => {
        const definitions = buildValidationDefinitions();
        const byId = new Map(definitions.map((definition) => [definition.validationId, definition]));

        for (const id of EXPECTED_IDS) {
          const definition = byId.get(id);
          assertCondition(Boolean(definition), `Expected validation definition '${id}' to be present.`);
          assertCondition(
            definition?.requiresFullFidelity === true,
            `Expected ${id} requiresFullFidelity=true.`,
          );
          assertCondition(
            definition?.cases.length === EXPECTED_CASE_COUNTS[id],
            `Expected ${id} case count=${EXPECTED_CASE_COUNTS[id]}, got ${definition?.cases.length ?? 0}.`,
          );
        }
      },
    },
  ];
}
