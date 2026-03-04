import type { MutableRefObject } from 'react';
import {
  computeProfileChecksum,
  computeSourceCatalogChecksum,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { ResearchConsistencySummary } from '@/config/research-parameters/consistency';
import {
  buildBaselineComparisonChartArtifact,
  buildBaselineComparisonChartFileName,
} from '@/sim/bench/comparison-chart-artifact';
import {
  buildSmallScaleComparisonTemplateArtifact,
  buildSmallScaleComparisonTemplateFileName,
} from '@/sim/bench/small-scale-comparison-template';
import { runBaselineBatch } from '@/sim/bench/runner';
import { runCoreValidationSuite } from '@/sim/bench/validation-suite';
import { buildValidationGateSummary } from '@/sim/bench/validation-gate';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import {
  buildKpiResultArtifact,
  buildTimeseriesCsv,
  downloadTextArtifact,
} from '@/sim/kpi/reporter';
import { buildRunManifest } from '@/sim/reporting/manifest';
import {
  createSourceTraceArtifact,
  createSourceTraceDownload,
} from '@/sim/reporting/source-trace';
import type { SimEngine } from '@/sim/engine';
import type { SimSnapshot } from '@/sim/types';
import type {
  BaselineComparisonExportArtifact,
  KpiExportArtifact,
  RunBundleExportArtifact,
  ValidationSuiteExportArtifact,
} from './useSimulation.types';
import { isRuntimeBaseline } from './useSimulation.types';

interface SimulationSetupForExport {
  profile: PaperProfile;
  scenario: {
    id: string;
  };
  engine: SimEngine;
  resolvedAssumptionIds: string[];
}

interface SimulationExporterDeps {
  setup: SimulationSetupForExport;
  profileId: CanonicalProfileId;
  baseline: RuntimeBaseline;
  seed: number;
  runtimeOverrides: DeepPartial<PaperProfile>;
  researchConsistency: ResearchConsistencySummary | null;
  historyRef: MutableRefObject<SimSnapshot[]>;
}

export interface SimulationExporters {
  exportSourceTrace: () => Promise<ReturnType<typeof createSourceTraceArtifact> extends Promise<infer T> ? T : never>;
  exportKpiReport: () => KpiExportArtifact;
  exportBaselineComparison: () => BaselineComparisonExportArtifact;
  exportValidationSuite: () => ValidationSuiteExportArtifact;
  exportRunBundle: () => Promise<RunBundleExportArtifact>;
}

function buildResearchConsistencyNote(value: ResearchConsistencySummary | null): string | null {
  if (!value) {
    return null;
  }
  const codes = value.issueCodes.slice(0, 5).join(', ');
  return codes.length > 0
    ? `research consistency mode=${value.mode}; issues=${value.issueCount}; codes=${codes}`
    : `research consistency mode=${value.mode}; issues=0`;
}

export function createSimulationExporters(deps: SimulationExporterDeps): SimulationExporters {
  const {
    setup,
    profileId,
    baseline,
    seed,
    runtimeOverrides,
    researchConsistency,
    historyRef,
  } = deps;

  const exportSourceTrace = async () => {
    const latestSnapshot = setup.engine.getSnapshot();
    const assumptionMode =
      setup.profile.mode === 'real-trace'
        ? setup.scenario.id.includes('sgp4-satellitejs')
          ? 'real-trace uses true SGP4 propagation via satellite.js over TLE-derived OMM fixtures (Kepler fallback kept for per-satellite robustness)'
          : 'real-trace uses Kepler fallback over TLE mean elements'
        : `paper-baseline uses synthetic trajectory model=${setup.profile.constellation.syntheticTrajectoryModel ?? 'linear-drift'}`;

    const fidelityNote =
      setup.profile.handover.algorithmFidelity === 'full'
        ? 'handover algorithm fidelity: full (research baseline path)'
        : 'handover algorithm fidelity: simplified (non-default engineering mode)';
    const consistencyNote = buildResearchConsistencyNote(researchConsistency);

    const artifact = await createSourceTraceArtifact({
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      algorithmFidelity: setup.profile.handover.algorithmFidelity,
      seed,
      playbackRate: setup.engine.getPlaybackRate(),
      runtimeOverrides,
      assumptionIds: setup.resolvedAssumptionIds,
      policyRuntime: latestSnapshot.policyRuntime ?? null,
      beamScheduler: latestSnapshot.beamScheduler ?? null,
      coupledDecisionStats: latestSnapshot.coupledDecisionStats ?? null,
      researchConsistency,
      assumptions: [assumptionMode, fidelityNote, consistencyNote].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    });

    const fileName = `source-trace_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`;
    createSourceTraceDownload(artifact, fileName);
    return artifact;
  };

  const exportKpiReport = (): KpiExportArtifact => {
    const latestSnapshot = setup.engine.getSnapshot();
    const resultArtifact = buildKpiResultArtifact(latestSnapshot, {
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      algorithmFidelity: setup.profile.handover.algorithmFidelity,
      throughputModel: setup.profile.channel.throughputModel.model,
      smallScaleModel: setup.profile.channel.smallScaleModel,
      smallScaleParams: setup.profile.channel.smallScaleParams ?? null,
      seed,
      playbackRate: setup.engine.getPlaybackRate(),
      resolvedAssumptionIds: setup.resolvedAssumptionIds,
      runtimeParameterAudit: latestSnapshot.runtimeParameterAudit ?? null,
      policyRuntime: latestSnapshot.policyRuntime ?? null,
      beamScheduler: latestSnapshot.beamScheduler ?? null,
      coupledDecisionStats: latestSnapshot.coupledDecisionStats ?? null,
    });

    const runTag = `${setup.scenario.id}_${profileId}_${seed}_${baseline}`;
    const resultFileName = `result_${runTag}.json`;
    const timeseriesFileName = `timeseries_${runTag}.csv`;
    const timeseriesCsv = buildTimeseriesCsv(historyRef.current);

    downloadTextArtifact(
      JSON.stringify(resultArtifact, null, 2),
      resultFileName,
      'application/json',
    );
    downloadTextArtifact(timeseriesCsv, timeseriesFileName, 'text/csv');

    return {
      resultArtifact,
      timeseriesCsv,
    };
  };

  const exportBaselineComparison = (): BaselineComparisonExportArtifact => {
    const configuredBaselines = setup.profile.handover.baselines.filter((candidate) =>
      isRuntimeBaseline(candidate),
    );
    const baselines = configuredBaselines.length > 0 ? configuredBaselines : [baseline];
    const tickCount = historyRef.current.length > 1 ? historyRef.current.length - 1 : 300;

    const batch = runBaselineBatch({
      profile: setup.profile,
      seed,
      baselines,
      tickCount,
    });

    const runTag = `${setup.profile.profileId}_${seed}_${batch.tickCount}ticks`;
    downloadTextArtifact(batch.summaryCsv, `comparison_${runTag}.csv`, 'text/csv');

    const summaryJson = {
      profileId: batch.profileId,
      seed: batch.seed,
      tickCount: batch.tickCount,
      generatedAtUtc: batch.generatedAtUtc,
      runs: batch.runs.map((run) => ({
        baseline: run.baseline,
        result: run.result,
      })),
    };

    downloadTextArtifact(
      JSON.stringify(summaryJson, null, 2),
      `comparison_${runTag}.json`,
      'application/json',
    );

    const chartArtifact = buildBaselineComparisonChartArtifact(batch);
    const chartFileName = buildBaselineComparisonChartFileName(batch);
    downloadTextArtifact(
      JSON.stringify(chartArtifact, null, 2),
      chartFileName,
      'application/json',
    );

    const scenarioId = batch.runs[0]?.result.metadata.scenarioId ?? setup.scenario.id;
    const smallScaleTemplateArtifact = buildSmallScaleComparisonTemplateArtifact({
      profileId,
      seed: batch.seed,
      tickCount: batch.tickCount,
      baselines,
      scenarioId,
      generatedAtUtc: batch.generatedAtUtc,
    });
    const smallScaleTemplateFileName = buildSmallScaleComparisonTemplateFileName({
      profileId,
      seed: batch.seed,
      tickCount: batch.tickCount,
    });
    downloadTextArtifact(
      JSON.stringify(smallScaleTemplateArtifact, null, 2),
      smallScaleTemplateFileName,
      'application/json',
    );

    for (const run of batch.runs) {
      downloadTextArtifact(
        run.timeseriesCsv,
        `timeseries_${setup.profile.profileId}_${seed}_${run.baseline}_batch.csv`,
        'text/csv',
      );
    }

    return {
      batch,
      chartArtifact,
      chartFileName,
      smallScaleTemplateArtifact,
      smallScaleTemplateFileName,
    };
  };

  const exportValidationSuite = (): ValidationSuiteExportArtifact => {
    const suite = runCoreValidationSuite({ seed });
    const gateSummary = buildValidationGateSummary(suite);
    const runTag = `seed-${suite.seed}_${suite.generatedAtUtc.replace(/[:.]/g, '-')}`;

    downloadTextArtifact(
      JSON.stringify(suite, null, 2),
      `validation-suite_${runTag}.json`,
      'application/json',
    );
    downloadTextArtifact(
      suite.summaryCsv,
      `validation-suite_${runTag}.csv`,
      'text/csv',
    );

    for (const result of suite.results) {
      downloadTextArtifact(
        result.batch.summaryCsv,
        `validation-${result.validationId}_${result.caseId}_${result.profileId}_${suite.seed}.csv`,
        'text/csv',
      );
    }

    downloadTextArtifact(
      JSON.stringify(gateSummary, null, 2),
      `validation-gate-summary_${runTag}.json`,
      'application/json',
    );

    return { suite, gateSummary };
  };

  const exportRunBundle = async (): Promise<RunBundleExportArtifact> => {
    const latestSnapshot = setup.engine.getSnapshot();
    const runTag = `${setup.scenario.id}_${profileId}_${seed}_${baseline}`;
    const generatedAtUtc = new Date().toISOString();

    const [profileChecksumSha256, sourceCatalogChecksumSha256] = await Promise.all([
      computeProfileChecksum(setup.profile),
      computeSourceCatalogChecksum(),
    ]);

    const validationSuite = runCoreValidationSuite({ seed });
    const validationGateSummary = buildValidationGateSummary(validationSuite);

    const sourceTrace = await createSourceTraceArtifact({
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      algorithmFidelity: setup.profile.handover.algorithmFidelity,
      seed,
      playbackRate: setup.engine.getPlaybackRate(),
      runtimeOverrides,
      assumptionIds: setup.resolvedAssumptionIds,
      policyRuntime: latestSnapshot.policyRuntime ?? null,
      beamScheduler: latestSnapshot.beamScheduler ?? null,
      coupledDecisionStats: latestSnapshot.coupledDecisionStats ?? null,
      researchConsistency,
      assumptions: [
        setup.profile.mode === 'real-trace'
          ? 'real-trace mode run bundle export'
          : 'paper-baseline mode run bundle export',
        buildResearchConsistencyNote(researchConsistency),
      ].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    });

    const resultArtifact = buildKpiResultArtifact(latestSnapshot, {
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      algorithmFidelity: setup.profile.handover.algorithmFidelity,
      throughputModel: setup.profile.channel.throughputModel.model,
      smallScaleModel: setup.profile.channel.smallScaleModel,
      smallScaleParams: setup.profile.channel.smallScaleParams ?? null,
      seed,
      playbackRate: setup.engine.getPlaybackRate(),
      resolvedAssumptionIds: setup.resolvedAssumptionIds,
      runtimeParameterAudit: latestSnapshot.runtimeParameterAudit ?? null,
      policyRuntime: latestSnapshot.policyRuntime ?? null,
      beamScheduler: latestSnapshot.beamScheduler ?? null,
      coupledDecisionStats: latestSnapshot.coupledDecisionStats ?? null,
    });
    const timeseriesCsv = buildTimeseriesCsv(historyRef.current);

    const manifest = buildRunManifest({
      scenarioId: setup.scenario.id,
      profile: setup.profile,
      baseline,
      seed,
      playbackRate: setup.engine.getPlaybackRate(),
      profileChecksumSha256,
      sourceCatalogChecksumSha256,
      generatedAtUtc,
      resolvedAssumptionIds: setup.resolvedAssumptionIds,
      policyRuntime: latestSnapshot.policyRuntime ?? null,
      beamScheduler: latestSnapshot.beamScheduler ?? null,
      coupledDecisionStats: latestSnapshot.coupledDecisionStats ?? null,
      researchConsistency,
      runtimeParameterAudit: latestSnapshot.runtimeParameterAudit ?? null,
      validationGate: {
        pass: validationGateSummary.pass,
        totalCases: validationGateSummary.totalCases,
        failedCases: validationGateSummary.failedCases,
      },
    });

    downloadTextArtifact(
      JSON.stringify(manifest, null, 2),
      `manifest_${runTag}.json`,
      'application/json',
    );
    downloadTextArtifact(
      JSON.stringify(setup.profile, null, 2),
      `resolved-profile_${runTag}.json`,
      'application/json',
    );
    downloadTextArtifact(
      JSON.stringify(sourceTrace, null, 2),
      `source-trace_${runTag}.json`,
      'application/json',
    );
    downloadTextArtifact(
      JSON.stringify(resultArtifact, null, 2),
      `kpi-summary_${runTag}.json`,
      'application/json',
    );
    if (latestSnapshot.runtimeParameterAudit) {
      downloadTextArtifact(
        JSON.stringify(latestSnapshot.runtimeParameterAudit, null, 2),
        `parameter-audit_${runTag}.json`,
        'application/json',
      );
    }
    downloadTextArtifact(timeseriesCsv, `timeseries_${runTag}.csv`, 'text/csv');
    downloadTextArtifact(
      JSON.stringify(validationGateSummary, null, 2),
      `validation-gate-summary_${runTag}.json`,
      'application/json',
    );

    return {
      manifest,
      sourceTrace,
      resultArtifact,
      resolvedProfile: setup.profile,
      timeseriesCsv,
      validationGateSummary,
      runtimeParameterAudit: latestSnapshot.runtimeParameterAudit ?? null,
    };
  };

  return {
    exportSourceTrace,
    exportKpiReport,
    exportBaselineComparison,
    exportValidationSuite,
    exportRunBundle,
  };
}
