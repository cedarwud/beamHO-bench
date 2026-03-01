import type { ValidationIssue } from './schema-utils';

export interface SourceCatalogEntry {
  sourceId: string;
  type: 'standard' | 'paper' | 'assumption';
  title: string;
  locator: string;
  year: number;
  canonicalUrl: string;
  licenseNote: string;
  note?: string;
  artifactSha256?: string;
}

export interface SourceCatalogFile {
  generatedAtUtc: string;
  entries: SourceCatalogEntry[];
}

export interface GenericProfileSourceMap<ProfileId extends string = string> {
  profileId: ProfileId;
  sources: Record<string, string[]>;
}

export function validateSourceMap<ProfileId extends string>(
  profileId: ProfileId,
  map: GenericProfileSourceMap<ProfileId>,
  sourceCatalogById: ReadonlyMap<string, SourceCatalogEntry>,
): ValidationIssue[] {
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
      if (!sourceCatalogById.has(sourceId)) {
        issues.push({
          path: `$.sources.${parameterPath}`,
          message: `references unknown sourceId '${sourceId}'`,
        });
      }
    }
  }

  return issues;
}

export function buildResolvedSourceLinks(
  sourceMap: GenericProfileSourceMap,
  sourceCatalogById: ReadonlyMap<string, SourceCatalogEntry>,
): Record<string, string> {
  const links: Record<string, string> = {};

  for (const sourceIds of Object.values(sourceMap.sources)) {
    for (const sourceId of sourceIds) {
      const entry = sourceCatalogById.get(sourceId);
      if (entry) {
        links[sourceId] = entry.canonicalUrl;
      }
    }
  }

  return links;
}

export function extractAssumptionIdsFromSourceMap(
  sourceMap: GenericProfileSourceMap,
): string[] {
  const ids = new Set<string>();

  for (const sourceIds of Object.values(sourceMap.sources)) {
    for (const sourceId of sourceIds) {
      if (sourceId.startsWith('ASSUME-')) {
        ids.add(sourceId);
      }
    }
  }

  return [...ids].sort();
}
