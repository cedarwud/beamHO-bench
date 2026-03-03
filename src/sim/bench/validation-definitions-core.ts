import type { ValidationSuiteDefinition } from './validation-types';

export function buildCoreValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-A4-THRESH-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [-100, -101, -102].map((threshold) => ({
        caseId: `a4-threshold-${threshold}`,
        baselines: ['a4'],
        tickCount: 180,
        runtimeOverrides: {
          handover: {
            params: {
              a4ThresholdDbm: threshold,
            },
          },
        },
      })),
    },
    {
      validationId: 'VAL-A3-TTT-HOM-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      trendPolicy: {
        metric: 'handover-rate',
        direction: 'non-increasing',
      },
      cases: [
        {
          caseId: 'a3-ttt0-hom2',
          baselines: ['a3'],
          tickCount: 180,
          runtimeOverrides: {
            handover: {
              params: {
                a3TttMs: 0,
                homDb: 2,
              },
            },
          },
        },
        {
          caseId: 'a3-ttt200-hom2',
          baselines: ['a3'],
          tickCount: 180,
          runtimeOverrides: {
            handover: {
              params: {
                a3TttMs: 200,
                homDb: 2,
              },
            },
          },
        },
        {
          caseId: 'a3-ttt200-hom3',
          baselines: ['a3'],
          tickCount: 180,
          runtimeOverrides: {
            handover: {
              params: {
                a3TttMs: 200,
                homDb: 3,
              },
            },
          },
        },
      ],
    },
    {
      validationId: 'VAL-TIMER-ALPHA-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      trendPolicy: {
        metric: 'hopp',
        direction: 'non-increasing',
      },
      cases: [0.8, 0.85, 0.9].map((alpha) => ({
        caseId: `timer-alpha-${alpha}`,
        baselines: ['cho'],
        tickCount: 180,
        runtimeOverrides: {
          handover: {
            params: {
              timerAlphaOptions: [alpha],
            },
          },
        },
      })),
    },
    {
      validationId: 'VAL-MC-OVERLAP-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [0.15, 0.25, 0.35].map((overlapRatio) => ({
        caseId: `mc-overlap-${overlapRatio}`,
        baselines: ['mc-ho'],
        tickCount: 180,
        runtimeOverrides: {
          beam: {
            overlapRatio,
          },
        },
      })),
    },
    {
      validationId: 'VAL-STARLINK-TRACE-SMOKE',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'starlink-max-rsrp-smoke',
          baselines: ['max-rsrp'],
          tickCount: 60,
        },
      ],
    },
    {
      validationId: 'VAL-ONEWEB-TRACE-SMOKE',
      profileId: 'oneweb-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'oneweb-max-rsrp-smoke',
          baselines: ['max-rsrp'],
          tickCount: 60,
        },
      ],
    },
    {
      validationId: 'VAL-REALTRACE-MULTI-BASELINE-SMOKE',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'starlink-multi-baseline-smoke',
          baselines: ['max-rsrp', 'max-elevation', 'max-remaining-time'],
          tickCount: 60,
        },
      ],
    },
    {
      validationId: 'VAL-ONEWEB-MULTI-BASELINE-SMOKE',
      profileId: 'oneweb-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'oneweb-multi-baseline-smoke',
          baselines: ['max-rsrp', 'max-elevation', 'max-remaining-time'],
          tickCount: 60,
        },
      ],
    },
    {
      validationId: 'VAL-CHO-MCHO-FULLMODE-SMOKE',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'cho-mcho-fullmode',
          baselines: ['cho', 'mc-ho'],
          tickCount: 180,
        },
      ],
    },
  ];
}
