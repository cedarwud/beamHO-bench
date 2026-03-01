import type { ValidationSuiteDefinition } from './validation-types';

export function buildValidationDefinitions(): ValidationSuiteDefinition[] {
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
    {
      validationId: 'VAL-BG-BEAM-COUNT-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      // Source: sdd/pending/beamHO-bench-baseline-generalization-sdd.md (BG-5)
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
