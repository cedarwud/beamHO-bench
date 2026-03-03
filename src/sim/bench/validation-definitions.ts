import type { ValidationSuiteDefinition } from './validation-types';
import { buildBaselineParameterEnvelopeValidationDefinitions } from './baseline-parameter-envelope-pack';
import { buildCommonBaselineV2ValidationDefinitions } from './common-baseline-pack';
import { buildCoreValidationDefinitions } from './validation-definitions-core';
import { buildModelSweepValidationDefinitions } from './validation-definitions-model-sweeps';
import { buildPolicyAndSchedulerValidationDefinitions } from './validation-definitions-policy-scheduler';

export function buildValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    ...buildCoreValidationDefinitions(),
    ...buildPolicyAndSchedulerValidationDefinitions(),
    ...buildModelSweepValidationDefinitions(),
    ...buildBaselineParameterEnvelopeValidationDefinitions(),
    ...buildCommonBaselineV2ValidationDefinitions(),
  ];
}
