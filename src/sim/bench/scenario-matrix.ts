import type { CanonicalProfileId, DeepPartial } from '@/config/paper-profiles/loader';
import { loadPaperProfile } from '@/config/paper-profiles/loader';
import type {
  BeamLayout,
  FrequencyReuse,
  PaperProfile,
  ProfileMode,
  SmallScaleModel,
} from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-common-benchmark-v1-sdd.md (D2 / §3.2)
 */

export type ScenarioMatrixPreset = 'core-v1' | 'extended-v1';
export type ScenarioMatrixUeSpeedGroup =
  | 'stationary'
  | 'pedestrian'
  | 'urban'
  | 'vehicular';

export interface ScenarioMatrixAxes {
  orbitModes: ProfileMode[];
  beamCounts: number[];
  overlapRatios: number[];
  ueSpeedGroups: ScenarioMatrixUeSpeedGroup[];
  reuseModes: FrequencyReuse[];
  smallScaleModels: SmallScaleModel[];
}

export interface ScenarioMatrixCase {
  matrixCaseId: string;
  tupleDigest: string;
  profileId: CanonicalProfileId;
  mode: ProfileMode;
  axes: {
    orbitMode: ProfileMode;
    beamCount: number;
    overlapRatio: number;
    ueSpeedGroup: ScenarioMatrixUeSpeedGroup;
    ueSpeedKmph: number;
    reuseMode: FrequencyReuse;
    smallScaleModel: SmallScaleModel;
  };
  runtimeOverrides: DeepPartial<PaperProfile>;
}

export interface ScenarioMatrixArtifact {
  artifactType: 'scenario-matrix-v1';
  schemaVersion: '1.0.0';
  preset: ScenarioMatrixPreset;
  axes: ScenarioMatrixAxes;
  caseCount: number;
  profileByOrbitMode: Record<ProfileMode, CanonicalProfileId>;
  cases: ScenarioMatrixCase[];
}

export interface BuildScenarioMatrixOptions {
  preset?: ScenarioMatrixPreset;
  axes?: Partial<ScenarioMatrixAxes>;
  profileByOrbitMode?: Partial<Record<ProfileMode, CanonicalProfileId>>;
}

const CORE_AXES: ScenarioMatrixAxes = {
  orbitModes: ['paper-baseline', 'real-trace'],
  beamCounts: [16],
  overlapRatios: [0.25],
  ueSpeedGroups: ['pedestrian', 'vehicular'],
  reuseModes: ['FR1', 'reuse-4'],
  smallScaleModels: ['none', 'shadowed-rician'],
};

const EXTENDED_AXES: ScenarioMatrixAxes = {
  orbitModes: ['paper-baseline', 'real-trace'],
  beamCounts: [7, 16, 50],
  overlapRatios: [0.15, 0.25, 0.35],
  ueSpeedGroups: ['stationary', 'pedestrian', 'urban', 'vehicular'],
  reuseModes: ['FR1', 'reuse-4'],
  smallScaleModels: ['none', 'shadowed-rician', 'loo'],
};

const DEFAULT_PROFILE_BY_MODE: Record<ProfileMode, CanonicalProfileId> = {
  'paper-baseline': 'case9-default',
  'real-trace': 'starlink-like',
};

const UE_SPEED_BY_GROUP: Record<ScenarioMatrixUeSpeedGroup, number> = {
  stationary: 0,
  pedestrian: 3,
  urban: 30,
  vehicular: 60,
};

function normalizeUnique<T>(values: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalizeBeamCount(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`beamCount must be finite, got '${value}'.`);
  }
  const beamCount = Math.round(value);
  if (beamCount <= 0) {
    throw new Error(`beamCount must be >= 1, got '${value}'.`);
  }
  return beamCount;
}

function normalizeOverlapRatio(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`overlapRatio must be finite, got '${value}'.`);
  }
  if (value < 0 || value >= 1) {
    throw new Error(`overlapRatio must satisfy 0 <= value < 1, got '${value}'.`);
  }
  return Number(value.toFixed(4));
}

function canonicalizeAxes(preset: ScenarioMatrixPreset, axes: Partial<ScenarioMatrixAxes>): ScenarioMatrixAxes {
  const base = preset === 'extended-v1' ? EXTENDED_AXES : CORE_AXES;
  const orbitModes = normalizeUnique(axes.orbitModes ?? base.orbitModes);
  const beamCounts = normalizeUnique((axes.beamCounts ?? base.beamCounts).map(normalizeBeamCount));
  const overlapRatios = normalizeUnique((axes.overlapRatios ?? base.overlapRatios).map(normalizeOverlapRatio));
  const ueSpeedGroups = normalizeUnique(axes.ueSpeedGroups ?? base.ueSpeedGroups);
  const reuseModes = normalizeUnique(axes.reuseModes ?? base.reuseModes);
  const smallScaleModels = normalizeUnique(axes.smallScaleModels ?? base.smallScaleModels);
  if (orbitModes.length === 0 || beamCounts.length === 0 || overlapRatios.length === 0) {
    throw new Error('Scenario matrix axes must not be empty.');
  }
  if (ueSpeedGroups.length === 0 || reuseModes.length === 0 || smallScaleModels.length === 0) {
    throw new Error('Scenario matrix axes must not be empty.');
  }

  return {
    orbitModes,
    beamCounts: [...beamCounts].sort((left, right) => left - right),
    overlapRatios: [...overlapRatios].sort((left, right) => left - right),
    ueSpeedGroups,
    reuseModes,
    smallScaleModels,
  };
}

