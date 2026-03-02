import type { PaperProfile } from '@/config/paper-profiles/types';
import starlinkFixtureJson from '@/data/tle/starlink-sample.json';
import onewebFixtureJson from '@/data/tle/oneweb-sample.json';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { RuntimeParameterAuditSnapshot } from '@/sim/audit/runtime-parameter-audit';
import type { PolicyRuntimeSnapshot } from '@/sim/policy/types';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { CoupledDecisionStats } from '@/sim/scheduler/types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-experiment-protocol.md
 * - sdd/completed/beamHO-bench-requirements.md
 *
 * Notes:
 * - Manifest fields follow the experiment protocol's reproducibility contract.
 */

interface TleFixtureMeta {
  generatedAtUtc: string;
}

export interface RunManifest {
  scenario_id: string;
  profile_id: string;
  baseline: RuntimeBaseline;
  seed: number;
  playback_rate: number;
  git_commit: string;
  started_at_utc: string;
  finished_at_utc: string;
  engine_version: string;
  profile_checksum_sha256: string;
  profile_schema_version: string;
  mode: 'paper-baseline' | 'real-trace';
  tle_snapshot_utc?: string;
  source_catalog_checksum_sha256: string;
  algorithm_fidelity: 'full' | 'simplified';
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
  } | null;
  resolved_assumption_ids: string[];
  policy_mode: 'off' | 'on';
  policy_id?: string;
  policy_version?: string;
  checkpoint_hash?: string;
  policy_runtime_config_hash: string;
  policy_decision_count: number;
  policy_rejection_count: number;
  policy_rejection_reasons: Record<string, number>;
  scheduler_mode: 'uncoupled' | 'coupled';
  scheduler_window_id: number;
  scheduler_utilization_ratio: number;
  scheduler_fairness_index: number;
  scheduler_state_hash: string;
  scheduler_blocked_handover_count: number;
  scheduler_induced_interruption_sec: number;
  scheduler_blocked_reasons: Record<string, number>;
  validation_gate?: {
    pass: boolean;
    total_cases: number;
    failed_cases: number;
  };
  runtime_parameter_audit?: {
    pass: boolean;
    audited_tick: number;
    required_keys: number;
    touched_keys: number;
    missing_keys: string[];
  };
}

export interface RunManifestOptions {
  scenarioId: string;
  profile: PaperProfile;
  baseline: RuntimeBaseline;
  seed: number;
  playbackRate: number;
  profileChecksumSha256: string;
  sourceCatalogChecksumSha256: string;
  generatedAtUtc?: string;
  gitCommit?: string;
  engineVersion?: string;
  profileSchemaVersion?: string;
  resolvedAssumptionIds?: string[];
  policyRuntime?: PolicyRuntimeSnapshot | null;
  beamScheduler?: BeamSchedulerSnapshot | null;
  coupledDecisionStats?: CoupledDecisionStats | null;
  runtimeParameterAudit?: RuntimeParameterAuditSnapshot | null;
  validationGate?: {
    pass: boolean;
    totalCases: number;
    failedCases: number;
  };
}

const STARLINK_FIXTURE = starlinkFixtureJson as TleFixtureMeta;
const ONEWEB_FIXTURE = onewebFixtureJson as TleFixtureMeta;

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
      Object.entries(resolved.stateFeatureSourceMap).map(([featureId, sourceIds]) => [
        featureId,
        [...sourceIds].sort(),
      ]),
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

function cloneSmallScaleParams(
  value: PaperProfile['channel']['smallScaleParams'] | null | undefined,
): RunManifest['small_scale_params'] {
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
  };
}

function resolveTleSnapshotUtc(profile: PaperProfile): string | undefined {
  if (profile.mode !== 'real-trace') {
    return undefined;
  }

  const provider = profile.constellation.tle?.provider;
  if (provider === 'oneweb') {
    return ONEWEB_FIXTURE.generatedAtUtc;
  }
  if (provider === 'starlink') {
    return STARLINK_FIXTURE.generatedAtUtc;
  }
  return undefined;
}

export function buildRunManifest(options: RunManifestOptions): RunManifest {
  const generatedAtUtc = options.generatedAtUtc ?? new Date().toISOString();
  const policyRuntime = clonePolicyRuntime(options.policyRuntime);
  const beamScheduler = cloneBeamSchedulerSummary(options.beamScheduler);
  const coupledDecisionStats = cloneCoupledDecisionStats(options.coupledDecisionStats);

  const manifest: RunManifest = {
    scenario_id: options.scenarioId,
    profile_id: options.profile.profileId,
    baseline: options.baseline,
    seed: options.seed,
    playback_rate: options.playbackRate,
    git_commit: options.gitCommit ?? 'unknown',
    started_at_utc: generatedAtUtc,
    finished_at_utc: generatedAtUtc,
    engine_version: options.engineVersion ?? 'beamho-bench-v1',
    profile_checksum_sha256: options.profileChecksumSha256,
    profile_schema_version:
      options.profileSchemaVersion ?? 'paper-profile.schema.json@draft-2020-12',
    mode: options.profile.mode,
    source_catalog_checksum_sha256: options.sourceCatalogChecksumSha256,
    algorithm_fidelity: options.profile.handover.algorithmFidelity,
    throughput_model: options.profile.channel.throughputModel.model,
    small_scale_model: options.profile.channel.smallScaleModel,
    small_scale_params: cloneSmallScaleParams(options.profile.channel.smallScaleParams),
    resolved_assumption_ids: [...(options.resolvedAssumptionIds ?? [])].sort(),
    policy_mode: policyRuntime.policyMode,
    policy_runtime_config_hash: policyRuntime.runtimeConfigHash,
    policy_decision_count: policyRuntime.decisionCount,
    policy_rejection_count: policyRuntime.rejectionCount,
    policy_rejection_reasons: policyRuntime.rejectionReasons,
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
  };

  if (
    policyRuntime.policyMode === 'on' &&
    policyRuntime.policyId &&
    policyRuntime.policyVersion &&
    policyRuntime.checkpointHash
  ) {
    manifest.policy_id = policyRuntime.policyId;
    manifest.policy_version = policyRuntime.policyVersion;
    manifest.checkpoint_hash = policyRuntime.checkpointHash;
  }

  const tleSnapshotUtc = resolveTleSnapshotUtc(options.profile);
  if (tleSnapshotUtc) {
    manifest.tle_snapshot_utc = tleSnapshotUtc;
  }

  if (options.validationGate) {
    manifest.validation_gate = {
      pass: options.validationGate.pass,
      total_cases: options.validationGate.totalCases,
      failed_cases: options.validationGate.failedCases,
    };
  }

  if (options.runtimeParameterAudit) {
    manifest.runtime_parameter_audit = {
      pass: options.runtimeParameterAudit.pass,
      audited_tick: options.runtimeParameterAudit.tick,
      required_keys: options.runtimeParameterAudit.requiredKeys.length,
      touched_keys: options.runtimeParameterAudit.touchedKeys.length,
      missing_keys: [...options.runtimeParameterAudit.missingKeys],
    };
  }

  return manifest;
}
