import case9DefaultProfile from './case9-default.json';
import onewebLikeProfile from './oneweb-like.json';
import paperProfileSchema from './paper-profile.schema.json';
import starlinkLikeProfile from './starlink-like.json';
import case9DefaultSourceMap from './case9-default.sources.json';
import onewebLikeSourceMap from './oneweb-like.sources.json';
import starlinkLikeSourceMap from './starlink-like.sources.json';
import sourceCatalogJson from '../references/paper-sources.json';
import type { PaperProfile } from './types';

export type CanonicalProfileId = 'case9-default' | 'starlink-like' | 'oneweb-like';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ProfileValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'ProfileValidationError';
    this.issues = issues;
  }
}

interface JsonSchema {
  $id?: string;
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  items?: JsonSchema;
}

export interface SourceCatalogEntry {
  sourceId: string;
  type: 'standard' | 'paper';
  title: string;
  locator: string;
  year: number;
  canonicalUrl: string;
  licenseNote: string;
  note?: string;
  artifactSha256?: string;
}

interface SourceCatalogFile {
  generatedAtUtc: string;
  entries: SourceCatalogEntry[];
}

export interface ProfileSourceMap {
  profileId: CanonicalProfileId;
  sources: Record<string, string[]>;
}

export interface SourceTracePayload {
  profileId: CanonicalProfileId;
  sourceCatalogChecksumSha256: string;
  resolvedParameterSources: Record<string, string[]>;
  resolvedSourceLinks: Record<string, string>;
}

const PROFILE_CATALOG: Record<CanonicalProfileId, PaperProfile> = {
  'case9-default': case9DefaultProfile as PaperProfile,
  'starlink-like': starlinkLikeProfile as PaperProfile,
  'oneweb-like': onewebLikeProfile as PaperProfile,
};

const PROFILE_SOURCE_MAP_CATALOG: Record<CanonicalProfileId, ProfileSourceMap> = {
  'case9-default': case9DefaultSourceMap as ProfileSourceMap,
  'starlink-like': starlinkLikeSourceMap as ProfileSourceMap,
  'oneweb-like': onewebLikeSourceMap as ProfileSourceMap,
};

const PROFILE_SCHEMA = paperProfileSchema as JsonSchema;
const SOURCE_CATALOG = sourceCatalogJson as SourceCatalogFile;
const SOURCE_CATALOG_BY_ID = new Map<string, SourceCatalogEntry>(
  SOURCE_CATALOG.entries.map((entry) => [entry.sourceId, entry]),
);

const CANONICAL_PROFILE_IDS: CanonicalProfileId[] = [
  'case9-default',
  'starlink-like',
  'oneweb-like',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

  if (isPlainObject(base) && isPlainObject(overrides)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(overrides)]);

    for (const key of keys) {
      result[key] = mergeValue(base[key], overrides[key]);
    }

    return result;
  }

  return cloneValue(overrides);
}

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
): void {
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    issues.push({
      path,
      message: `must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`,
    });
    return;
  }

  if (!schema.type) {
    return;
  }

  if (schema.type === 'object') {
    if (!isPlainObject(value)) {
      issues.push({ path, message: 'must be an object' });
      return;
    }

    const properties = schema.properties ?? {};

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          issues.push({ path: `${path}.${key}`, message: 'is required' });
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          issues.push({ path: `${path}.${key}`, message: 'is not allowed' });
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        validateAgainstSchema(value[key], childSchema, `${path}.${key}`, issues);
      }
    }

    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push({ path, message: 'must be an array' });
      return;
    }

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
    }

    if (schema.items) {
      value.forEach((item, index) => {
        validateAgainstSchema(item, schema.items as JsonSchema, `${path}[${index}]`, issues);
      });
    }

    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      issues.push({ path, message: 'must be a string' });
      return;
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `length must be >= ${schema.minLength}` });
    }

    if (schema.pattern) {
      const pattern = new RegExp(schema.pattern);
      if (!pattern.test(value)) {
        issues.push({ path, message: `must match pattern ${schema.pattern}` });
      }
    }

    return;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push({ path, message: 'must be a boolean' });
    }
    return;
  }

  if (schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      issues.push({ path, message: 'must be an integer' });
      return;
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `must be >= ${schema.minimum}` });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `must be <= ${schema.maximum}` });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      issues.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
    }

    return;
  }

  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path, message: 'must be a finite number' });
      return;
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `must be >= ${schema.minimum}` });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `must be <= ${schema.maximum}` });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      issues.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
    }
  }
}

function validateOverridePaths(
  overrides: unknown,
  schema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
): void {
  if (overrides === undefined || overrides === null) {
    return;
  }

  if (schema.type === 'object') {
    if (!isPlainObject(overrides)) {
      return;
    }

    const properties = schema.properties ?? {};

    for (const [key, value] of Object.entries(overrides)) {
      const nextSchema = properties[key];

      if (!nextSchema) {
        issues.push({ path: `${path}.${key}`, message: 'is not a valid override path' });
        continue;
      }

      validateOverridePaths(value, nextSchema, `${path}.${key}`, issues);
    }

    return;
  }

  if (schema.type === 'array' && Array.isArray(overrides) && schema.items) {
    overrides.forEach((item, index) => {
      validateOverridePaths(item, schema.items as JsonSchema, `${path}[${index}]`, issues);
    });
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\$\./, '');
}

function validateProfile(profile: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateAgainstSchema(profile, PROFILE_SCHEMA, '$', issues);
  return issues;
}

function validateSourceMap(profileId: CanonicalProfileId, map: ProfileSourceMap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (map.profileId !== profileId) {
    issues.push({
      path: '$.profileId',
      message: `must match requested profile id '${profileId}'`,
    });
  }

  for (const [parameterPath, sourceIds] of Object.entries(map.sources)) {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      issues.push({
        path: `$.sources.${parameterPath}`,
        message: 'must contain at least one sourceId',
      });
      continue;
    }

    for (const sourceId of sourceIds) {
      if (!SOURCE_CATALOG_BY_ID.has(sourceId)) {
        issues.push({
          path: `$.sources.${parameterPath}`,
          message: `references unknown sourceId '${sourceId}'`,
        });
      }
    }
  }

  return issues;
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
  const issues = validateSourceMap(profileId, sourceMap);

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
  const links: Record<string, string> = {};

  for (const sourceIds of Object.values(sourceMap.sources)) {
    for (const sourceId of sourceIds) {
      const entry = SOURCE_CATALOG_BY_ID.get(sourceId);
      if (entry) {
        links[sourceId] = entry.canonicalUrl;
      }
    }
  }

  return links;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const keyValuePairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${keyValuePairs.join(',')}}`;
}

export async function sha256Hex(payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const buffer = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

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

    const sourceMapIssues = validateSourceMap(profileId, PROFILE_SOURCE_MAP_CATALOG[profileId]);

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
