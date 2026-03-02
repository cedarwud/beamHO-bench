import type { PolicyPlugin } from './types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-rl-plugin-sdd.md
 * - ASSUME-HANDOVER-FIDELITY-FULL
 *
 * Notes:
 * - No-op plugin is used for deterministic scaffold and adapter safety tests.
 */

export function createNoOpPolicyPlugin(): PolicyPlugin {
  return {
    metadata: {
      policyId: 'policy-noop',
      policyVersion: '1.0.0',
      checkpointHash: 'none',
      stateFeatureSourceMap: {
        tick: ['PAP-2024-MADRL-CORE'],
        serving_state: ['STD-3GPP-TS38.331-RRC'],
        candidate_link_quality: ['STD-3GPP-TR38.811-6.6.2-1'],
      },
      rewardSourceIds: ['ASSUME-HANDOVER-FIDELITY-FULL'],
    },
    init: () => undefined,
    observe: () => undefined,
    act: () => ({
      decisionType: 'hold',
      reasonCode: 'noop-hold',
    }),
    reset: () => undefined,
  };
}
