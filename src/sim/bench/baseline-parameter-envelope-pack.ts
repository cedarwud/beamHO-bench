import { buildBaselineParameterEnvelopeArtifact } from './baseline-parameter-envelope';
import type { ValidationSuiteCaseDefinition, ValidationSuiteDefinition } from './validation-types';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-baseline-parameter-envelope-sdd.md (D3)
 *
 * Notes:
 * - Validation cases are built from baseline-parameter envelope artifact subsets.
 * - Case count is intentionally bounded for stage-gate safety.
 */

function toValidationCase(
  matrixCaseId: string,
  runtimeOverrides: ValidationSuiteCaseDefinition['runtimeOverrides'],
): ValidationSuiteCaseDefinition {
  return {
    caseId: matrixCaseId,
    baselines: ['max-rsrp'],
    tickCount: 90,
    runtimeOverrides,
  };
}

function buildElevationSweepCases(): ValidationSuiteCaseDefinition[] {
  const artifact = buildBaselineParameterEnvelopeArtifact({
    axes: {
      profileSequence: ['case9-default'],
      minElevationDegTiers: [10, 20, 35],
      ueCountTiers: [100],
      ueSpeedKmphTiers: [30],
    },
  });
  return artifact.cases.map((suiteCase) =>
    toValidationCase(suiteCase.matrixCaseId, suiteCase.runtimeOverrides),
  );
}

function buildLoadMobilityCases(): ValidationSuiteCaseDefinition[] {
  const artifact = buildBaselineParameterEnvelopeArtifact({
    axes: {
      profileSequence: ['starlink-like'],
      minElevationDegTiers: [10],
      ueCountTiers: [50, 100],
      ueSpeedKmphTiers: [0, 60],
    },
  });
  return artifact.cases.map((suiteCase) =>
    toValidationCase(suiteCase.matrixCaseId, suiteCase.runtimeOverrides),
  );
}

function buildOnewebCoverageCase(): ValidationSuiteCaseDefinition[] {
  const artifact = buildBaselineParameterEnvelopeArtifact({
    axes: {
      profileSequence: ['oneweb-like'],
      minElevationDegTiers: [10],
      ueCountTiers: [100],
      ueSpeedKmphTiers: [30],
    },
  });
  return artifact.cases.map((suiteCase) =>
    toValidationCase(suiteCase.matrixCaseId, suiteCase.runtimeOverrides),
  );
}

export function buildBaselineParameterEnvelopeValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-BPE-ELEVATION-THRESH-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: buildElevationSweepCases(),
    },
    {
      validationId: 'VAL-BPE-LOAD-MOBILITY-SWEEP',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: buildLoadMobilityCases(),
    },
    {
      validationId: 'VAL-BPE-ONEWEB-PARAM-SMOKE',
      profileId: 'oneweb-like',
      requiresFullFidelity: true,
      cases: buildOnewebCoverageCase(),
    },
  ];
}
