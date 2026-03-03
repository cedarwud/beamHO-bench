import type { DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { ValidationSuiteCaseDefinition, ValidationSuiteDefinition } from './validation-types';

/**
 * Provenance:
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-DAPS-CORE
 * - STD-3GPP-TS38.331-RRC
 * - STD-3GPP-TS38.321-MAC
 * - STD-3GPP-TS38.322-RLC
 *
 * Notes:
 * - This module adds a bounded, paper-agnostic continuity-focused validation pack.
 * - Cases remain deterministic and CI-safe (`tickCount <= 180`).
 */

function toCaseDefinition(input: {
  caseId: string;
  baselines: RuntimeBaseline[];
  tickCount: number;
  runtimeOverrides?: DeepPartial<PaperProfile>;
}): ValidationSuiteCaseDefinition {
  return {
    caseId: input.caseId,
    baselines: input.baselines,
    tickCount: input.tickCount,
    runtimeOverrides: input.runtimeOverrides,
  };
}

function buildStarlinkSeamlessCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'scb-starlink-low-mobility',
      baselines: ['cho', 'mc-ho'],
      tickCount: 140,
      runtimeOverrides: {
        ue: {
          speedKmphOptions: [3],
        },
        beam: {
          overlapRatio: 0.2,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-starlink-medium-mobility',
      baselines: ['cho', 'mc-ho'],
      tickCount: 140,
      runtimeOverrides: {
        ue: {
          speedKmphOptions: [30],
        },
        beam: {
          overlapRatio: 0.25,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-starlink-high-mobility',
      baselines: ['cho', 'mc-ho'],
      tickCount: 140,
      runtimeOverrides: {
        ue: {
          speedKmphOptions: [60],
        },
        beam: {
          overlapRatio: 0.3,
        },
      },
    }),
  ];
}

function buildOnewebDapsTimingCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'scb-oneweb-daps-conservative',
      baselines: ['cho', 'mc-ho'],
      tickCount: 150,
      runtimeOverrides: {
        handover: {
          params: {
            mtsSec: 1.5,
            timerAlphaOptions: [0.9],
          },
        },
        rlfStateMachine: {
          qOutDb: -8.5,
          qInDb: -6,
          t310Ms: 1200,
          n310: 2,
          n311: 2,
          l3FilterK: 4,
          harqMaxRetx: 8,
          rlcMaxRetx: 4,
          preambleMsg3MaxRetx: 5,
          raResponseTimerSubframes: 6,
          contentionResolutionTimerSubframes: 48,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-oneweb-daps-balanced',
      baselines: ['cho', 'mc-ho'],
      tickCount: 150,
      runtimeOverrides: {
        handover: {
          params: {
            mtsSec: 1,
            timerAlphaOptions: [0.85],
          },
        },
        rlfStateMachine: {
          qOutDb: -8,
          qInDb: -6,
          t310Ms: 1000,
          n310: 1,
          n311: 1,
          l3FilterK: 4,
          harqMaxRetx: 7,
          rlcMaxRetx: 3,
          preambleMsg3MaxRetx: 4,
          raResponseTimerSubframes: 5,
          contentionResolutionTimerSubframes: 40,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-oneweb-daps-fast',
      baselines: ['cho', 'mc-ho'],
      tickCount: 150,
      runtimeOverrides: {
        handover: {
          params: {
            mtsSec: 0.5,
            timerAlphaOptions: [0.8],
          },
        },
        rlfStateMachine: {
          qOutDb: -7.5,
          qInDb: -6,
          t310Ms: 700,
          n310: 1,
          n311: 1,
          l3FilterK: 2,
          harqMaxRetx: 4,
          rlcMaxRetx: 2,
          preambleMsg3MaxRetx: 3,
          raResponseTimerSubframes: 4,
          contentionResolutionTimerSubframes: 28,
        },
      },
    }),
  ];
}

function buildCoupledSchedulerContinuityCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'scb-scheduler-uncoupled',
      baselines: ['mc-ho'],
      tickCount: 120,
      runtimeOverrides: {
        scheduler: {
          mode: 'uncoupled',
          activeWindowFraction: 0.5,
          maxActiveBeamsPerSatellite: 10,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-scheduler-coupled-balanced',
      baselines: ['mc-ho'],
      tickCount: 120,
      runtimeOverrides: {
        scheduler: {
          mode: 'coupled',
          activeWindowFraction: 0.45,
          maxActiveBeamsPerSatellite: 8,
        },
      },
    }),
    toCaseDefinition({
      caseId: 'scb-scheduler-coupled-tight',
      baselines: ['mc-ho'],
      tickCount: 120,
      runtimeOverrides: {
        scheduler: {
          mode: 'coupled',
          activeWindowFraction: 0.3,
          maxActiveBeamsPerSatellite: 6,
        },
      },
    }),
  ];
}

export function buildServiceContinuityBaselineValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-SCB-STARLINK-SEAMLESS-SWEEP',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: buildStarlinkSeamlessCases(),
    },
    {
      validationId: 'VAL-SCB-ONEWEB-DAPS-TIMING-SWEEP',
      profileId: 'oneweb-like',
      requiresFullFidelity: true,
      cases: buildOnewebDapsTimingCases(),
    },
    {
      validationId: 'VAL-SCB-COUPLED-SCHEDULER-CONTINUITY-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      trendPolicy: {
        metric: 'scheduler-overlap-blocked-count',
        direction: 'non-decreasing',
        tolerance: 0,
      },
      cases: buildCoupledSchedulerContinuityCases(),
    },
  ];
}
