import type { DeepPartial } from '@/config/paper-profiles/loader';
import type { BeamLayout, FrequencyReuse, PaperProfile } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { ValidationSuiteCaseDefinition, ValidationSuiteDefinition } from './validation-types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-DAPS-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 * - STD-3GPP-TS38.331-RRC
 * - STD-3GPP-TS38.321-MAC
 * - STD-3GPP-TS38.322-RLC
 *
 * Notes:
 * - This module defines a reusable, paper-agnostic baseline pack for common benchmark v2.
 * - Pack cases are intentionally bounded for CI/stage safety.
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

function layoutFromBeamCount(beamCount: number): BeamLayout {
  switch (beamCount) {
    case 7:
      return 'hex-7';
    case 16:
      return 'hex-16';
    case 19:
      return 'hex-19';
    case 50:
      return 'hex-50';
    default:
      return 'custom';
  }
}

function buildPropagationRealismCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'prop-none',
      baselines: ['max-rsrp'],
      tickCount: 90,
      runtimeOverrides: {
        channel: {
          smallScaleModel: 'none',
        },
      },
    }),
    toCaseDefinition({
      caseId: 'prop-shadowed-static',
      baselines: ['max-rsrp'],
      tickCount: 90,
      runtimeOverrides: {
        channel: {
          smallScaleModel: 'shadowed-rician',
          smallScaleParams: {
            temporalCorrelation: {
              enabled: false,
              coefficient: 0.85,
            },
            dopplerAware: {
              enabled: false,
              velocityScale: 1,
              speedOfLightMps: 299792458,
            },
          },
        },
      },
    }),
    toCaseDefinition({
      caseId: 'prop-shadowed-temporal',
      baselines: ['max-rsrp'],
      tickCount: 90,
      runtimeOverrides: {
        channel: {
          smallScaleModel: 'shadowed-rician',
          smallScaleParams: {
            temporalCorrelation: {
              enabled: true,
              coefficient: 0.85,
            },
            dopplerAware: {
              enabled: false,
              velocityScale: 1,
              speedOfLightMps: 299792458,
            },
          },
        },
      },
    }),
    toCaseDefinition({
      caseId: 'prop-shadowed-temporal-doppler',
      baselines: ['max-rsrp'],
      tickCount: 90,
      runtimeOverrides: {
        channel: {
          smallScaleModel: 'shadowed-rician',
          smallScaleParams: {
            temporalCorrelation: {
              enabled: true,
              coefficient: 0.85,
            },
            dopplerAware: {
              enabled: true,
              velocityScale: 1,
              speedOfLightMps: 299792458,
            },
          },
        },
      },
    }),
  ];
}

function buildProtocolSensitivityCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'protocol-default',
      baselines: ['a4', 'cho'],
      tickCount: 120,
      runtimeOverrides: {
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
      caseId: 'protocol-conservative',
      baselines: ['a4', 'cho'],
      tickCount: 120,
      runtimeOverrides: {
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
      caseId: 'protocol-aggressive',
      baselines: ['a4', 'cho'],
      tickCount: 120,
      runtimeOverrides: {
        rlfStateMachine: {
          qOutDb: -7.5,
          qInDb: -6,
          t310Ms: 600,
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

function buildChoMcGeometryCases(): ValidationSuiteCaseDefinition[] {
  return [
    toCaseDefinition({
      caseId: 'cho-mc-conservative',
      baselines: ['cho', 'mc-ho'],
      tickCount: 160,
      runtimeOverrides: {
        beam: {
          overlapRatio: 0.15,
        },
        handover: {
          params: {
            timerAlphaOptions: [0.9],
            mtsSec: 1.5,
          },
        },
      },
    }),
    toCaseDefinition({
      caseId: 'cho-mc-baseline',
      baselines: ['cho', 'mc-ho'],
      tickCount: 160,
      runtimeOverrides: {
        beam: {
          overlapRatio: 0.25,
        },
        handover: {
          params: {
            timerAlphaOptions: [0.85],
            mtsSec: 1,
          },
        },
      },
    }),
    toCaseDefinition({
      caseId: 'cho-mc-aggressive',
      baselines: ['cho', 'mc-ho'],
      tickCount: 160,
      runtimeOverrides: {
        beam: {
          overlapRatio: 0.35,
        },
        handover: {
          params: {
            timerAlphaOptions: [0.8],
            mtsSec: 0.5,
          },
        },
      },
    }),
  ];
}

function buildStressLoadCases(): ValidationSuiteCaseDefinition[] {
  const cases: Array<{
    caseId: string;
    ueCount: number;
    beamCount: number;
    reuseMode: FrequencyReuse;
  }> = [
    {
      caseId: 'stress-core-100ue-16beam-fr1',
      ueCount: 100,
      beamCount: 16,
      reuseMode: 'FR1',
    },
    {
      caseId: 'stress-dense-150ue-19beam-reuse4',
      ueCount: 150,
      beamCount: 19,
      reuseMode: 'reuse-4',
    },
    {
      caseId: 'stress-wide-200ue-50beam-fr1',
      ueCount: 200,
      beamCount: 50,
      reuseMode: 'FR1',
    },
  ];

  return cases.map((entry) =>
    toCaseDefinition({
      caseId: entry.caseId,
      baselines: ['max-rsrp'],
      tickCount: 60,
      runtimeOverrides: {
        ue: {
          count: entry.ueCount,
        },
        beam: {
          beamsPerSatellite: entry.beamCount,
          layout: layoutFromBeamCount(entry.beamCount),
          frequencyReuse: entry.reuseMode,
        },
      },
    }),
  );
}

export function buildCommonBaselineV2ValidationDefinitions(): ValidationSuiteDefinition[] {
  return [
    {
      validationId: 'VAL-CB2-PROPAGATION-REALISM-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: buildPropagationRealismCases(),
    },
    {
      validationId: 'VAL-CB2-PROTOCOL-RLF-TIMING-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: buildProtocolSensitivityCases(),
    },
    {
      validationId: 'VAL-CB2-CHO-MC-GEOMETRY-SWEEP',
      profileId: 'case9-default',
      requiresFullFidelity: true,
      cases: buildChoMcGeometryCases(),
    },
    {
      validationId: 'VAL-CB2-STRESS-LOAD-SWEEP',
      profileId: 'starlink-like',
      requiresFullFidelity: true,
      cases: buildStressLoadCases(),
    },
  ];
}
