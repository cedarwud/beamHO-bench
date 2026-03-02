import type { PolicyPlugin } from './types';
import { createNoOpPolicyPlugin } from './noop-plugin';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-rl-plugin-sdd.md
 * - PAP-2024-MADRL-CORE
 *
 * Notes:
 * - Built-in plugins are deterministic fixtures for validation and CI.
 */

export { createNoOpPolicyPlugin };

export function createGreedySinrPolicyPlugin(): PolicyPlugin {
  return {
    metadata: {
      policyId: 'policy-greedy-sinr',
      policyVersion: '1.0.0',
      checkpointHash: 'fixture-greedy-sinr-v1',
      stateFeatureSourceMap: {
        candidate_sinr: ['PAP-2024-MADRL-CORE'],
        serving_state: ['STD-3GPP-TS38.331-RRC'],
      },
      rewardSourceIds: ['PAP-2024-MADRL-CORE'],
    },
    init: () => undefined,
    observe: () => undefined,
    act: (observation) => {
      const best = observation.candidates.reduce((winner, candidate) => {
        if (!winner) {
          return candidate;
        }
        if (candidate.sinrDb > winner.sinrDb) {
          return candidate;
        }
        if (candidate.sinrDb === winner.sinrDb && candidate.rsrpDbm > winner.rsrpDbm) {
          return candidate;
        }
        return winner;
      }, null as (typeof observation.candidates)[number] | null);

      if (!best) {
        return {
          decisionType: 'hold',
          reasonCode: 'greedy-sinr-no-candidate',
        };
      }

      return {
        decisionType: 'ho_execute',
        targetSatId: best.satId,
        targetBeamId: best.beamId,
        reasonCode: 'greedy-sinr-target',
      };
    },
    reset: () => undefined,
  };
}

export function createInvalidActionProbePolicyPlugin(): PolicyPlugin {
  return {
    metadata: {
      policyId: 'policy-invalid-action-probe',
      policyVersion: '1.0.0',
      checkpointHash: 'fixture-invalid-action-v1',
      stateFeatureSourceMap: {
        candidate_link_quality: ['PAP-2024-MADRL-CORE'],
      },
      rewardSourceIds: ['PAP-2024-MADRL-CORE'],
    },
    init: () => undefined,
    observe: () => undefined,
    act: () => ({
      decisionType: 'ho_execute',
      targetSatId: 999999,
      targetBeamId: 999999,
      reasonCode: 'invalid-target-probe',
    }),
    reset: () => undefined,
  };
}
