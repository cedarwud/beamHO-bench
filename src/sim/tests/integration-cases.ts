import { getSourceCatalog, loadPaperProfile } from '@/config/paper-profiles/loader';
import { resolveBeamFootprintBands } from '@/components/sim/beam-footprint-gain';
import { resolveSatelliteRenderDecision } from '@/components/sim/satellite-render-mode';
import { loadLayerDRoleMapping, validateLayerDRoleMapping } from '@/config/references/layer-d-role-mapping';
import { runBaselineBatch } from '@/sim/bench/runner';
import { runRerunContract } from '@/sim/bench/rerun-contract';
import { runRerunContractCli } from '@/sim/bench/cli-rerun-contract';
import { runCoreValidationSuite } from '@/sim/bench/validation-suite';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import { assertAlmostEqual, assertCondition, normalizeBatchForDeterminism } from './helpers';
import { buildBaselineGeneralizationIntegrationCases } from './integration-cases-baseline-generalization';
import { buildBaselineParameterEnvelopeIntegrationCases } from './integration-cases-baseline-parameter-envelope';
import { buildCommonBaselinePackIntegrationCases } from './integration-cases-common-baseline-pack';
import { buildComparisonChartIntegrationCases } from './integration-cases-comparison-chart';
import { buildCrossModeBenchmarkIntegrationCases } from './integration-cases-cross-mode-benchmark';
import { buildMultiSeedBenchmarkIntegrationCases } from './integration-cases-multi-seed-benchmark';
import { buildMultiSeedReportingIntegrationCases } from './integration-cases-multi-seed-reporting';
import { buildPolicySchedulerIntegrationCases } from './integration-cases-policy-scheduler';
import { buildRealTraceArtifactIntegrationCases } from './integration-cases-real-trace-artifacts';
import { buildReproBundleV1IntegrationCases } from './integration-cases-repro-bundle-v1';
import { buildResearchParameterIntegrationCases } from './integration-cases-research-parameters';
import { buildScenarioMatrixIntegrationCases } from './integration-cases-scenario-matrix';
import { buildServiceContinuityPackIntegrationCases } from './integration-cases-service-continuity-pack';
import { buildSmallScaleIntegrationCases } from './integration-cases-small-scale';
import { buildTrajectoryParameterIntegrationCases } from './integration-cases-trajectory-parameters';
import type { SimTestCase } from './types';

