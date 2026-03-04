import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  buildResearchRuntimeOverridesWithConsistency,
  buildResearchRuntimeOverrides,
  createResearchParameterSelection,
  getResearchParameterSpecById,
  listResearchParameterSpecs,
  normalizeResearchParameterSelection,
  summarizeResearchConsistency,
  type ResearchParameterId,
  type ResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import { runBaselineBatch } from '@/sim/bench/runner';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function buildRunSignature(options: {
  profileId: 'case9-default';
  selection: ResearchParameterSelection;
  baseline: RuntimeBaseline;
  tickCount: number;
}): string {
  const baseProfile = loadPaperProfile(options.profileId);
  const runtimeOverrides = buildResearchRuntimeOverrides({
    profile: baseProfile,
    selection: options.selection,
  });
  const profile = loadPaperProfile(options.profileId, runtimeOverrides);
  const batch = runBaselineBatch({
    profile,
    seed: 42,
    baselines: [options.baseline],
    tickCount: options.tickCount,
  });

  const run = batch.runs[0];
  const summary = run.result.summary;
  const metadata = run.result.metadata;
  return JSON.stringify({
    baseline: options.baseline,
    tick: summary.tick,
    timeSec: Number(summary.timeSec.toFixed(3)),
    ueCount: summary.ueCount,
    satelliteCount: summary.satelliteCount,
    throughput: Number(summary.kpi.throughput.toFixed(6)),
    handoverRate: Number(summary.kpi.handoverRate.toFixed(6)),
    avgDlSinr: Number(summary.kpi.avgDlSinr.toFixed(6)),
    rlfState1: summary.kpi.rlf.state1,
    rlfState2: summary.kpi.rlf.state2,
    hofState2: summary.kpi.hof.state2,
    hofState3: summary.kpi.hof.state3,
    schedulerMode: metadata.beamScheduler.mode,
    schedulerTotalBeams: metadata.beamScheduler.totalBeamCount,
    smallScaleModel: metadata.smallScaleModel,
  });
}

