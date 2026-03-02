import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import {
  buildSmallScaleComparisonTemplateArtifact,
  buildSmallScaleComparisonTemplateFileName,
} from '@/sim/bench/small-scale-comparison-template';
import { runCoreValidationSuite } from '@/sim/bench/validation-suite';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import { assertCondition, normalizeBatchForDeterminism } from './helpers';
import type { SimTestCase } from './types';

export function buildSmallScaleIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: non-none small-scale models are deterministic and distinguishable from none',
      kind: 'integration',
      run: () => {
        const noneProfile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'none',
          },
        });
        const shadowedProfile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'shadowed-rician',
          },
        });
        const looProfile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'loo',
          },
        });

        const runDeterministicBatch = (profile: typeof noneProfile) => {
          const first = runBaselineBatch({
            profile,
            seed: 42,
            baselines: ['max-rsrp'],
            tickCount: 18,
          });
          const second = runBaselineBatch({
            profile,
            seed: 42,
            baselines: ['max-rsrp'],
            tickCount: 18,
          });

          assertCondition(
            JSON.stringify(normalizeBatchForDeterminism(first)) ===
              JSON.stringify(normalizeBatchForDeterminism(second)),
            `Expected deterministic replay for smallScaleModel='${profile.channel.smallScaleModel}'.`,
          );

          return first;
        };

        const noneBatch = runDeterministicBatch(noneProfile);
        const shadowedBatch = runDeterministicBatch(shadowedProfile);
        const looBatch = runDeterministicBatch(looProfile);

        const noneRun = noneBatch.runs[0];
        const shadowedRun = shadowedBatch.runs[0];
        const looRun = looBatch.runs[0];

        assertCondition(Boolean(noneRun), 'Expected non-empty batch run for none model.');
        assertCondition(Boolean(shadowedRun), 'Expected non-empty batch run for shadowed-rician model.');
        assertCondition(Boolean(looRun), 'Expected non-empty batch run for loo model.');
        assertCondition(
          Number.isFinite(shadowedRun.result.summary.kpi.avgDlSinr) &&
            Number.isFinite(looRun.result.summary.kpi.avgDlSinr),
          'Expected finite avgDlSinr values for non-none small-scale models.',
        );

        const noneFingerprint = JSON.stringify(noneRun.result.summary.kpi);
        const shadowedFingerprint = JSON.stringify(shadowedRun.result.summary.kpi);
        const looFingerprint = JSON.stringify(looRun.result.summary.kpi);

        assertCondition(
          shadowedFingerprint !== noneFingerprint || looFingerprint !== noneFingerprint,
          'Expected at least one non-none small-scale model to produce KPI differences vs none.',
        );
      },
    },
    {
      name: 'integration: validation suite small-scale sweep enforces deterministic effect check',
      kind: 'integration',
      run: () => {
        const suite = runCoreValidationSuite({ seed: 42 });
        const smallScaleResults = suite.results.filter(
          (result) => result.validationId === 'VAL-SMALL-SCALE-MODEL-SWEEP',
        );

        assertCondition(
          smallScaleResults.length === 3,
          `Expected 3 small-scale sweep cases, got ${smallScaleResults.length}.`,
        );

        for (const result of smallScaleResults) {
          const effectCheck = result.checks.find(
            (check) => check.checkId === 'small-scale-effect',
          );
          assertCondition(
            Boolean(effectCheck),
            `Expected small-scale-effect check in ${result.caseId}.`,
          );
          assertCondition(
            effectCheck?.pass === true,
            `Expected small-scale-effect check pass for ${result.caseId}.`,
          );
          const run = result.batch.runs[0];
          assertCondition(Boolean(run), `Expected non-empty run in ${result.caseId}.`);
          assertCondition(
            run.result.metadata.smallScaleModel ===
              result.runtimeOverrides.channel?.smallScaleModel,
            `Expected metadata smallScaleModel to match runtime override in ${result.caseId}.`,
          );
        }
      },
    },
    {
      name: 'integration: small-scale model and params are exported in metadata/source-trace/manifest',
      kind: 'integration',
      run: async () => {
        const profile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'shadowed-rician',
          },
        });
        const batch = runBaselineBatch({
          profile,
          seed: 52,
          baselines: ['max-rsrp'],
          tickCount: 12,
        });
        const run = batch.runs[0];
        assertCondition(Boolean(run), 'Expected non-empty run for small-scale artifact export check.');
        assertCondition(
          run.result.metadata.smallScaleModel === 'shadowed-rician',
          'Expected run metadata smallScaleModel=shadowed-rician.',
        );
        assertCondition(
          Boolean(run.result.metadata.smallScaleParams?.shadowedRician),
          'Expected run metadata to include shadowedRician params.',
        );

        const sourceTrace = await createSourceTraceArtifact({
          scenarioId: run.result.metadata.scenarioId,
          profileId: 'case9-default',
          baseline: run.baseline,
          algorithmFidelity: profile.handover.algorithmFidelity,
          seed: 52,
          playbackRate: 1,
          runtimeOverrides: {
            channel: {
              smallScaleModel: 'shadowed-rician',
            },
          },
        });
        assertCondition(
          sourceTrace.small_scale_model === 'shadowed-rician',
          'Expected source-trace small_scale_model=shadowed-rician.',
        );
        assertCondition(
          Boolean(sourceTrace.small_scale_params?.shadowed_rician),
          'Expected source-trace shadowed_rician params payload.',
        );

        const manifest = buildRunManifest({
          scenarioId: run.result.metadata.scenarioId,
          profile,
          baseline: run.baseline,
          seed: 52,
          playbackRate: 1,
          profileChecksumSha256: 'test-profile-checksum',
          sourceCatalogChecksumSha256: 'test-source-catalog-checksum',
          resolvedAssumptionIds: run.result.metadata.resolvedAssumptionIds,
          runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
        });

        assertCondition(
          manifest.small_scale_model === 'shadowed-rician',
          'Expected manifest small_scale_model=shadowed-rician.',
        );
        assertCondition(
          Boolean(manifest.small_scale_params?.shadowed_rician),
          'Expected manifest shadowed_rician params payload.',
        );
      },
    },
    {
      name: 'integration: small-scale comparison template artifact is deterministic and reproducible',
      kind: 'integration',
      run: () => {
        const options = {
          profileId: 'case9-default' as const,
          seed: 42,
          tickCount: 18,
          baselines: ['max-rsrp', 'a3'] as const,
          scenarioId: 'phase1a-case9-analytic-template',
          generatedAtUtc: '2026-03-02T00:00:00.000Z',
        };
        const first = buildSmallScaleComparisonTemplateArtifact({
          ...options,
          baselines: [...options.baselines],
        });
        const second = buildSmallScaleComparisonTemplateArtifact({
          ...options,
          baselines: [...options.baselines],
        });
        const fileName = buildSmallScaleComparisonTemplateFileName({
          profileId: options.profileId,
          seed: options.seed,
          tickCount: options.tickCount,
        });

        assertCondition(
          fileName.includes('case9-default') &&
            fileName.includes('seed-42') &&
            fileName.includes('ticks-18'),
          'Expected small-scale template filename to include profile/seed/tick metadata.',
        );
        assertCondition(
          first.cases.length === options.baselines.length * 3,
          'Expected template cases to cover baselines x {none, shadowed-rician, loo}.',
        );
        assertCondition(
          first.metadata.models.join('|') === 'none|shadowed-rician|loo',
          'Expected template model sweep to include none/shadowed-rician/loo.',
        );
        assertCondition(
          first.cases.every(
            (entry) => entry.rerunContract.seed === 42 && entry.rerunContract.tickCount === 18,
          ),
          'Expected rerun contract tuples to carry deterministic seed/tick tuple.',
        );
        assertCondition(
          JSON.stringify(first) === JSON.stringify(second),
          'Expected deterministic template artifact for fixed options.',
        );
      },
    },
  ];
}
