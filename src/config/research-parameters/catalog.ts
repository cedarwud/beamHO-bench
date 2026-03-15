import type { DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile, ProfileMode } from '@/config/paper-profiles/types';
import {
  RESEARCH_PARAMETER_GROUPS,
  type ResearchParameterGroup,
  type ResearchParameterId,
  type ResearchParameterSelection,
  type ResearchParameterSpec,
} from './types';
import {
  mergePaperProfileOverrides,
  resolveResearchParameterConsistency,
  type BuildResearchRuntimeOverridesResult,
  type ResearchConsistencyMode,
} from './consistency';
import { asNearestOptionValue, RESEARCH_PARAMETER_SPECS } from './specs';

export type {
  ResearchParameterGroupId,
  ResearchParameterSelection,
  ResearchParameterId,
} from './types';
export type {
  BuildResearchRuntimeOverridesResult,
  ResearchConsistencyIssue,
  ResearchConsistencyIssueSeverity,
  ResearchConsistencyMode,
  ResearchConsistencySummary,
} from './consistency';
export { summarizeResearchConsistency } from './consistency';

const SPEC_BY_ID = new Map(RESEARCH_PARAMETER_SPECS.map((spec) => [spec.id, spec]));

export const ALL_RESEARCH_PARAMETER_IDS: readonly ResearchParameterId[] = RESEARCH_PARAMETER_SPECS.map(
  (spec) => spec.id,
);

function isSpecModeEnabled(spec: ResearchParameterSpec, mode: ProfileMode): boolean {
  return !spec.modes || spec.modes.includes(mode);
}

function isSpecAvailable(
  spec: ResearchParameterSpec,
  profile: PaperProfile,
  selection: ResearchParameterSelection,
): boolean {
  if (!isSpecModeEnabled(spec, profile.mode)) {
    return false;
  }
  return spec.isAvailable ? spec.isAvailable({ profile, selection }) : true;
}

function normalizeSelectionValue(
  spec: ResearchParameterSpec,
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): string {
  const fromSelection = selection[spec.id];
  const fallback = spec.readFromProfile(profile);
  const candidate = fromSelection ?? fallback;
  return asNearestOptionValue(candidate, spec.options);
}

export function createResearchParameterSelection(profile: PaperProfile): ResearchParameterSelection {
  const selection = {} as ResearchParameterSelection;
  for (const spec of RESEARCH_PARAMETER_SPECS) {
    selection[spec.id] = normalizeSelectionValue(spec, profile, {});
  }
  return selection;
}

export function normalizeResearchParameterSelection(
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): ResearchParameterSelection {
  const normalized = {} as ResearchParameterSelection;
  for (const spec of RESEARCH_PARAMETER_SPECS) {
    normalized[spec.id] = normalizeSelectionValue(spec, profile, selection);
  }
  return normalized;
}

export function buildResearchRuntimeOverridesWithConsistency(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
  consistencyMode?: ResearchConsistencyMode;
}): BuildResearchRuntimeOverridesResult {
  const { profile } = options;
  const normalizedSelection = normalizeResearchParameterSelection(profile, options.selection);
  const consistency = resolveResearchParameterConsistency({
    profile,
    selection: normalizedSelection,
    mode: options.consistencyMode ?? 'strict',
  });
  const overrides: DeepPartial<PaperProfile> = {};

  for (const spec of RESEARCH_PARAMETER_SPECS) {
    if (!isSpecAvailable(spec, profile, consistency.selection)) {
      continue;
    }
    spec.applyToOverrides(consistency.selection[spec.id], overrides);
  }

  mergePaperProfileOverrides(overrides, consistency.derivedOverrides);

  const hardErrors = consistency.issues.filter((issue) => issue.severity === 'error');
  if (hardErrors.length > 0 && consistency.mode === 'strict') {
    throw new Error(
      `Research parameter consistency failure: ${hardErrors
        .map((issue) => `${issue.ruleId}:${issue.messageCode}`)
        .join(', ')}`,
    );
  }

  return {
    mode: consistency.mode,
    selection: consistency.selection,
    overrides,
    issues: consistency.issues,
  };
}

export function buildResearchRuntimeOverrides(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
  consistencyMode?: ResearchConsistencyMode;
}): DeepPartial<PaperProfile> {
  return buildResearchRuntimeOverridesWithConsistency(options).overrides;
}

export function getResearchParameterSpecById(
  parameterId: ResearchParameterId,
): ResearchParameterSpec {
  const spec = SPEC_BY_ID.get(parameterId);
  if (!spec) {
    throw new Error(`Unknown research parameter id '${parameterId}'.`);
  }
  return spec;
}

export function listResearchParameterSpecs(
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): ResearchParameterSpec[] {
  const normalized = normalizeResearchParameterSelection(profile, selection);
  return RESEARCH_PARAMETER_SPECS.filter((spec) =>
    isSpecAvailable(spec, profile, normalized),
  );
}

export function listResearchParameterGroups(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
}): Array<{
  group: ResearchParameterGroup;
  specs: ResearchParameterSpec[];
}> {
  const visibleSpecs = listResearchParameterSpecs(options.profile, options.selection);
  return RESEARCH_PARAMETER_GROUPS.map((group) => ({
    group,
    specs: visibleSpecs.filter((spec) => spec.groupId === group.id),
  })).filter((entry) => entry.specs.length > 0);
}
