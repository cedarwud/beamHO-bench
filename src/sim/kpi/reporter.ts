import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { KpiResult, SimSnapshot } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2025-TIMERCHO-CORE
 */

export interface RunMetadata {
  scenarioId: string;
  profileId: string;
  baseline: RuntimeBaseline;
  seed: number;
  generatedAtUtc: string;
}

export interface ResultSummary {
  tick: number;
  timeSec: number;
  ueCount: number;
  satelliteCount: number;
  kpi: KpiResult;
}

export interface KpiResultArtifact {
  metadata: RunMetadata;
  summary: ResultSummary;
}

function cloneKpi(kpi: KpiResult): KpiResult {
  return {
    throughput: kpi.throughput,
    handoverRate: kpi.handoverRate,
    hof: {
      state2: kpi.hof.state2,
      state3: kpi.hof.state3,
    },
    rlf: {
      state1: kpi.rlf.state1,
      state2: kpi.rlf.state2,
    },
    uho: kpi.uho,
    hopp: kpi.hopp,
    avgDlSinr: kpi.avgDlSinr,
    jainFairness: kpi.jainFairness,
  };
}

export function buildKpiResultArtifact(
  snapshot: SimSnapshot,
  metadata: Omit<RunMetadata, 'generatedAtUtc'>,
): KpiResultArtifact {
  return {
    metadata: {
      ...metadata,
      generatedAtUtc: new Date().toISOString(),
    },
    summary: {
      tick: snapshot.tick,
      timeSec: snapshot.timeSec,
      ueCount: snapshot.ues.length,
      satelliteCount: snapshot.satellites.length,
      kpi: cloneKpi(snapshot.kpiCumulative),
    },
  };
}

export function buildTimeseriesCsv(snapshots: SimSnapshot[]): string {
  const lines = [
    [
      'tick',
      'time_sec',
      'avg_dl_sinr_db',
      'throughput_mbps',
      'handover_rate',
      'jain_fairness',
      'rlf_state1',
      'rlf_state2',
      'hof_state2',
      'hof_state3',
      'uho',
      'hopp',
      'ho_events',
    ].join(','),
  ];

  for (const snapshot of snapshots) {
    lines.push(
      [
        snapshot.tick,
        snapshot.timeSec.toFixed(3),
        snapshot.kpiCumulative.avgDlSinr.toFixed(6),
        snapshot.kpiCumulative.throughput.toFixed(6),
        snapshot.kpiCumulative.handoverRate.toFixed(6),
        snapshot.kpiCumulative.jainFairness.toFixed(6),
        snapshot.kpiCumulative.rlf.state1,
        snapshot.kpiCumulative.rlf.state2,
        snapshot.kpiCumulative.hof.state2,
        snapshot.kpiCumulative.hof.state3,
        snapshot.kpiCumulative.uho.toFixed(6),
        snapshot.kpiCumulative.hopp.toFixed(6),
        snapshot.hoEvents.length,
      ].join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function downloadTextArtifact(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
