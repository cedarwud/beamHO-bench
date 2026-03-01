import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  extractAssumptionIdsFromSourceMap,
  isCanonicalProfileId,
  loadProfileSourceMap,
} from '@/config/paper-profiles/loader';
import { SimEngine } from '@/sim/engine';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import {
  buildKpiResultArtifact,
  buildTimeseriesCsv,
  type KpiResultArtifact,
} from '@/sim/kpi/reporter';
import { createNoOpPolicyPlugin } from '@/sim/policy/builtin-plugins';
import type { PolicyMode, PolicyPlugin } from '@/sim/policy/types';
import { createCase9AnalyticScenario } from '@/sim/scenarios/case9-analytic';
import { createRealTraceScenario } from '@/sim/scenarios/real-trace';
import type { SimSnapshot } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 */

export interface BaselineBatchOptions {
  profile: PaperProfile;
  seed: number;
  baselines: RuntimeBaseline[];
  tickCount: number;
  scenarioId?: string;
  captureSnapshots?: boolean;
  policyRuntime?: {
    mode?: PolicyMode;
    pluginFactory?: () => PolicyPlugin;
  };
}

export interface BaselineBatchRun {
  baseline: RuntimeBaseline;
  result: KpiResultArtifact;
  timeseriesCsv: string;
  snapshots?: SimSnapshot[];
}

export interface BaselineBatchResult {
  profileId: string;
  seed: number;
  tickCount: number;
  generatedAtUtc: string;
  runs: BaselineBatchRun[];
  summaryCsv: string;
}

function clampTickCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value));
}

function normalizeBaselines(values: RuntimeBaseline[]): RuntimeBaseline[] {
  const seen = new Set<RuntimeBaseline>();
  const ordered: RuntimeBaseline[] = [];
  for (const baseline of values) {
    if (seen.has(baseline)) {
      continue;
    }
    seen.add(baseline);
    ordered.push(baseline);
  }
  return ordered;
}

function cloneSnapshot(value: SimSnapshot): SimSnapshot {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as SimSnapshot;
}

function createScenario(
  profile: PaperProfile,
  seed: number,
  baseline: RuntimeBaseline,
  scenarioId: string | undefined,
  policyRuntime: {
    mode?: PolicyMode;
    plugin?: PolicyPlugin;
  },
) {
  return profile.mode === 'real-trace'
    ? createRealTraceScenario({ profile, seed, baseline, policyRuntime, scenarioId })
    : createCase9AnalyticScenario({ profile, seed, baseline, policyRuntime, scenarioId });
}

