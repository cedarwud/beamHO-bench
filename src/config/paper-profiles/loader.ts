import sourceCatalogJson from '../references/paper-sources.json';
import onewebLikeProfile from './oneweb-like.json';
import onewebLikeSourceMap from './oneweb-like.sources.json';
import paperProfileSchema from './paper-profile.schema.json';
import starlinkLikeProfile from './starlink-like.json';
import starlinkLikeSourceMap from './starlink-like.sources.json';
import { sha256Hex, stableStringify } from './checksum-utils';
import type { JsonSchema, ValidationIssue } from './schema-utils';
import { validateAgainstSchema, validateOverridePaths } from './schema-utils';
import type { SourceCatalogEntry, SourceCatalogFile } from './source-map-utils';
import {
  buildResolvedSourceLinks as buildResolvedSourceLinksFromCatalog,
  extractAssumptionIdsFromSourceMap as extractAssumptionIdsFromMap,
  type GenericProfileSourceMap,
  validateSourceMap,
} from './source-map-utils';
import type { PaperProfile } from './types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-paper-traceability.md
 * - sdd/completed/beamHO-bench-requirements.md (FR-025/026/027/028)
 *
 * Notes:
 * - This loader is the authoritative gate for profile schema validation and source-map validation.
 */

export type CanonicalProfileId = 'starlink-like' | 'oneweb-like';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

export type { ValidationIssue, SourceCatalogEntry };
export type ProfileSourceMap = GenericProfileSourceMap<CanonicalProfileId>;

export class ProfileValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'ProfileValidationError';
    this.issues = issues;
  }
}

export interface SourceTracePayload {
  profileId: CanonicalProfileId;
  sourceCatalogChecksumSha256: string;
  resolvedParameterSources: Record<string, string[]>;
  resolvedSourceLinks: Record<string, string>;
  resolvedAssumptionIds: string[];
}

const PROFILE_CATALOG: Record<CanonicalProfileId, PaperProfile> = {
  'starlink-like': starlinkLikeProfile as PaperProfile,
  'oneweb-like': onewebLikeProfile as PaperProfile,
};

const PROFILE_SOURCE_MAP_CATALOG: Record<CanonicalProfileId, ProfileSourceMap> = {
  'starlink-like': starlinkLikeSourceMap as ProfileSourceMap,
  'oneweb-like': onewebLikeSourceMap as ProfileSourceMap,
};

const PROFILE_SCHEMA = paperProfileSchema as JsonSchema;
const SOURCE_CATALOG = sourceCatalogJson as SourceCatalogFile;
const SOURCE_CATALOG_BY_ID = new Map<string, SourceCatalogEntry>(
  SOURCE_CATALOG.entries.map((entry) => [entry.sourceId, entry]),
);

const CANONICAL_PROFILE_IDS: CanonicalProfileId[] = [
  'starlink-like',
  'oneweb-like',
];

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeValue(base: unknown, overrides: unknown): unknown {
  if (overrides === undefined) {
    return cloneValue(base);
  }

  if (Array.isArray(overrides)) {
    return cloneValue(overrides);
  }

  if (
    typeof base === 'object' &&
    base !== null &&
    !Array.isArray(base) &&
    typeof overrides === 'object' &&
    overrides !== null &&
    !Array.isArray(overrides)
  ) {
    const baseRecord = base as Record<string, unknown>;
    const overrideRecord = overrides as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(baseRecord), ...Object.keys(overrideRecord)]);

    for (const key of keys) {
      result[key] = mergeValue(baseRecord[key], overrideRecord[key]);
    }

    return result;
  }

  return cloneValue(overrides);
}

function normalizePath(path: string): string {
  return path.replace(/^\$\./, '');
}

function validateProfile(profile: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateAgainstSchema(profile, PROFILE_SCHEMA, '$', issues);
  return issues;
}

function validateCanonicalSourceMap(
  profileId: CanonicalProfileId,
  map: ProfileSourceMap,
): ValidationIssue[] {
  return validateSourceMap(profileId, map, SOURCE_CATALOG_BY_ID);
}

export function isCanonicalProfileId(value: string): value is CanonicalProfileId {
  return CANONICAL_PROFILE_IDS.includes(value as CanonicalProfileId);
}