export function buildResearchParameterIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: research parameter catalog only exposes effective runtime controls',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('case9-default');
        const selection = createResearchParameterSelection(baseProfile);
        const visibleSpecs = listResearchParameterSpecs(baseProfile, selection);

        assertCondition(
          visibleSpecs.length > 0,
          'Expected research parameter catalog to expose non-empty controls.',
        );

        const runtimeOverrides = buildResearchRuntimeOverrides({
          profile: baseProfile,
          selection,
        });
        const resolved = loadPaperProfile('case9-default', runtimeOverrides);

        for (const spec of visibleSpecs) {
          assertCondition(
            spec.options.some((option) => option.value === selection[spec.id]),
            `Expected selected value of '${spec.id}' to be within declared options.`,
          );
          assertCondition(
            spec.readFromProfile(resolved) === selection[spec.id],
            `Expected '${spec.id}' override to resolve into profile runtime path.`,
          );
        }

        assertCondition(
          !visibleSpecs.some((spec) =>
            [
              'scenario.deployment',
              'ue.distribution',
              'beam.layout',
              'beam.beamwidth3dBDeg',
              'constellation.constellationName',
              'constellation.orbitalPlanes',
              'constellation.inclinationDeg',
            ].includes(spec.id),
          ),
          'Research catalog must not include known non-runtime or metadata-only controls.',
        );
      },
    },
    {
      name: 'integration: research parameter consistency applies hard constraints and derived coupling',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('case9-default');
        const baseSelection = createResearchParameterSelection(baseProfile);
        const candidateSelection = normalizeResearchParameterSelection(baseProfile, {
          ...baseSelection,
          'constellation.altitudeKm': '1200',
          'constellation.activeSatellitesInWindow': '16',
          'channel.smallScaleModel': 'none',
          'channel.smallScaleParams.temporalCorrelation.enabled': 'true',
          'channel.smallScaleParams.dopplerAware.enabled': 'true',
          'handover.params.a3TttMs': '40',
        });

        const consistency = buildResearchRuntimeOverridesWithConsistency({
          profile: baseProfile,
          selection: candidateSelection,
          consistencyMode: 'strict',
        });
        const overrides = buildResearchRuntimeOverrides({
          profile: baseProfile,
          selection: candidateSelection,
          consistencyMode: 'strict',
        });

        assertCondition(
          consistency.selection['constellation.activeSatellitesInWindow'] ===
            String(baseProfile.constellation.satellitesPerPlane),
          'Expected activeSatellitesInWindow to be clamped to satellitesPerPlane in strict consistency mode.',
        );
        assertCondition(
          consistency.selection['channel.smallScaleParams.temporalCorrelation.enabled'] ===
            'false',
          'Expected temporal-correlation toggle to be forced off when smallScaleModel=none.',
        );
        assertCondition(
          consistency.selection['channel.smallScaleParams.dopplerAware.enabled'] === 'false',
          'Expected doppler-aware toggle to be forced off when smallScaleModel=none.',
        );

        const derivedSpeedKmps = consistency.overrides.constellation?.satelliteSpeedKmps;
        const derivedFootprintDiameterKm = consistency.overrides.beam?.footprintDiameterKm;
        assertCondition(
          Number.isFinite(derivedSpeedKmps) &&
            (derivedSpeedKmps as number) > 7 &&
            (derivedSpeedKmps as number) < 7.5,
          'Expected altitude-derived satellite speed to be a finite LEO-speed value.',
        );
        assertCondition(
          Number.isFinite(derivedFootprintDiameterKm) &&
            (derivedFootprintDiameterKm as number) > baseProfile.beam.footprintDiameterKm,
          'Expected altitude-derived footprint diameter to increase for higher altitude.',
        );

        assertCondition(
          consistency.issues.some(
            (issue) => issue.ruleId === 'PC-HARD-ACTIVE-WINDOW-UPPER-BOUND',
          ),
          'Expected hard-consistency issue for active-window upper-bound clamp.',
        );
        assertCondition(
          consistency.issues.some((issue) => issue.ruleId === 'PC-DERIVE-ALTITUDE-COUPLING'),
          'Expected derived-coupling issue for altitude-linked overrides.',
        );
        assertCondition(
          consistency.issues.some((issue) => issue.ruleId === 'PC-WARN-TTT-TICK-ALIAS'),
          'Expected soft warning for TTT below tick granularity.',
        );
        assertCondition(
          JSON.stringify(overrides) === JSON.stringify(consistency.overrides),
          'Expected wrapper buildResearchRuntimeOverrides to mirror consistency override output.',
        );
      },
    },
    {
      name: 'integration: strict and exploratory consistency modes diverge on tick-alias risk handling',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('case9-default');
        const baseSelection = createResearchParameterSelection(baseProfile);
        const riskySelection = normalizeResearchParameterSelection(baseProfile, {
          ...baseSelection,
          'handover.params.a3TttMs': '40',
        });
        const tickMs = Math.max(1, Math.round(baseProfile.timeStepSec * 1000));

        const strictConsistency = buildResearchRuntimeOverridesWithConsistency({
          profile: baseProfile,
          selection: riskySelection,
          consistencyMode: 'strict',
        });
        const exploratoryConsistency = buildResearchRuntimeOverridesWithConsistency({
          profile: baseProfile,
          selection: riskySelection,
          consistencyMode: 'exploratory',
        });

        assertCondition(
          strictConsistency.selection['handover.params.a3TttMs'] === String(tickMs),
          'Expected strict mode to raise TTT to tick granularity.',
        );
        assertCondition(
          strictConsistency.overrides.handover?.params?.a3TttMs === tickMs,
          'Expected strict mode override to use raised TTT tick granularity value.',
        );
        assertCondition(
          strictConsistency.issues.some(
            (issue) =>
              issue.ruleId === 'PC-WARN-TTT-TICK-ALIAS' &&
              issue.messageCode === 'ttt_clamped_to_tick_granularity_in_strict_mode',
          ),
          'Expected strict mode issue code for TTT clamp-to-tick behavior.',
        );

        assertCondition(
          exploratoryConsistency.selection['handover.params.a3TttMs'] === '40',
          'Expected exploratory mode to keep requested sub-tick TTT value.',
        );
        assertCondition(
          exploratoryConsistency.overrides.handover?.params?.a3TttMs === 40,
          'Expected exploratory mode override to keep requested sub-tick TTT value.',
        );
        assertCondition(
          exploratoryConsistency.issues.some(
            (issue) =>
              issue.ruleId === 'PC-WARN-TTT-TICK-ALIAS' &&
              issue.messageCode === 'ttt_below_tick_granularity',
          ),
          'Expected exploratory mode warning code for sub-tick TTT risk.',
        );
      },
    },
    {
      name: 'integration: research consistency summary is exported to source-trace and manifest artifacts',
      kind: 'integration',
      run: async () => {
        const baseProfile = loadPaperProfile('case9-default');
        const baseSelection = createResearchParameterSelection(baseProfile);
        const candidateSelection = normalizeResearchParameterSelection(baseProfile, {
          ...baseSelection,
          'constellation.altitudeKm': '1200',
          'constellation.activeSatellitesInWindow': '16',
          'channel.smallScaleModel': 'none',
          'channel.smallScaleParams.temporalCorrelation.enabled': 'true',
          'channel.smallScaleParams.dopplerAware.enabled': 'true',
          'handover.params.a3TttMs': '40',
        });
        const consistency = buildResearchRuntimeOverridesWithConsistency({
          profile: baseProfile,
          selection: candidateSelection,
          consistencyMode: 'strict',
        });
        const summary = summarizeResearchConsistency({
          mode: consistency.mode,
          issues: consistency.issues,
        });

        const sourceTrace = await createSourceTraceArtifact({
          scenarioId: 'case9-grid',
          profileId: 'case9-default',
          baseline: 'a4',
          algorithmFidelity: baseProfile.handover.algorithmFidelity,
          seed: 42,
          playbackRate: 1,
          runtimeOverrides: consistency.overrides,
          researchConsistency: summary,
        });

        const resolvedProfile = loadPaperProfile('case9-default', consistency.overrides);
        const manifest = buildRunManifest({
          scenarioId: 'case9-grid',
          profile: resolvedProfile,
          baseline: 'a4',
          seed: 42,
          playbackRate: 1,
          profileChecksumSha256: 'test-profile-checksum',
          sourceCatalogChecksumSha256: 'test-source-catalog-checksum',
          resolvedAssumptionIds: [],
          researchConsistency: summary,
        });

        const expectedIssueCodes = [...summary.issueCodes].sort();
        assertCondition(
          sourceTrace.research_consistency !== null,
          'Expected source-trace to carry research_consistency payload.',
        );
        assertCondition(
          manifest.research_consistency !== undefined,
          'Expected manifest to carry research_consistency payload.',
        );
        assertCondition(
          sourceTrace.research_consistency?.mode === 'strict',
          'Expected source-trace research consistency mode to match strict.',
        );
        assertCondition(
          manifest.research_consistency?.mode === 'strict',
          'Expected manifest research consistency mode to match strict.',
        );
        assertCondition(
          sourceTrace.research_consistency?.issue_count === summary.issueCount,
          'Expected source-trace issue_count to match consistency summary.',
        );
        assertCondition(
          manifest.research_consistency?.issue_count === summary.issueCount,
          'Expected manifest issue_count to match consistency summary.',
        );
        assertCondition(
          JSON.stringify(sourceTrace.research_consistency?.issue_codes ?? []) ===
            JSON.stringify(expectedIssueCodes),
          'Expected source-trace issue_codes to be sorted and deterministic.',
        );
        assertCondition(
          JSON.stringify(manifest.research_consistency?.issue_codes ?? []) ===
            JSON.stringify(expectedIssueCodes),
          'Expected manifest issue_codes to be sorted and deterministic.',
        );
      },
    },
    {
      name: 'integration: representative research parameters change simulation signatures',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('case9-default');
        const baseSelection = createResearchParameterSelection(baseProfile);

        const sweeps: Array<{
          parameterId: ResearchParameterId;
          candidateValue: string;
          baseline: RuntimeBaseline;
          tickCount: number;
          expectSignatureChange: boolean;
        }> = [
          {
            parameterId: 'constellation.minElevationDeg',
            candidateValue: '35',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: false,
          },
          {
            parameterId: 'beam.beamsPerSatellite',
            candidateValue: '50',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: true,
          },
          {
            parameterId: 'ue.count',
            candidateValue: '200',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: false,
          },
          {
            parameterId: 'handover.params.a4ThresholdDbm',
            candidateValue: '-102',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: false,
          },
          {
            parameterId: 'channel.smallScaleModel',
            candidateValue: 'shadowed-rician',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: true,
          },
          {
            parameterId: 'scheduler.mode',
            candidateValue: 'coupled',
            baseline: 'a4',
            tickCount: 90,
            expectSignatureChange: true,
          },
          {
            parameterId: 'handover.params.timerAlpha',
            candidateValue: '0.9',
            baseline: 'cho',
            tickCount: 120,
            expectSignatureChange: false,
          },
        ];

        for (const sweep of sweeps) {
          const spec = getResearchParameterSpecById(sweep.parameterId);
          assertCondition(
            spec.options.some((option) => option.value === sweep.candidateValue),
            `Invalid sweep value '${sweep.candidateValue}' for '${sweep.parameterId}'.`,
          );

          const candidateSelection = normalizeResearchParameterSelection(baseProfile, {
            ...baseSelection,
            [sweep.parameterId]: sweep.candidateValue,
          });
          const runtimeOverrides = buildResearchRuntimeOverrides({
            profile: baseProfile,
            selection: candidateSelection,
          });
          const resolvedProfile = loadPaperProfile('case9-default', runtimeOverrides);
          assertCondition(
            spec.readFromProfile(resolvedProfile) === candidateSelection[sweep.parameterId],
            `Expected '${sweep.parameterId}' to be reflected in resolved profile.`,
          );

          if (!sweep.expectSignatureChange) {
            continue;
          }

          const baseSignature = buildRunSignature({
            profileId: 'case9-default',
            selection: baseSelection,
            baseline: sweep.baseline,
            tickCount: sweep.tickCount,
          });
          const candidateSignature = buildRunSignature({
            profileId: 'case9-default',
            selection: candidateSelection,
            baseline: sweep.baseline,
            tickCount: sweep.tickCount,
          });

          assertCondition(
            baseSignature !== candidateSignature,
            `Expected '${sweep.parameterId}' change to alter simulation signature.`,
          );
        }
      },
    },
  ];
}
