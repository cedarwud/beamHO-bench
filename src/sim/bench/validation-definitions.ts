import type { ValidationSuiteDefinition } from './validation-types';
import { buildCommonBaselineV2ValidationDefinitions } from './common-baseline-pack';
import { buildCoreValidationDefinitions } from './validation-definitions-core';
import { buildModelSweepValidationDefinitions } from './validation-definitions-model-sweeps';
import { buildPolicyAndSchedulerValidationDefinitions } from './validation-definitions-policy-scheduler';

export function buildValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    ...buildCoreValidationDefinitions(),
    ...buildPolicyAndSchedulerValidationDefinitions(),
    ...buildModelSweepValidationDefinitions(),
    ...buildCommonBaselineV2ValidationDefinitions(),
  ];
}