export function listCanonicalProfileIds(): CanonicalProfileId[] {
  return [...CANONICAL_PROFILE_IDS];
}

export function loadPaperProfile(
  profileId: CanonicalProfileId,
  runtimeOverrides: DeepPartial<PaperProfile> = {},
): PaperProfile {
  const baseProfile = PROFILE_CATALOG[profileId];

  if (!baseProfile) {
    throw new Error(`Unknown profile id '${profileId}'`);
  }

  const overridePathIssues: ValidationIssue[] = [];
  validateOverridePaths(runtimeOverrides, PROFILE_SCHEMA, '$', overridePathIssues);
  if (overridePathIssues.length > 0) {
    throw new ProfileValidationError(
      `Invalid runtime overrides for profile '${profileId}'`,
      overridePathIssues,
    );
  }

  const mergedProfile = mergeValue(baseProfile, runtimeOverrides) as PaperProfile;
  const profileIssues = validateProfile(mergedProfile);

  if (profileIssues.length > 0) {
    throw new ProfileValidationError(
      `Profile '${profileId}' failed schema validation`,
      profileIssues,
    );
  }

  return mergedProfile;
}

export function loadProfileSourceMap(profileId: CanonicalProfileId): ProfileSourceMap {
  const sourceMap = cloneValue(PROFILE_SOURCE_MAP_CATALOG[profileId]);
  const issues = validateCanonicalSourceMap(profileId, sourceMap);

  if (issues.length > 0) {
    throw new ProfileValidationError(
      `Profile source map '${profileId}' failed validation`,
      issues,
    );
  }

  return sourceMap;
}

export function getSourceCatalog(): SourceCatalogEntry[] {
  return cloneValue(SOURCE_CATALOG.entries);
}

export function getSourceEntry(sourceId: string): SourceCatalogEntry | undefined {
  const entry = SOURCE_CATALOG_BY_ID.get(sourceId);
  return entry ? cloneValue(entry) : undefined;
}

export function buildResolvedSourceLinks(sourceMap: ProfileSourceMap): Record<string, string> {
  return buildResolvedSourceLinksFromCatalog(sourceMap, SOURCE_CATALOG_BY_ID);
}

export function extractAssumptionIdsFromSourceMap(sourceMap: ProfileSourceMap): string[] {
  return extractAssumptionIdsFromMap(sourceMap);
}

export { sha256Hex };

export async function computeProfileChecksum(profile: PaperProfile): Promise<string> {
  return sha256Hex(stableStringify(profile));
}

export async function computeSourceCatalogChecksum(): Promise<string> {
  return sha256Hex(stableStringify(SOURCE_CATALOG));
}

export async function buildSourceTracePayload(
  profileId: CanonicalProfileId,
  runtimeOverrides: DeepPartial<PaperProfile> = {},
): Promise<SourceTracePayload> {
  const profile = loadPaperProfile(profileId, runtimeOverrides);
  const sourceMap = loadProfileSourceMap(profileId);

  return {
    profileId,
    sourceCatalogChecksumSha256: await computeSourceCatalogChecksum(),
    resolvedParameterSources: cloneValue(sourceMap.sources),
    resolvedSourceLinks: buildResolvedSourceLinks(sourceMap),
    resolvedAssumptionIds: extractAssumptionIdsFromSourceMap(sourceMap),
  };
}

(function assertBundledProfilesAreValid() {
  for (const profileId of CANONICAL_PROFILE_IDS) {
    const profile = PROFILE_CATALOG[profileId];
    const profileIssues = validateProfile(profile);

    if (profileIssues.length > 0) {
      throw new ProfileValidationError(
        `Bundled profile '${profileId}' failed schema validation`,
        profileIssues.map((issue) => ({
          path: normalizePath(issue.path),
          message: issue.message,
        })),
      );
    }

    const sourceMapIssues = validateCanonicalSourceMap(profileId, PROFILE_SOURCE_MAP_CATALOG[profileId]);
    if (sourceMapIssues.length > 0) {
      throw new ProfileValidationError(
        `Bundled source map '${profileId}' failed validation`,
        sourceMapIssues.map((issue) => ({
          path: normalizePath(issue.path),
          message: issue.message,
        })),
      );
    }
  }
})();
