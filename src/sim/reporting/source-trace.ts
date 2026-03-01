import {
  buildSourceTracePayload,
  computeProfileChecksum,
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { AlgorithmFidelity, PaperProfile } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-paper-traceability.md
 * - sdd/completed/beamHO-bench-validation-matrix.md
 *
 * Notes:
 * - `resolvedParameterSources` and `resolvedAssumptionIds` are runtime traceability anchors.
 * - `algorithm_fidelity` is required in artifacts for benchmark-governance checks.
 */

export interface SourceTraceArtifact {
  scenario_id: string;
  profile_id: CanonicalProfileId;
  baseline: string;
  algorithm_fidelity: AlgorithmFidelity;
  seed: number;
  playback_rate: number;
  profile_checksum_sha256: string;
  source_catalog_checksum_sha256: string;
  resolvedParameterSources: Record<string, string[]>;
  resolvedSourceLinks: Record<string, string>;
  resolvedAssumptionIds: string[];
  assumptions: string[];
}

export interface SourceTraceOptions {
  scenarioId: string;
  profileId: CanonicalProfileId;
  baseline: string;
  algorithmFidelity: AlgorithmFidelity;
  seed: number;
  playbackRate: number;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  assumptionIds?: string[];
  assumptions?: string[];
}

export async function createSourceTraceArtifact(
  options: SourceTraceOptions,
): Promise<SourceTraceArtifact> {
  const runtimeOverrides = options.runtimeOverrides ?? {};
  const explicitAssumptionIds = options.assumptionIds ?? [];
  const assumptions = options.assumptions ?? [];

  const profile = loadPaperProfile(options.profileId, runtimeOverrides);
  const tracePayload = await buildSourceTracePayload(options.profileId, runtimeOverrides);
  const resolvedAssumptionIds = [
    ...new Set([...tracePayload.resolvedAssumptionIds, ...explicitAssumptionIds]),
  ].sort();

  return {
    scenario_id: options.scenarioId,
    profile_id: options.profileId,
    baseline: options.baseline,
    algorithm_fidelity: options.algorithmFidelity,
    seed: options.seed,
    playback_rate: options.playbackRate,
    profile_checksum_sha256: await computeProfileChecksum(profile),
    source_catalog_checksum_sha256: tracePayload.sourceCatalogChecksumSha256,
    resolvedParameterSources: tracePayload.resolvedParameterSources,
    resolvedSourceLinks: tracePayload.resolvedSourceLinks,
    resolvedAssumptionIds,
    assumptions,
  };
}

export function createSourceTraceDownload(
  artifact: SourceTraceArtifact,
  filename: string,
): void {
  const blob = new Blob([JSON.stringify(artifact, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
