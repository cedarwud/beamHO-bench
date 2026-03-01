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
  captureSnapshots?: boolean;
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

function createScenario(profile: PaperProfile, seed: number, baseline: RuntimeBaseline) {
  return profile.mode === 'real-trace'
    ? createRealTraceScenario({ profile, seed, baseline })
    : createCase9AnalyticScenario({ profile, seed, baseline });
}

function buildSummaryCsv(runs: BaselineBatchRun[]): string {
  const lines = [
    [
      'baseline',
      'algorithm_fidelity',
      'runtime_parameter_audit_pass',
      'runtime_parameter_audit_missing_keys',
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
        metadata.runtimeParameterAudit?.pass ? 'PASS' : 'FAIL',
        metadata.runtimeParameterAudit?.missingKeys.join('|') ?? '',
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
  const resolvedAssumptionIds =
    isCanonicalProfileId(profile.profileId)
      ? extractAssumptionIdsFromSourceMap(loadProfileSourceMap(profile.profileId))
      : [];

  if (baselines.length === 0) {
    throw new Error('runBaselineBatch requires at least one baseline.');
  }

  const runs: BaselineBatchRun[] = baselines.map((baseline) => {
    const scenario = createScenario(profile, seed, baseline);
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
      seed,
      playbackRate: 1,
      resolvedAssumptionIds,
      runtimeParameterAudit: finalSnapshot.runtimeParameterAudit ?? null,
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
