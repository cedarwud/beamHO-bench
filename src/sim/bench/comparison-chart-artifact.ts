import type { BaselineBatchResult } from './runner';

export interface BaselineComparisonChartMetric {
  id:
    | 'throughput_mbps'
    | 'avg_dl_sinr_db'
    | 'handover_rate'
    | 'jain_fairness'
    | 'rlf_total'
    | 'hof_total';
  label: string;
  higherIsBetter: boolean;
}

export interface BaselineComparisonChartRow {
  baseline: string;
  throughput_mbps: number;
  avg_dl_sinr_db: number;
  handover_rate: number;
  jain_fairness: number;
  rlf_total: number;
  hof_total: number;
}

export interface BaselineComparisonChartArtifact {
  artifactType: 'baseline-comparison-chart';
  schemaVersion: '1.0.0';
  generatedAtUtc: string;
  metadata: {
    scenarioId: string;
    profileId: string;
    seed: number;
    tickCount: number;
    runCount: number;
    xField: 'baseline';
  };
  metrics: BaselineComparisonChartMetric[];
  rows: BaselineComparisonChartRow[];
}

const CHART_METRICS: BaselineComparisonChartMetric[] = [
  { id: 'throughput_mbps', label: 'Throughput (Mbps)', higherIsBetter: true },
  { id: 'avg_dl_sinr_db', label: 'Average DL SINR (dB)', higherIsBetter: true },
  { id: 'handover_rate', label: 'Handover Rate', higherIsBetter: false },
  { id: 'jain_fairness', label: "Jain's Fairness", higherIsBetter: true },
  { id: 'rlf_total', label: 'RLF Total', higherIsBetter: false },
  { id: 'hof_total', label: 'HOF Total', higherIsBetter: false },
];

function resolveScenarioId(batch: BaselineBatchResult): string {
  const firstScenario = batch.runs[0]?.result.metadata.scenarioId ?? 'unknown-scenario';
  const sameScenario = batch.runs.every(
    (run) => run.result.metadata.scenarioId === firstScenario,
  );
  return sameScenario ? firstScenario : 'mixed-scenarios';
}

export function buildBaselineComparisonChartFileName(batch: BaselineBatchResult): string {
  const profileTag = batch.profileId.replace(/\s+/g, '-');
  return `comparison-chart_${profileTag}_seed-${batch.seed}_ticks-${batch.tickCount}.json`;
}

export function buildBaselineComparisonChartArtifact(
  batch: BaselineBatchResult,
): BaselineComparisonChartArtifact {
  // Source: sdd/completed/implemented-specs/beamHO-bench-gap-closure-sdd.md §3.4
  // Export a dedicated chart artifact with metadata-rich context for reproducible plotting.
  return {
    artifactType: 'baseline-comparison-chart',
    schemaVersion: '1.0.0',
    generatedAtUtc: batch.generatedAtUtc,
    metadata: {
      scenarioId: resolveScenarioId(batch),
      profileId: batch.profileId,
      seed: batch.seed,
      tickCount: batch.tickCount,
      runCount: batch.runs.length,
      xField: 'baseline',
    },
    metrics: CHART_METRICS,
    rows: batch.runs.map((run) => ({
      baseline: run.baseline,
      throughput_mbps: run.result.summary.kpi.throughput,
      avg_dl_sinr_db: run.result.summary.kpi.avgDlSinr,
      handover_rate: run.result.summary.kpi.handoverRate,
      jain_fairness: run.result.summary.kpi.jainFairness,
      rlf_total: run.result.summary.kpi.rlf.state1 + run.result.summary.kpi.rlf.state2,
      hof_total: run.result.summary.kpi.hof.state2 + run.result.summary.kpi.hof.state3,
    })),
  };
}