function layoutFromBeamCount(beamCount: number): BeamLayout {
  switch (beamCount) {
    case 7:
      return 'hex-7';
    case 16:
      return 'hex-16';
    case 19:
      return 'hex-19';
    case 50:
      return 'hex-50';
    default:
      return 'custom';
  }
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

function resolveProfileByMode(
  override: Partial<Record<ProfileMode, CanonicalProfileId>> | undefined,
): Record<ProfileMode, CanonicalProfileId> {
  return {
    'paper-baseline': override?.['paper-baseline'] ?? DEFAULT_PROFILE_BY_MODE['paper-baseline'],
    'real-trace': override?.['real-trace'] ?? DEFAULT_PROFILE_BY_MODE['real-trace'],
  };
}

function buildMatrixCaseId(input: {
  mode: ProfileMode;
  beamCount: number;
  overlapRatio: number;
  ueSpeedGroup: ScenarioMatrixUeSpeedGroup;
  reuseMode: FrequencyReuse;
  smallScaleModel: SmallScaleModel;
}): string {
  const modeTag = input.mode === 'paper-baseline' ? 'pb' : 'rt';
  const overlapPct = Math.round(input.overlapRatio * 100);
  const speedTag = UE_SPEED_BY_GROUP[input.ueSpeedGroup];
  const reuseTag = input.reuseMode === 'reuse-4' ? 'r4' : input.reuseMode.toLowerCase();
  return `mxv1-${modeTag}-b${input.beamCount}-ov${overlapPct}-s${speedTag}-${input.ueSpeedGroup}-ru${reuseTag}-ss${input.smallScaleModel}`;
}

function buildRuntimeOverrides(input: {
  beamCount: number;
  overlapRatio: number;
  ueSpeedGroup: ScenarioMatrixUeSpeedGroup;
  reuseMode: FrequencyReuse;
  smallScaleModel: SmallScaleModel;
}): DeepPartial<PaperProfile> {
  const speed = UE_SPEED_BY_GROUP[input.ueSpeedGroup];
  return {
    beam: {
      beamsPerSatellite: input.beamCount,
      layout: layoutFromBeamCount(input.beamCount),
      overlapRatio: input.overlapRatio,
      frequencyReuse: input.reuseMode,
    },
    ue: {
      speedKmphOptions: [speed],
    },
    channel: {
      smallScaleModel: input.smallScaleModel,
    },
  };
}

export function buildScenarioMatrix(options: BuildScenarioMatrixOptions = {}): ScenarioMatrixArtifact {
  const preset = options.preset ?? 'core-v1';
  const axes = canonicalizeAxes(preset, options.axes ?? {});
  const profileByMode = resolveProfileByMode(options.profileByOrbitMode);
  const cases: ScenarioMatrixCase[] = [];

  for (const mode of axes.orbitModes) {
    const profileId = profileByMode[mode];
    const profile = loadPaperProfile(profileId);
    if (profile.mode !== mode) {
      throw new Error(
        `Profile '${profileId}' mode '${profile.mode}' mismatches requested matrix orbit mode '${mode}'.`,
      );
    }

    for (const beamCount of axes.beamCounts) {
      for (const overlapRatio of axes.overlapRatios) {
        for (const ueSpeedGroup of axes.ueSpeedGroups) {
          for (const reuseMode of axes.reuseModes) {
            for (const smallScaleModel of axes.smallScaleModels) {
              const matrixCaseId = buildMatrixCaseId({
                mode,
                beamCount,
                overlapRatio,
                ueSpeedGroup,
                reuseMode,
                smallScaleModel,
              });
              const runtimeOverrides = buildRuntimeOverrides({
                beamCount,
                overlapRatio,
                ueSpeedGroup,
                reuseMode,
                smallScaleModel,
              });
              const tupleDigest = hashFNV1aHex(
                stableStringify({
                  profileId,
                  mode,
                  matrixCaseId,
                  runtimeOverrides,
                }),
              );
              cases.push({
                matrixCaseId,
                tupleDigest,
                profileId,
                mode,
                axes: {
                  orbitMode: mode,
                  beamCount,
                  overlapRatio,
                  ueSpeedGroup,
                  ueSpeedKmph: UE_SPEED_BY_GROUP[ueSpeedGroup],
                  reuseMode,
                  smallScaleModel,
                },
                runtimeOverrides,
              });
            }
          }
        }
      }
    }
  }

  cases.sort((left, right) => left.matrixCaseId.localeCompare(right.matrixCaseId));
  return {
    artifactType: 'scenario-matrix-v1',
    schemaVersion: '1.0.0',
    preset,
    axes,
    caseCount: cases.length,
    profileByOrbitMode: profileByMode,
    cases,
  };
}
