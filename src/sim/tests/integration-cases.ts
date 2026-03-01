import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import { runCoreValidationSuite } from '@/sim/bench/validation-suite';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import { assertAlmostEqual, assertCondition, normalizeBatchForDeterminism } from './helpers';
import { buildPolicySchedulerIntegrationCases } from './integration-cases-policy-scheduler';
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
    ...buildPolicySchedulerIntegrationCases(),
    {
      name: 'integration: real-trace multi-baseline batch comparison works on starlink-like profile',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const baselines: RuntimeBaseline[] = ['max-rsrp', 'max-elevation', 'max-remaining-time'];
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines,
          tickCount: 20,
        });

        assertCondition(
          batch.runs.length === baselines.length,
          'Expected one batch run per requested baseline in real-trace comparison.',
        );
        assertCondition(
          batch.runs.every((run) => run.result.summary.satelliteCount > 0),
          'Expected all real-trace baseline runs to have visible satellites.',
        );
        assertCondition(
          batch.runs.every(
            (run) =>
              run.result.metadata.runtimeParameterAudit !== null &&
              run.result.metadata.runtimeParameterAudit.pass,
          ),
          'Expected runtime parameter audit pass=true for all real-trace baseline runs.',
        );
        assertCondition(
          batch.summaryCsv.includes('max-rsrp') &&
            batch.summaryCsv.includes('max-elevation') &&
            batch.summaryCsv.includes('max-remaining-time'),
          'Expected real-trace summary CSV to contain all requested baselines.',
        );
      },
    },
    {
      name: 'integration: source-trace artifact resolves source links in paper-baseline and real-trace modes',
      kind: 'integration',
      run: async () => {
        const case9Profile = loadPaperProfile('case9-default');
        const starlinkProfile = loadPaperProfile('starlink-like');

        const case9Trace = await createSourceTraceArtifact({
          scenarioId: 'sim-case9-analytic',
          profileId: 'case9-default',
          baseline: 'a4',
          algorithmFidelity: case9Profile.handover.algorithmFidelity,
          seed: 11,
          playbackRate: 1,
        });
        const starlinkTrace = await createSourceTraceArtifact({
          scenarioId: 'sim-real-trace-starlink',
          profileId: 'starlink-like',
          baseline: 'max-rsrp',
          algorithmFidelity: starlinkProfile.handover.algorithmFidelity,
          seed: 11,
          playbackRate: 1,
        });

        for (const trace of [case9Trace, starlinkTrace]) {
          assertCondition(
            typeof trace.profile_checksum_sha256 === 'string' &&
              trace.profile_checksum_sha256.length > 0,
            `Expected non-empty profile checksum in source-trace for '${trace.profile_id}'.`,
          );
          assertCondition(
            typeof trace.source_catalog_checksum_sha256 === 'string' &&
              trace.source_catalog_checksum_sha256.length > 0,
            `Expected non-empty source catalog checksum in source-trace for '${trace.profile_id}'.`,
          );
          assertCondition(
            Object.keys(trace.resolvedParameterSources).length > 0,
            `Expected resolved parameter-source mappings for '${trace.profile_id}'.`,
          );
          assertCondition(
            Object.keys(trace.resolvedSourceLinks).length > 0,
            `Expected resolved source links for '${trace.profile_id}'.`,
          );

          const mappedSourceIds = new Set(
            Object.values(trace.resolvedParameterSources).flat(),
          );
          for (const sourceId of mappedSourceIds) {
            assertCondition(
              Boolean(trace.resolvedSourceLinks[sourceId]),
              `Expected canonical link for sourceId '${sourceId}' in '${trace.profile_id}' source-trace.`,
            );
          }
        }
      },
    },
    {
      name: 'integration: run manifest for real-trace includes TLE snapshot metadata',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const batch = runBaselineBatch({
          profile,
          seed: 99,
          baselines: ['max-rsrp'],
          tickCount: 5,
        });
        const runtimeAudit = batch.runs[0].result.metadata.runtimeParameterAudit;

        const manifest = buildRunManifest({
          scenarioId: 'sim-real-trace-starlink-max-rsrp',
          profile,
          baseline: 'max-rsrp',
          seed: 99,
          playbackRate: 1,
          profileChecksumSha256: 'test-profile-checksum',
          sourceCatalogChecksumSha256: 'test-source-catalog-checksum',
          resolvedAssumptionIds: batch.runs[0].result.metadata.resolvedAssumptionIds,
          runtimeParameterAudit: runtimeAudit,
          validationGate: {
            pass: true,
            totalCases: 1,
            failedCases: 0,
          },
        });

        assertCondition(
          manifest.mode === 'real-trace',
          'Expected manifest mode to be real-trace for starlink-like profile.',
        );
        assertCondition(
          typeof manifest.tle_snapshot_utc === 'string' && manifest.tle_snapshot_utc.length > 0,
          'Expected real-trace manifest to include tle_snapshot_utc.',
        );
      },
    },
  ];
}
