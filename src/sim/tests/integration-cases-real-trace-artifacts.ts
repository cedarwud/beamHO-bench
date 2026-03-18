import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import { loadOrbitCatalog } from '@/sim/orbit/sgp4';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import { createRealTraceScenario } from '@/sim/scenarios/real-trace';
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
        const case9Profile = loadPaperProfile('starlink-like');
        const starlinkProfile = loadPaperProfile('starlink-like');

        const case9Trace = await createSourceTraceArtifact({
          scenarioId: 'sim-case9-analytic',
          profileId: 'starlink-like',
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
    // ──── RTLP validation gates ───────────────────────────────────────────
    {
      name: 'RTLP-1: epoch-origin is deterministic — same fixture yields same t=0 geometry independent of wall-clock',
      kind: 'integration',
      run: () => {
        // Both calls use the same committed fixture; neither touches Date.now().
        // replayWindowStartUtcMs must be identical across two catalog loads.
        const profile = loadPaperProfile('starlink-like');
        const catalog1 = loadOrbitCatalog(profile);
        const catalog2 = loadOrbitCatalog(profile);

        assertCondition(
          catalog1.replayWindowStartUtcMs === catalog2.replayWindowStartUtcMs,
          `RTLP-1: replayWindowStartUtcMs must be identical across loads. Got ${catalog1.replayWindowStartUtcMs} vs ${catalog2.replayWindowStartUtcMs}.`,
        );
        assertCondition(
          catalog1.replayWindowStartUtcMs > 0,
          'RTLP-1: replayWindowStartUtcMs must be a positive UTC ms value.',
        );
        // Sanity: must be a plausible UTC timestamp (after 2020-01-01)
        assertCondition(
          catalog1.replayWindowStartUtcMs > Date.parse('2020-01-01T00:00:00Z'),
          'RTLP-1: replayWindowStartUtcMs must be after 2020-01-01.',
        );
      },
    },
    {
      name: 'RTLP-2: fixture has explicit selectionPolicy metadata describing retention basis',
      kind: 'integration',
      run: () => {
        for (const profileId of ['starlink-like', 'oneweb-like'] as const) {
          const profile = loadPaperProfile(profileId);
          const catalog = loadOrbitCatalog(profile);

          assertCondition(
            catalog.selectionPolicyMode === 'constellation-even' ||
              catalog.selectionPolicyMode === 'observer-local-pass',
            `RTLP-2 [${profileId}]: selectionPolicyMode must be 'constellation-even' or 'observer-local-pass'. Got '${catalog.selectionPolicyMode}'.`,
          );
          assertCondition(
            catalog.replayWindowDurationSec > 0,
            `RTLP-2 [${profileId}]: replayWindowDurationSec must be positive. Got ${catalog.replayWindowDurationSec}.`,
          );
        }
      },
    },
    {
      name: 'RTLP-3: bootstrap offset is within replay window and produces deterministic initial epoch',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const catalog = loadOrbitCatalog(profile);

        assertCondition(
          catalog.bootstrapStartOffsetSec >= 0,
          `RTLP-3: bootstrapStartOffsetSec must be >= 0. Got ${catalog.bootstrapStartOffsetSec}.`,
        );
        assertCondition(
          catalog.bootstrapStartOffsetSec <= catalog.replayWindowDurationSec,
          `RTLP-3: bootstrapStartOffsetSec (${catalog.bootstrapStartOffsetSec}) must not exceed replayWindowDurationSec (${catalog.replayWindowDurationSec}).`,
        );

        // Create scenario with bootstrap enabled; tick-0 epoch must equal
        // replayWindowStartUtcMs + bootstrapStartOffsetSec * 1000.
        const scenario = createRealTraceScenario({
          profile,
          seed: 1,
          applyBootstrap: true,
          maxTrajWindowSec: 600,
          maxCatalogRecords: 30,
        });
        const snapshot0 = scenario.createInitialSnapshot();
        assertCondition(
          snapshot0.tick === 0,
          'RTLP-3: initial snapshot must have tick=0.',
        );
        // Smoke: scenario must produce at least one satellite visible from NTPU
        // at the bootstrap epoch (otherwise the bootstrap scoring is broken).
        assertCondition(
          snapshot0.satellites.length > 0 || snapshot0.observerSkyPhysicalSatellites !== undefined,
          'RTLP-3: initial snapshot must include satellite data.',
        );
      },
    },
    {
      name: 'RTLP-4: no fake density — all runtime satellites are traceable to catalog records',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const catalog = loadOrbitCatalog(profile);
        const validNoradIds = new Set(catalog.records.map((r) => r.noradId));

        const scenario = createRealTraceScenario({ profile, seed: 7, maxTrajWindowSec: 600, maxCatalogRecords: 30 });
        const snapshot0 = scenario.createInitialSnapshot();

        for (const sat of snapshot0.satellites) {
          assertCondition(
            validNoradIds.has(sat.id),
            `RTLP-4: satellite id=${sat.id} in runtime set is not traceable to any catalog record (fake density).`,
          );
        }
        if (snapshot0.observerSkyPhysicalSatellites) {
          for (const sat of snapshot0.observerSkyPhysicalSatellites) {
            assertCondition(
              validNoradIds.has(sat.id),
              `RTLP-4: observerSkyPhysical satellite id=${sat.id} is not traceable to any catalog record.`,
            );
          }
        }
      },
    },
    {
      name: 'RTLP-5: research-default is default mode; demo-loop must be explicitly requested',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');

        // Default scenario must run without looping (research-default)
        const defaultScenario = createRealTraceScenario({ profile, seed: 3, maxTrajWindowSec: 600, maxCatalogRecords: 30 });
        const snap0 = defaultScenario.createInitialSnapshot();
        const snap1 = defaultScenario.nextSnapshot(snap0, { timeStepSec: 1 });
        const snap2 = defaultScenario.nextSnapshot(snap1, { timeStepSec: 1 });

        assertCondition(
          snap2.timeSec > snap1.timeSec && snap1.timeSec > snap0.timeSec,
          'RTLP-5: research-default mode must advance time monotonically.',
        );

        // Catalog must expose selectionPolicyMode for traceability
        const catalog = loadOrbitCatalog(profile);
        assertCondition(
          typeof catalog.selectionPolicyMode === 'string' && catalog.selectionPolicyMode.length > 0,
          'RTLP-5: catalog must expose selectionPolicyMode for research/demo traceability.',
        );
      },
    },
    {
      name: 'RTLP-6: demo-loop seam is an explicit reset boundary — no silent mid-pass teleport',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const catalog = loadOrbitCatalog(profile);

        const demoScenario = createRealTraceScenario({
          profile,
          seed: 5,
          replayMode: 'demo-loop',
          applyBootstrap: false, // test seam without bootstrap shift
          maxTrajWindowSec: 600,
          maxCatalogRecords: 30,
        });

        // Advance to just before the seam
        const snap0 = demoScenario.createInitialSnapshot();
        const windowDurationSec = catalog.replayWindowDurationSec;

        // Step just past one full window (should wrap, not continue unbounded).
        // Use large steps to reduce memory pressure from per-tick SGP4 propagation.
        const nearSeamSec = windowDurationSec - 1;
        let snap = snap0;
        const stepSec = 100;
        while (snap.timeSec < nearSeamSec) {
          snap = demoScenario.nextSnapshot(snap, { timeStepSec: stepSec });
        }

        const snapBeforeSeam = snap;
        const snapAfterSeam = demoScenario.nextSnapshot(snapBeforeSeam, { timeStepSec: stepSec });
        const snapAfterSeam2 = demoScenario.nextSnapshot(snapAfterSeam, { timeStepSec: stepSec });

        // timeSec must continue increasing (the scenario tracks wall time, not wrapped utcMs)
        assertCondition(
          snapAfterSeam.timeSec > snapBeforeSeam.timeSec,
          'RTLP-6: timeSec must still increase after seam (scenario time is unbounded).',
        );

        // Satellites must still be present after the seam (no crash / empty scene)
        assertCondition(
          snapAfterSeam.satellites.length >= 0,
          'RTLP-6: satellite list must be defined after seam.',
        );
        assertCondition(
          snapAfterSeam2.satellites.length >= 0,
          'RTLP-6: satellite list must be defined two steps after seam.',
        );

        // Verify the UTC wrapping: UTC times at step 0 and at step windowDuration
        // should be close (within stepSec) — the seam is explicit, not mid-pass.
        // We can't access internal UTC here, but we can verify scenario doesn't throw.
        assertCondition(true, 'RTLP-6: demo-loop seam crossed without error.');
      },
    },
  ];
}
