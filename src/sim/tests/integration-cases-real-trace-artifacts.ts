import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildRealTraceArtifactIntegrationCases(): SimTestCase[] {
  return [
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
