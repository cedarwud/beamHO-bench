import type { AlgorithmFidelity, ProfileMode } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-rl-plugin-sdd.md
 * - PAP-2024-MADRL-CORE
 * - PAP-2025-DAPS-CORE
 *
 * Notes:
 * - This file defines the RL policy contract and traceability metadata surface.
 */

export type PolicyMode = 'off' | 'on';

export type PolicyDecisionType =
  | 'hold'
  | 'ho_execute'
  | 'ho_prepare'
  | 'dual_link_add'
  | 'dual_link_release';

export interface PolicyMetadata {
  policyId: string;
  policyVersion: string;
  checkpointHash: string;
  stateFeatureSourceMap: Record<string, string[]>;
  rewardSourceIds: string[];
}

export interface PolicyRuntimeMetadata {
  mode: ProfileMode;
  profileId: string;
  seed: number;
  algorithmFidelity: AlgorithmFidelity;
}

export interface PolicyCandidateSummary {
  satId: number;
  beamId: number;
  rsrpDbm: number;
  sinrDb: number;
  elevationDeg: number;
  remainingVisibilitySec: number;
}

export interface PolicyObservation {
  tick: number;
  timeSec: number;
  ueId: number;
  hoState: 1 | 2 | 3;
  servingSatId: number | null;
  servingBeamId: number | null;
  secondarySatId: number | null;
  secondaryBeamId: number | null;
  preparedSatId: number | null;
  preparedBeamId: number | null;
  candidates: PolicyCandidateSummary[];
  schedulerFlags: {
    prepared: boolean;
    dualLinkCapable: boolean;
  };
  runtime: PolicyRuntimeMetadata;
}

export interface PolicyAction {
  decisionType: PolicyDecisionType;
  targetSatId?: number | null;
  targetBeamId?: number | null;
  reasonCode: string;
  confidence?: number;
}

export interface PolicyTransition {
  observation: PolicyObservation;
  action: PolicyAction;
  accepted: boolean;
  rejectionReason: string | null;
}

export interface PolicyInitContext {
  scenarioId: string;
  profileId: string;
  seed: number;
  mode: ProfileMode;
  algorithmFidelity: AlgorithmFidelity;
}

export interface PolicyPlugin {
  metadata: PolicyMetadata;
  init: (context: PolicyInitContext) => void | Promise<void>;
  observe: (observation: PolicyObservation) => void | Promise<void>;
  act: (observation: PolicyObservation) => PolicyAction | Promise<PolicyAction>;
  update?: (transition: PolicyTransition) => void | Promise<void>;
  reset: () => void | Promise<void>;
}

export interface PolicyRuntimeSnapshot {
  policyMode: PolicyMode;
  policyId: string | null;
  policyVersion: string | null;
  checkpointHash: string | null;
  runtimeConfigHash: string;
  decisionCount: number;
  rejectionCount: number;
  rejectionReasons: Record<string, number>;
  stateFeatureSourceMap: Record<string, string[]>;
  rewardSourceIds: string[];
}
