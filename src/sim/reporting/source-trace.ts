import {
  buildSourceTracePayload,
  computeProfileChecksum,
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { AlgorithmFidelity, PaperProfile } from '@/config/paper-profiles/types';
import type { PolicyRuntimeSnapshot } from '@/sim/policy/types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-paper-traceability.md
 * - sdd/completed/beamHO-bench-validation-matrix.md
 *
 * Notes:
 * - `resolvedParameterSources` and `resolvedAssumptionIds` are runtime traceability anchors.
 * - `algorithm_fidelity` is required in artifacts for benchmark-governance checks.
 */

export interface SourceTraceArtifact {
  scenario_id: string;
  profile_id: CanonicalProfileId;
  baseline: string;
  algorithm_fidelity: AlgorithmFidelity;
  seed: number;
  playback_rate: number;
  profile_checksum_sha256: string;
  source_catalog_checksum_sha256: string;
  resolvedParameterSources: Record<string, string[]>;
  resolvedSourceLinks: Record<string, string>;
  resolvedAssumptionIds: string[];
  policy_mode: 'off' | 'on';
  policy_id: string | null;
  policy_version: string | null;
  checkpoint_hash: string | null;
  policy_runtime_config_hash: string;
  policy_decision_count: number;
  policy_rejection_count: number;
  policy_rejection_reasons: Record<string, number>;
  policy_state_feature_sources: Record<string, string[]>;
  policy_reward_source_ids: string[];
  assumptions: string[];
}

export interface SourceTraceOptions {
  scenarioId: string;
  profileId: CanonicalProfileId;
  baseline: string;
  algorithmFidelity: AlgorithmFidelity;
  seed: number;
  playbackRate: number;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  assumptionIds?: string[];
  assumptions?: string[];
  policyRuntime?: PolicyRuntimeSnapshot | null;
}

const POLICY_OFF_RUNTIME: PolicyRuntimeSnapshot = {
  policyMode: 'off',
  policyId: null,
  policyVersion: null,
  checkpointHash: null,
  runtimeConfigHash: 'policy-off',
  decisionCount: 0,
  rejectionCount: 0,
  rejectionReasons: {},
  stateFeatureSourceMap: {},
  rewardSourceIds: [],
};

function clonePolicyRuntime(
  value: PolicyRuntimeSnapshot | null | undefined,
): PolicyRuntimeSnapshot {
  const resolved = value ?? POLICY_OFF_RUNTIME;
  return {
    policyMode: resolved.policyMode,
    policyId: resolved.policyId,
    policyVersion: resolved.policyVersion,
    checkpointHash: resolved.checkpointHash,
    runtimeConfigHash: resolved.runtimeConfigHash,
    decisionCount: resolved.decisionCount,
    rejectionCount: resolved.rejectionCount,
    rejectionReasons: Object.fromEntries(
      Object.entries(resolved.rejectionReasons).sort((left, right) =>
        left[0].localeCompare(right[0]),
      ),
    ),
    stateFeatureSourceMap: Object.fromEntries(
      Object.entries(resolved.stateFeatureSourceMap)
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([featureId, sourceIds]) => [featureId, [...sourceIds].sort()]),
    ),
    rewardSourceIds: [...resolved.rewardSourceIds].sort(),
  };
}

export async function createSourceTraceArtifact(
  options: SourceTraceOptions,
): Promise<SourceTraceArtifact> {
  const runtimeOverrides = options.runtimeOverrides ?? {};
  const explicitAssumptionIds = options.assumptionIds ?? [];
  const assumptions = options.assumptions ?? [];
  const policyRuntime = clonePolicyRuntime(options.policyRuntime);

  const profile = loadPaperProfile(options.profileId, runtimeOverrides);
  const tracePayload = await buildSourceTracePayload(options.profileId, runtimeOverrides);
  const resolvedAssumptionIds = [
    ...new Set([...tracePayload.resolvedAssumptionIds, ...explicitAssumptionIds]),
  ].sort();

  return {
    scenario_id: options.scenarioId,
    profile_id: options.profileId,
    baseline: options.baseline,
    algorithm_fidelity: options.algorithmFidelity,
    seed: options.seed,
    playback_rate: options.playbackRate,
    profile_checksum_sha256: await computeProfileChecksum(profile),
    source_catalog_checksum_sha256: tracePayload.sourceCatalogChecksumSha256,
    resolvedParameterSources: tracePayload.resolvedParameterSources,
    resolvedSourceLinks: tracePayload.resolvedSourceLinks,
    resolvedAssumptionIds,
    policy_mode: policyRuntime.policyMode,
    policy_id: policyRuntime.policyId,
    policy_version: policyRuntime.policyVersion,
    checkpoint_hash: policyRuntime.checkpointHash,
    policy_runtime_config_hash: policyRuntime.runtimeConfigHash,
    policy_decision_count: policyRuntime.decisionCount,
    policy_rejection_count: policyRuntime.rejectionCount,
    policy_rejection_reasons: policyRuntime.rejectionReasons,
    policy_state_feature_sources: policyRuntime.stateFeatureSourceMap,
    policy_reward_source_ids: policyRuntime.rewardSourceIds,
    assumptions,
  };
}

export function createSourceTraceDownload(
  artifact: SourceTraceArtifact,
  filename: string,
): void {
  const blob = new Blob([JSON.stringify(artifact, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
