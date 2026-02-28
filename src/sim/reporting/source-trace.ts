import {
  buildSourceTracePayload,
  computeProfileChecksum,
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';

export interface SourceTraceArtifact {
  scenario_id: string;
  profile_id: CanonicalProfileId;
  baseline: string;
  seed: number;
  profile_checksum_sha256: string;
  source_catalog_checksum_sha256: string;
  resolvedParameterSources: Record<string, string[]>;
  resolvedSourceLinks: Record<string, string>;
  assumptions: string[];
}

export interface SourceTraceOptions {
  scenarioId: string;
  profileId: CanonicalProfileId;
  baseline: string;
  seed: number;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  assumptions?: string[];
}

export async function createSourceTraceArtifact(
  options: SourceTraceOptions,
): Promise<SourceTraceArtifact> {
  const runtimeOverrides = options.runtimeOverrides ?? {};
  const assumptions = options.assumptions ?? [];

  const profile = loadPaperProfile(options.profileId, runtimeOverrides);
  const tracePayload = await buildSourceTracePayload(options.profileId, runtimeOverrides);

  return {
    scenario_id: options.scenarioId,
    profile_id: options.profileId,
    baseline: options.baseline,
    seed: options.seed,
    profile_checksum_sha256: await computeProfileChecksum(profile),
    source_catalog_checksum_sha256: tracePayload.sourceCatalogChecksumSha256,
    resolvedParameterSources: tracePayload.resolvedParameterSources,
    resolvedSourceLinks: tracePayload.resolvedSourceLinks,
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
