import type { ValidationSuiteDefinition } from './validation-types';

export function buildPolicyAndSchedulerValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-RL-POLICY-OFF-PARITY',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'policy-off-parity-smoke',
          baselines: ['max-rsrp'],
          tickCount: 90,
          policyRuntime: {
            mode: 'off',
          },
        },
      ],
    },
    {
      validationId: 'VAL-RL-DETERMINISM-ON',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'policy-greedy-sinr-determinism',
          baselines: ['max-rsrp'],
          tickCount: 90,
          policyRuntime: {
            mode: 'on',
            pluginId: 'greedy-sinr',
          },
        },
      ],
    },
    {
      validationId: 'VAL-RL-INVALID-ACTION-SAFETY',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'policy-invalid-action-safety',
          baselines: ['max-rsrp'],
          tickCount: 90,
          policyRuntime: {
            mode: 'on',
            pluginId: 'invalid-action-probe',
          },
        },
      ],
    },
    {
      validationId: 'VAL-RL-REALTRACE-SMOKE',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'realtrace-policy-greedy-sinr',
          baselines: ['max-rsrp'],
          tickCount: 60,
          policyRuntime: {
            mode: 'on',
            pluginId: 'greedy-sinr',
          },
        },
      ],
    },
    {
      validationId: 'VAL-JBH-UNCOUPLED-PARITY',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'scheduler-uncoupled-parity',
          baselines: ['max-rsrp'],
          tickCount: 90,
          runtimeOverrides: {
            scheduler: {
              mode: 'uncoupled',
            },
          },
        },
      ],
    },
    {
      validationId: 'VAL-JBH-COUPLED-DETERMINISM',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'scheduler-coupled-determinism',
          baselines: ['max-rsrp'],
          tickCount: 90,
          runtimeOverrides: {
            scheduler: {
              mode: 'coupled',
            },
          },
        },
      ],
    },
    {
      validationId: 'VAL-JBH-REALTRACE-COUPLED-SMOKE',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'scheduler-realtrace-coupled-smoke',
          baselines: ['max-rsrp'],
          tickCount: 60,
          runtimeOverrides: {
            scheduler: {
              mode: 'coupled',
            },
          },
        },
      ],
    },
    {
      validationId: 'VAL-JBH-CAPACITY-GUARD-SMOKE',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: [
        {
          caseId: 'scheduler-capacity-fairness-guard',
          baselines: ['a4'],
          tickCount: 120,
          runtimeOverrides: {
            scheduler: {
              mode: 'coupled',
              activeWindowFraction: 0.2,
              maxUsersPerActiveBeam: 1,
              fairnessTargetJain: 0.6,
            },
          },
        },
      ],
    },
    {
      validationId: 'VAL-JBH-HOPPING-PERIOD-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      trendPolicy: {
        metric: 'scheduler-window-transition-count',
        direction: 'non-increasing',
      },
      cases: [2, 4, 8].map((windowPeriodSec) => ({
        caseId: `scheduler-window-period-${windowPeriodSec}`,
        baselines: ['max-rsrp'],
        tickCount: 120,
        runtimeOverrides: {
          scheduler: {
            mode: 'coupled',
            windowPeriodSec,
            activeWindowFraction: 0.35,
          },
        },
      })),
    },
    {
      validationId: 'VAL-JBH-OVERLAP-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      trendPolicy: {
        metric: 'scheduler-overlap-blocked-count',
        direction: 'non-increasing',
      },
      cases: [0.05, 0.15, 0.35].map((overlapRatio) => ({
        caseId: `scheduler-overlap-${overlapRatio}`,
        baselines: ['max-rsrp'],
        tickCount: 120,
        runtimeOverrides: {
          beam: {
            overlapRatio,
          },
          scheduler: {
            mode: 'coupled',
            activeWindowFraction: 1,
            maxUsersPerActiveBeam: 64,
            fairnessTargetJain: 0,
          },
        },
      })),
    },
  ];
}
