import {
  buildSourceTracePayload,
  computeProfileChecksum,
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { AlgorithmFidelity, PaperProfile } from '@/config/paper-profiles/types';
import type { PolicyRuntimeSnapshot } from '@/sim/policy/types';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { CoupledDecisionStats } from '@/sim/scheduler/types';
import type { ResearchConsistencySummary } from '@/config/research-parameters/consistency';

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
  throughput_model: 'shannon' | 'mcs-mapped';
  small_scale_model: PaperProfile['channel']['smallScaleModel'];
  small_scale_params: {
    shadowed_rician?: {
      k_factor_min_db: number;
      k_factor_max_db: number;
      shadowing_std_dev_db: number;
      multipath_std_dev_db: number;
    };
    loo?: {
      shadowing_std_dev_db: number;
      rayleigh_scale_db: number;
    };
    temporal_correlation?: {
      enabled: boolean;
      coefficient: number;
    };
    doppler_aware?: {
      enabled: boolean;
      velocity_scale: number;
      speed_of_light_mps: number;
    };
  } | null;
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
  scheduler_mode: 'uncoupled' | 'coupled';
  scheduler_window_id: number;
  scheduler_utilization_ratio: number;
  scheduler_fairness_index: number;
  scheduler_state_hash: string;
  scheduler_blocked_handover_count: number;
  scheduler_induced_interruption_sec: number;
  scheduler_blocked_reasons: Record<string, number>;
  research_consistency: {
    mode: 'strict' | 'exploratory';
    issue_count: number;
    issue_codes: string[];
    issues: Array<{
      rule_id: string;
      message_code: string;
      severity: 'info' | 'warn' | 'error';
      parameter_ids: string[];
    }>;
  } | null;
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
  beamScheduler?: BeamSchedulerSnapshot | null;
  coupledDecisionStats?: CoupledDecisionStats | null;
  researchConsistency?: ResearchConsistencySummary | null;
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

function cloneBeamSchedulerSummary(
  scheduler: BeamSchedulerSnapshot | null | undefined,
): {
  mode: 'uncoupled' | 'coupled';
  windowId: number;
  utilizationRatio: number;
  fairnessIndex: number;
  scheduleStateHash: string;
} {
  if (!scheduler) {
    return {
      mode: 'uncoupled',
      windowId: 0,
      utilizationRatio: 0,
      fairnessIndex: 1,
      scheduleStateHash: 'scheduler-none',
    };
  }

  return {
    mode: scheduler.summary.mode,
    windowId: scheduler.summary.windowId,
    utilizationRatio: scheduler.summary.utilizationRatio,
    fairnessIndex: scheduler.summary.fairnessIndex,
    scheduleStateHash: scheduler.summary.scheduleStateHash,
  };
}

function cloneCoupledDecisionStats(
  value: CoupledDecisionStats | null | undefined,
): CoupledDecisionStats {
  if (!value) {
    return {
      mode: 'uncoupled',
      blockedByScheduleHandoverCount: 0,
      schedulerInducedInterruptionSec: 0,
      blockedReasons: {},
    };
  }

  return {
    mode: value.mode,
    blockedByScheduleHandoverCount: value.blockedByScheduleHandoverCount,
    schedulerInducedInterruptionSec: value.schedulerInducedInterruptionSec,
    blockedReasons: Object.fromEntries(
      Object.entries(value.blockedReasons).sort((left, right) =>
        left[0].localeCompare(right[0]),
      ),
    ),
  };
}

function cloneResearchConsistency(
  value: ResearchConsistencySummary | null | undefined,
): SourceTraceArtifact['research_consistency'] {
  if (!value) {
    return null;
  }
  return {
    mode: value.mode,
    issue_count: value.issueCount,
    issue_codes: [...value.issueCodes].sort(),
    issues: value.issues
      .map((issue) => ({
        rule_id: issue.ruleId,
        message_code: issue.messageCode,
        severity: issue.severity,
        parameter_ids: [...issue.parameterIds].sort(),
      }))
      .sort((left, right) => {
        if (left.rule_id !== right.rule_id) {
          return left.rule_id.localeCompare(right.rule_id);
        }
        if (left.message_code !== right.message_code) {
          return left.message_code.localeCompare(right.message_code);
        }
        return left.severity.localeCompare(right.severity);
      }),
  };
}

function cloneSmallScaleParams(
  value: PaperProfile['channel']['smallScaleParams'] | null | undefined,
): SourceTraceArtifact['small_scale_params'] {
  if (!value) {
    return null;
  }

  return {
    shadowed_rician: value.shadowedRician
      ? {
          k_factor_min_db: value.shadowedRician.kFactorMinDb,
          k_factor_max_db: value.shadowedRician.kFactorMaxDb,
          shadowing_std_dev_db: value.shadowedRician.shadowingStdDevDb,
          multipath_std_dev_db: value.shadowedRician.multipathStdDevDb,
        }
      : undefined,
    loo: value.loo
      ? {
          shadowing_std_dev_db: value.loo.shadowingStdDevDb,
          rayleigh_scale_db: value.loo.rayleighScaleDb,
        }
      : undefined,
    temporal_correlation: value.temporalCorrelation
      ? {
          enabled: value.temporalCorrelation.enabled,
          coefficient: value.temporalCorrelation.coefficient,
        }
      : undefined,
    doppler_aware: value.dopplerAware
      ? {
          enabled: value.dopplerAware.enabled,
          velocity_scale: value.dopplerAware.velocityScale,
          speed_of_light_mps: value.dopplerAware.speedOfLightMps,
        }
      : undefined,
  };
}

export async function createSourceTraceArtifact(
  options: SourceTraceOptions,
): Promise<SourceTraceArtifact> {
  const runtimeOverrides = options.runtimeOverrides ?? {};
  const explicitAssumptionIds = options.assumptionIds ?? [];
  const assumptions = options.assumptions ?? [];
  const policyRuntime = clonePolicyRuntime(options.policyRuntime);
  const beamScheduler = cloneBeamSchedulerSummary(options.beamScheduler);
  const coupledDecisionStats = cloneCoupledDecisionStats(options.coupledDecisionStats);
  const researchConsistency = cloneResearchConsistency(options.researchConsistency);

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
    throughput_model: profile.channel.throughputModel.model,
    small_scale_model: profile.channel.smallScaleModel,
    small_scale_params: cloneSmallScaleParams(profile.channel.smallScaleParams),
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
    scheduler_mode: beamScheduler.mode,
    scheduler_window_id: beamScheduler.windowId,
    scheduler_utilization_ratio: beamScheduler.utilizationRatio,
    scheduler_fairness_index: beamScheduler.fairnessIndex,
    scheduler_state_hash: beamScheduler.scheduleStateHash,
    scheduler_blocked_handover_count:
      coupledDecisionStats.blockedByScheduleHandoverCount,
    scheduler_induced_interruption_sec:
      coupledDecisionStats.schedulerInducedInterruptionSec,
    scheduler_blocked_reasons: coupledDecisionStats.blockedReasons,
    research_consistency: researchConsistency,
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
