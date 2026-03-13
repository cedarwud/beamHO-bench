import type { CanonicalProfileId } from '@/config/paper-profiles/loader';
import {
  buildBaselineParameterEnvelopeArtifact,
  type BaselineParameterEnvelopeArtifact,
  type BuildBaselineParameterEnvelopeOptions,
} from './baseline-parameter-envelope';
import {
  runCrossModeBaselineBenchmark,
  type BuildCrossModeBenchmarkPlanOptions,
  type CrossModeBenchmarkRunArtifact,
} from './cross-mode-benchmark';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-repro-bundle-v1-sdd.md (D1)
 *
 * Notes:
 * - Repro bundle v1 composes canonical cross-mode benchmark output and
 *   baseline-parameter-envelope output into one deterministic digest-linked artifact.
 */

export interface BuildReproBundleV1Options {
  crossModeOptions?: BuildCrossModeBenchmarkPlanOptions;
  baselineEnvelopeOptions?: BuildBaselineParameterEnvelopeOptions;
}

export interface ReproBundleV1ComponentDigests {
  crossModeArtifactDigest: string;
  crossModePlanTupleDigest: string;
  baselineEnvelopeTupleDigest: string;
  baselineEnvelopeCaseCount: number;
}

export interface ReproBundleV1Artifact {
  artifactType: 'repro-bundle-v1';
  schemaVersion: '1.0.0';
  components: {
    crossMode: CrossModeBenchmarkRunArtifact;
    baselineParameterEnvelope: BaselineParameterEnvelopeArtifact;
  };
  profileCoverage: CanonicalProfileId[];
  componentDigests: ReproBundleV1ComponentDigests;
  tupleDigest: string;
  artifactDigest: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const raw = JSON.stringify(value);
    return raw ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function hashFNV1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function resolveProfileCoverage(input: {
  crossMode: CrossModeBenchmarkRunArtifact;
  baselineEnvelope: BaselineParameterEnvelopeArtifact;
}): CanonicalProfileId[] {
  const set = new Set<CanonicalProfileId>();
  for (const suiteCase of input.crossMode.plan.cases) {
    set.add(suiteCase.profileId);
  }
  for (const suiteCase of input.baselineEnvelope.cases) {
    set.add(suiteCase.profileId);
  }
  return [...set].sort((left, right) => left.localeCompare(right)) as CanonicalProfileId[];
}

export function buildReproBundleV1Artifact(
  options: BuildReproBundleV1Options = {},
): ReproBundleV1Artifact {
  const crossMode = runCrossModeBaselineBenchmark(options.crossModeOptions);
  const baselineEnvelope = buildBaselineParameterEnvelopeArtifact(options.baselineEnvelopeOptions);
  const profileCoverage = resolveProfileCoverage({ crossMode, baselineEnvelope });
  const componentDigests: ReproBundleV1ComponentDigests = {
    crossModeArtifactDigest: crossMode.artifactDigest,
    crossModePlanTupleDigest: crossMode.plan.tupleDigest,
    baselineEnvelopeTupleDigest: baselineEnvelope.tupleDigest,
    baselineEnvelopeCaseCount: baselineEnvelope.caseCount,
  };
  const tupleDigest = hashFNV1aHex(
    stableStringify({
      crossModePlanTupleDigest: crossMode.plan.tupleDigest,
      baselineEnvelopeTupleDigest: baselineEnvelope.tupleDigest,
      profileCoverage,
    }),
  );

  const artifactWithoutDigest = {
    artifactType: 'repro-bundle-v1' as const,
    schemaVersion: '1.0.0' as const,
    components: {
      crossMode,
      baselineParameterEnvelope: baselineEnvelope,
    },
    profileCoverage,
    componentDigests,
    tupleDigest,
  };

  const artifactDigest = hashFNV1aHex(stableStringify(artifactWithoutDigest));
  return {
    ...artifactWithoutDigest,
    artifactDigest,
  };
}