function buildSummaryCsv(runs: BaselineBatchRun[]): string {
  const lines = [
    [
      'baseline',
      'algorithm_fidelity',
      'throughput_model',
      'runtime_parameter_audit_pass',
      'runtime_parameter_audit_missing_keys',
      'policy_mode',
      'policy_id',
      'policy_version',
      'policy_checkpoint_hash',
      'policy_runtime_config_hash',
      'policy_decision_count',
      'policy_rejection_count',
      'scheduler_mode',
      'scheduler_window_id',
      'scheduler_total_beams',
      'scheduler_active_beams',
      'scheduler_utilization_ratio',
      'scheduler_fairness_index',
      'scheduler_state_hash',
      'coupled_blocked_handover_count',
      'coupled_interruption_sec',
      'coupled_blocked_reasons',
      'playback_rate',
      'resolved_assumption_ids',
      'scenario_id',
      'tick',
      'time_sec',
      'ue_count',
      'satellite_count',
      'throughput_mbps',
      'handover_rate',
      'avg_dl_sinr_db',
      'jain_fairness',
      'rlf_state1',
      'rlf_state2',
      'hof_state2',
      'hof_state3',
      'uho',
      'hopp',
    ].join(','),
  ];

  for (const run of runs) {
    const { summary, metadata } = run.result;
    lines.push(
      [
        run.baseline,
        metadata.algorithmFidelity,
        metadata.throughputModel,
        metadata.runtimeParameterAudit?.pass ? 'PASS' : 'FAIL',
        metadata.runtimeParameterAudit?.missingKeys.join('|') ?? '',
        metadata.policyRuntime.policyMode,
        metadata.policyRuntime.policyId ?? '',
        metadata.policyRuntime.policyVersion ?? '',
        metadata.policyRuntime.checkpointHash ?? '',
        metadata.policyRuntime.runtimeConfigHash,
        metadata.policyRuntime.decisionCount,
        metadata.policyRuntime.rejectionCount,
        metadata.beamScheduler.mode,
        metadata.beamScheduler.windowId,
        metadata.beamScheduler.totalBeamCount,
        metadata.beamScheduler.activeBeamCount,
        metadata.beamScheduler.utilizationRatio.toFixed(6),
        metadata.beamScheduler.fairnessIndex.toFixed(6),
        metadata.beamScheduler.scheduleStateHash,
        metadata.coupledDecisionStats.blockedByScheduleHandoverCount,
        metadata.coupledDecisionStats.schedulerInducedInterruptionSec.toFixed(6),
        Object.entries(metadata.coupledDecisionStats.blockedReasons)
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([reason, count]) => `${reason}:${count}`)
          .join('|'),
        metadata.playbackRate.toFixed(2),
        metadata.resolvedAssumptionIds.join('|'),
        metadata.scenarioId,
        summary.tick,
        summary.timeSec.toFixed(3),
        summary.ueCount,
        summary.satelliteCount,
        summary.kpi.throughput.toFixed(6),
        summary.kpi.handoverRate.toFixed(6),
        summary.kpi.avgDlSinr.toFixed(6),
        summary.kpi.jainFairness.toFixed(6),
        summary.kpi.rlf.state1,
        summary.kpi.rlf.state2,
        summary.kpi.hof.state2,
        summary.kpi.hof.state3,
        summary.kpi.uho.toFixed(6),
        summary.kpi.hopp.toFixed(6),
      ].join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function runBaselineBatch(options: BaselineBatchOptions): BaselineBatchResult {
  const { profile, seed } = options;
  const baselines = normalizeBaselines(options.baselines);
  const tickCount = clampTickCount(options.tickCount);
  const policyMode: PolicyMode = options.policyRuntime?.mode ?? 'off';
  const resolvedAssumptionIds =
    isCanonicalProfileId(profile.profileId)
      ? extractAssumptionIdsFromSourceMap(loadProfileSourceMap(profile.profileId))
      : [];

  if (baselines.length === 0) {
    throw new Error('runBaselineBatch requires at least one baseline.');
  }

  const runs: BaselineBatchRun[] = baselines.map((baseline) => {
    const scenarioPolicyRuntime = {
      mode: policyMode,
      plugin:
        policyMode === 'on'
          ? options.policyRuntime?.pluginFactory?.() ?? createNoOpPolicyPlugin()
          : undefined,
    };
    const scenario = createScenario(
      profile,
      seed,
      baseline,
      options.scenarioId,
      scenarioPolicyRuntime,
    );
    const engine = new SimEngine({
      scenario,
      timeStepSec: profile.timeStepSec,
    });

    const history: SimSnapshot[] = [cloneSnapshot(engine.getSnapshot())];
    for (let tick = 0; tick < tickCount; tick += 1) {
      engine.step();
      history.push(cloneSnapshot(engine.getSnapshot()));
    }

    const finalSnapshot = engine.getSnapshot();
    const result = buildKpiResultArtifact(finalSnapshot, {
      scenarioId: scenario.id,
      profileId: profile.profileId,
      baseline,
      algorithmFidelity: profile.handover.algorithmFidelity,
      throughputModel: profile.channel.throughputModel.model,
      seed,
      playbackRate: 1,
      resolvedAssumptionIds,
      runtimeParameterAudit: finalSnapshot.runtimeParameterAudit ?? null,
      policyRuntime: finalSnapshot.policyRuntime ?? null,
      beamScheduler: finalSnapshot.beamScheduler ?? null,
      coupledDecisionStats: finalSnapshot.coupledDecisionStats ?? null,
    });

    return {
      baseline,
      result,
      timeseriesCsv: buildTimeseriesCsv(history),
      snapshots: options.captureSnapshots ? history : undefined,
    };
  });

  return {
    profileId: profile.profileId,
    seed,
    tickCount,
    generatedAtUtc: new Date().toISOString(),
    runs,
    summaryCsv: buildSummaryCsv(runs),
  };
}
