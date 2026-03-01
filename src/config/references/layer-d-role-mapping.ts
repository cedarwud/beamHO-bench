import layerDRoleMappingJson from './layer-d-role-mapping.json';
import type { SourceCatalogEntry } from '@/config/paper-profiles/source-map-utils';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-baseline-generalization-sdd.md
 * - PAP-2024-MADRL-CORE
 * - PAP-2025-DAPS-CORE
 * - PAP-2022-SEAMLESSNTN-CORE
 *
 * Notes:
 * - Layer-D roles are functional contracts, not single-paper environment bindings.
 */

export const REQUIRED_LAYER_D_ROLE_IDS = ['morl', 'c-ucgm', 'ldaps-daps'] as const;

export type LayerDRoleId = (typeof REQUIRED_LAYER_D_ROLE_IDS)[number];

export interface LayerDRoleMappingEntry {
  roleId: string;
  roleName: string;
  functionalScope: string;
  contractAnchors: string[];
  sourceIds: string[];
  notes?: string[];
}

export interface LayerDRoleMappingFile {
  version: string;
  generatedAtUtc: string;
  entries: LayerDRoleMappingEntry[];
}

export interface LayerDRoleMappingIssue {
  path: string;
  message: string;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadLayerDRoleMapping(): LayerDRoleMappingFile {
  return cloneValue(layerDRoleMappingJson as LayerDRoleMappingFile);
}

export function validateLayerDRoleMapping(
  mapping: LayerDRoleMappingFile,
  sourceCatalog: SourceCatalogEntry[],
): LayerDRoleMappingIssue[] {
  const issues: LayerDRoleMappingIssue[] = [];
  const sourceCatalogById = new Set(sourceCatalog.map((entry) => entry.sourceId));
  const requiredRoles = new Set(REQUIRED_LAYER_D_ROLE_IDS);
  const seenRoles = new Set<string>();

  if (!Array.isArray(mapping.entries) || mapping.entries.length === 0) {
    issues.push({
      path: '$.entries',
      message: 'must contain at least one Layer-D role mapping entry',
    });
    return issues;
  }

  for (let index = 0; index < mapping.entries.length; index += 1) {
    const entry = mapping.entries[index];
    const basePath = `$.entries[${index}]`;

    if (!entry.roleId || typeof entry.roleId !== 'string') {
      issues.push({
        path: `${basePath}.roleId`,
        message: 'roleId must be a non-empty string',
      });
      continue;
    }

    if (seenRoles.has(entry.roleId)) {
      issues.push({
        path: `${basePath}.roleId`,
        message: `duplicate roleId '${entry.roleId}'`,
      });
    }
    seenRoles.add(entry.roleId);

    if (!Array.isArray(entry.sourceIds) || entry.sourceIds.length === 0) {
      issues.push({
        path: `${basePath}.sourceIds`,
        message: 'must contain at least one sourceId',
      });
      continue;
    }

    const hasPaperSource = entry.sourceIds.some((sourceId) => sourceId.startsWith('PAP-'));
    if (!hasPaperSource) {
      issues.push({
        path: `${basePath}.sourceIds`,
        message: 'must include at least one paper sourceId (PAP-*)',
      });
    }

    for (const sourceId of entry.sourceIds) {
      if (!sourceCatalogById.has(sourceId)) {
        issues.push({
          path: `${basePath}.sourceIds`,
          message: `references unknown sourceId '${sourceId}'`,
        });
      }
    }
  }

  for (const roleId of requiredRoles) {
    if (!seenRoles.has(roleId)) {
      issues.push({
        path: '$.entries',
        message: `missing required Layer-D role '${roleId}'`,
      });
    }
  }

  return issues;
}
