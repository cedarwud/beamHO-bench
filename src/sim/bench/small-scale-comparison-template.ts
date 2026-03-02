import type { CanonicalProfileId, DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile, SmallScaleModel } from '@/config/paper-profiles/types';
import type { RuntimeBaseline } from '@/sim/handover/baselines';

type SmallScaleTemplateModel = Exclude<SmallScaleModel, 'custom'>;

const SMALL_SCALE_TEMPLATE_MODELS: SmallScaleTemplateModel[] = [
  'none',
  'shadowed-rician',
  'loo',
];

export interface SmallScaleComparisonTemplateCase {
  caseId: string;
  baseline: RuntimeBaseline;
  smallScaleModel: SmallScaleTemplateModel;
  runtimeOverrides: DeepPartial<PaperProfile>;
  rerunContract: {
    scenarioId: string;
    profileId: CanonicalProfileId;
    seed: number;
    baselineOrPolicy: RuntimeBaseline;
    tickCount: number;
    runtimeOverrides: DeepPartial<PaperProfile>;
  };
}

export interface SmallScaleComparisonTemplateArtifact {
  artifactType: 'small-scale-comparison-template';
  schemaVersion: '1.0.0';
  generatedAtUtc: string;
  metadata: {
    profileId: CanonicalProfileId;
    seed: number;
    tickCount: number;
    scenarioId: string;
    models: SmallScaleTemplateModel[];
    baselines: RuntimeBaseline[];
  };
  cases: SmallScaleComparisonTemplateCase[];
}

export interface BuildSmallScaleComparisonTemplateOptions {
  profileId: CanonicalProfileId;
  seed: number;
  tickCount: number;
  baselines: RuntimeBaseline[];
  scenarioId: string;
  generatedAtUtc?: string;
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

export function buildSmallScaleComparisonTemplateFileName(
  options: Pick<BuildSmallScaleComparisonTemplateOptions, 'profileId' | 'seed' | 'tickCount'>,
): string {
  return `small-scale-template_${options.profileId}_seed-${options.seed}_ticks-${options.tickCount}.json`;
}

export function buildSmallScaleComparisonTemplateArtifact(
  options: BuildSmallScaleComparisonTemplateOptions,
): SmallScaleComparisonTemplateArtifact {
  const baselines = normalizeBaselines(options.baselines);
  const cases: SmallScaleComparisonTemplateCase[] = [];

  for (const baseline of baselines) {
    for (const model of SMALL_SCALE_TEMPLATE_MODELS) {
      const runtimeOverrides: DeepPartial<PaperProfile> = {
        channel: {
          smallScaleModel: model,
        },
      };

      cases.push({
        caseId: `small-scale-${model}_${baseline}`,
        baseline,
        smallScaleModel: model,
        runtimeOverrides,
        rerunContract: {
          scenarioId: options.scenarioId,
          profileId: options.profileId,
          seed: options.seed,
          baselineOrPolicy: baseline,
          tickCount: options.tickCount,
          runtimeOverrides,
        },
      });
    }
  }

  return {
    artifactType: 'small-scale-comparison-template',
    schemaVersion: '1.0.0',
    generatedAtUtc: options.generatedAtUtc ?? new Date().toISOString(),
    metadata: {
      profileId: options.profileId,
      seed: options.seed,
      tickCount: options.tickCount,
      scenarioId: options.scenarioId,
      models: [...SMALL_SCALE_TEMPLATE_MODELS],
      baselines,
    },
    cases,
  };
}
