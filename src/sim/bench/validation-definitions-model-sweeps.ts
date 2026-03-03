import type { ValidationSuiteDefinition } from './validation-types';

export function buildModelSweepValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-SMALL-SCALE-MODEL-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        { model: 'none' as const },
        { model: 'shadowed-rician' as const },
        { model: 'loo' as const },
      ].map(({ model }) => ({
        caseId: `small-scale-${model}`,
        baselines: ['max-rsrp'],
        tickCount: 90,
        runtimeOverrides: {
          channel: {
            smallScaleModel: model,
          },
        },
      })),
    },
    {
      validationId: 'VAL-BG-BEAM-COUNT-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      // Source: sdd/completed/beamHO-bench-baseline-generalization-sdd.md (BG-5)
      // Sweep profile-driven beam counts (7/16/50) under fixed seed/scenario for comparability.
      cases: [
        { beamCount: 7, beamLayout: 'hex-7' as const },
        { beamCount: 16, beamLayout: 'hex-16' as const },
        { beamCount: 50, beamLayout: 'hex-50' as const },
      ].map(({ beamCount, beamLayout }) => ({
        caseId: `beam-count-${beamCount}`,
        baselines: ['max-rsrp'],
        tickCount: 90,
        runtimeOverrides: {
          beam: {
            beamsPerSatellite: beamCount,
            layout: beamLayout,
          },
        },
      })),
    },
  ];
}