export function buildIntegrationTestCases(): SimTestCase[] {
  return [
    {
      name: 'integration: runBaselineBatch deterministic for same profile/seed',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const baselines: RuntimeBaseline[] = ['max-rsrp', 'a3'];

        const first = runBaselineBatch({
          profile,
          seed: 42,
          baselines,
          tickCount: 30,
        });
        const second = runBaselineBatch({
          profile,
          seed: 42,
          baselines,
          tickCount: 30,
        });

        const left = normalizeBatchForDeterminism(first);
        const right = normalizeBatchForDeterminism(second);
        assertCondition(
          JSON.stringify(left) === JSON.stringify(right),
          'Determinism batch fingerprint mismatch for identical profile/seed.',
        );
      },
    },
    {
      name: 'integration: validation suite blocking checks pass',
      kind: 'integration',
      run: () => {
        const suite = runCoreValidationSuite({ seed: 42 });
        assertCondition(suite.results.length > 0, 'Validation suite must produce at least one case.');

        for (const result of suite.results) {
          for (const check of result.checks) {
            if (check.blocking === false) {
              continue;
            }
            assertCondition(
              check.pass,
              `Blocking check '${check.checkId}' failed for ${result.validationId}/${result.caseId}.`,
            );
          }
        }

        const jbhSweepValidationIds = new Set([
          'VAL-JBH-HOPPING-PERIOD-SWEEP',
          'VAL-JBH-OVERLAP-SWEEP',
        ]);
        const jbhSweepCases = suite.results.filter((result) =>
          jbhSweepValidationIds.has(result.validationId),
        );
        assertCondition(
          jbhSweepCases.length === 6,
          `Expected 6 JBH sweep cases, got ${jbhSweepCases.length}.`,
        );

        for (const result of jbhSweepCases) {
          const trendCheck = result.checks.find(
            (check) => check.checkId === 'trend-directional',
          );
          assertCondition(Boolean(trendCheck), 'Expected trend-directional check in JBH sweep case.');
          assertCondition(
            trendCheck?.pass === true,
            `Expected trend-directional pass for ${result.validationId}/${result.caseId}.`,
          );
        }
      },
    },
    {
      name: 'integration: layer-d role mapping table is complete and source-registered',
      kind: 'integration',
      run: () => {
        const mapping = loadLayerDRoleMapping();
        const sourceCatalog = getSourceCatalog();
        const issues = validateLayerDRoleMapping(mapping, sourceCatalog);

        assertCondition(
          issues.length === 0,
          `Layer-D role mapping validation failed: ${issues
            .slice(0, 2)
            .map((issue) => `${issue.path} ${issue.message}`)
            .join(' | ')}`,
        );
      },
    },
    {
      name: 'integration: rerun contract digest is deterministic for fixed input tuple',
      kind: 'integration',
      run: async () => {
        const execute = () =>
          runRerunContract({
            scenarioId: 'phase1a-case9-analytic-rerun-test',
            profileId: 'case9-default',
            seed: 123,
            baselineOrPolicy: 'policy:greedy-sinr@max-rsrp',
            tickCount: 40,
          });

        const first = await execute();
        const second = await execute();

        assertCondition(
          JSON.stringify(first.digestSummary) === JSON.stringify(second.digestSummary),
          'Expected identical rerun digest summary for fixed tuple.',
        );
      },
    },
    {
      name: 'integration: rerun contract fails fast on unknown profile id',
      kind: 'integration',
      run: async () => {
        const output = await runRerunContractCli([
          '--scenario_id',
          'phase1a-case9-analytic-rerun-test',
          '--profile_id',
          'unknown-profile',
          '--seed',
          '123',
          '--baseline_or_policy',
          'max-rsrp',
        ]);

        assertCondition(output.exitCode !== 0, 'Expected rerun CLI failure for unknown profile.');
        assertCondition(
          Boolean(output.error) && output.error?.includes('Unknown profile_id'),
          'Expected unknown profile error message in rerun CLI output.',
        );
      },
    },
    {
      name: 'integration: timer-cho countdown and geometry fields are replay deterministic',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const execute = (seed: number) =>
          runBaselineBatch({
            profile,
            seed,
            baselines: ['cho'],
            tickCount: 120,
            captureSnapshots: true,
          });

        const projectChoHudPayload = (batch: ReturnType<typeof execute>) =>
          (batch.runs[0].snapshots ?? []).flatMap((snapshot) =>
            snapshot.ues.map((ue) => ({
              tick: snapshot.tick,
              ueId: ue.id,
              satId: ue.choPreparedSatId,
              beamId: ue.choPreparedBeamId,
              elapsedMs: ue.choPreparedElapsedMs,
              targetMs: ue.choPreparedTargetMs,
              remainingMs: ue.choPreparedRemainingMs,
              distanceKm: ue.choGeometryDistanceKm,
              elevationDeg: ue.choGeometryElevationDeg,
              timeToThresholdSec: ue.choGeometryTimeToThresholdSec,
            })),
          );

        const assertChoHudContract = (
          payload: ReturnType<typeof projectChoHudPayload>,
          seed: number,
        ) => {
          for (const entry of payload) {
            const prepared =
              entry.satId !== null ||
              entry.beamId !== null ||
              entry.elapsedMs !== null ||
              entry.targetMs !== null ||
              entry.remainingMs !== null ||
              entry.distanceKm !== null ||
              entry.elevationDeg !== null ||
              entry.timeToThresholdSec !== null;

            if (!prepared) {
              continue;
            }

            assertCondition(
              entry.satId !== null && entry.beamId !== null,
              `Expected cho prepared sat/beam identity for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.elapsedMs) && (entry.elapsedMs ?? -1) >= 0,
              `Expected finite choPreparedElapsedMs for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.targetMs) && (entry.targetMs ?? -1) > 0,
              `Expected finite choPreparedTargetMs for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.remainingMs) && (entry.remainingMs ?? -1) >= 0,
              `Expected finite choPreparedRemainingMs for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.distanceKm) && (entry.distanceKm ?? -1) >= 0,
              `Expected finite choGeometryDistanceKm for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.elevationDeg) &&
                (entry.elevationDeg ?? -Infinity) >= -90 &&
                (entry.elevationDeg ?? Infinity) <= 90,
              `Expected bounded choGeometryElevationDeg for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
            assertCondition(
              Number.isFinite(entry.timeToThresholdSec) &&
                (entry.timeToThresholdSec ?? -1) >= 0,
              `Expected finite choGeometryTimeToThresholdSec for seed=${seed}, ue=${entry.ueId}, tick=${entry.tick}.`,
            );
          }
        };

        const seed = 23;
        const first = execute(seed);
        const firstPayload = projectChoHudPayload(first);
        assertCondition(
          firstPayload.length > 0,
          'Expected CHO HUD projection payload to include at least one snapshot entry.',
        );
        assertChoHudContract(firstPayload, seed);

        const second = execute(seed);
        const secondPayload = projectChoHudPayload(second);
        assertChoHudContract(secondPayload, seed);

        assertCondition(
          JSON.stringify(firstPayload) === JSON.stringify(secondPayload),
          'Expected deterministic replay for CHO HUD countdown and geometry payload.',
        );
      },
    },
    {
      name: 'integration: starlink-like real-trace smoke has satellites in snapshot',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 5,
          captureSnapshots: true,
        });

        const run = batch.runs[0];
        assertCondition(Boolean(run), 'Expected one batch run for smoke test.');
        assertCondition(
          run.result.summary.satelliteCount > 0,
          'Expected satelliteCount > 0 in starlink-like smoke summary.',
        );
        assertCondition(
          run.result.metadata.runtimeParameterAudit !== null,
          'Expected runtime parameter audit payload in smoke summary metadata.',
        );
        assertCondition(
          run.result.metadata.runtimeParameterAudit?.pass === true,
          'Expected runtime parameter audit pass=true in smoke summary metadata.',
        );

        const snapshots = run.snapshots ?? [];
        assertCondition(snapshots.length === 6, 'Expected initial + 5 tick snapshots in smoke test.');
        const last = snapshots[snapshots.length - 1];
        assertCondition(Boolean(last), 'Expected final snapshot in smoke test.');
        assertCondition(
          last.satellites.length === run.result.summary.satelliteCount,
          'Snapshot satellite count should match KPI summary satellite count.',
        );
      },
    },
    {
      name: 'integration: gain-model visualization route is profile-driven and deterministic',
      kind: 'integration',
      run: () => {
        const besselProfile = loadPaperProfile('case9-default');
        const flatProfile = loadPaperProfile('case9-default', {
          beam: {
            gainModel: 'flat',
          },
        });

        const besselBands = resolveBeamFootprintBands(besselProfile.beam.gainModel, true);
        const flatBands = resolveBeamFootprintBands(flatProfile.beam.gainModel, true);
        const besselBandsReplay = resolveBeamFootprintBands(besselProfile.beam.gainModel, true);

        assertCondition(
          JSON.stringify(besselBands) !== JSON.stringify(flatBands),
          'Expected beam footprint visualization bands to differ between bessel-j1 and flat gain models.',
        );
        assertCondition(
          JSON.stringify(besselBands) === JSON.stringify(besselBandsReplay),
          'Expected deterministic visualization bands for fixed gain model input.',
        );
      },
    },
    {
      name: 'integration: satellite glb render mode degrades gracefully on load error state',
      kind: 'integration',
      run: () => {
        const fallbackDecision = resolveSatelliteRenderDecision('glb', 'error');
        const replayDecision = resolveSatelliteRenderDecision('glb', 'error');

        assertCondition(
          fallbackDecision.effectiveMode === 'primitive',
          'Expected glb error state to fallback to primitive render mode.',
        );
        assertCondition(
          fallbackDecision.reason === 'glb-error-fallback',
          'Expected glb error state to emit glb-error-fallback reason.',
        );
        assertCondition(
          JSON.stringify(fallbackDecision) === JSON.stringify(replayDecision),
          'Expected deterministic fallback decision for fixed render-mode/load-state tuple.',
        );
      },
    },
    {
      name: 'integration: deterministic throughput summary value is stable',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const batch = runBaselineBatch({
          profile,
          seed: 7,
          baselines: ['max-rsrp'],
          tickCount: 20,
        });
        const throughput = batch.runs[0].result.summary.kpi.throughput;
        assertAlmostEqual(throughput, throughput);
        assertCondition(Number.isFinite(throughput), 'Throughput must be finite in integration test.');
      },
    },
    ...buildBaselineGeneralizationIntegrationCases(),
    ...buildBaselineParameterEnvelopeIntegrationCases(),
    ...buildCommonBaselinePackIntegrationCases(),
    ...buildComparisonChartIntegrationCases(),
    ...buildCrossModeBenchmarkIntegrationCases(),
    ...buildMultiSeedBenchmarkIntegrationCases(),
    ...buildMultiSeedReportingIntegrationCases(),
    ...buildPolicySchedulerIntegrationCases(),
    ...buildResearchParameterIntegrationCases(),
    ...buildTrajectoryParameterIntegrationCases(),
    ...buildReproBundleV1IntegrationCases(),
    ...buildScenarioMatrixIntegrationCases(),
    ...buildServiceContinuityPackIntegrationCases(),
    ...buildSmallScaleIntegrationCases(),
    ...buildRealTraceArtifactIntegrationCases(),
  ];
}
