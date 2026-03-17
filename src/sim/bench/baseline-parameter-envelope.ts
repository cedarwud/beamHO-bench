import { loadPaperProfile, type CanonicalProfileId, type DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile, ProfileMode } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-baseline-parameter-envelope-sdd.md (D1)
 *
 * Notes:
 * - This module defines a deterministic baseline-parameter envelope artifact
 *   for common sensitivity tiers (elevation/load/mobility).
 */

export interface BaselineParameterEnvelopeAxes {
  minElevationDegTiers: number[];
  ueCountTiers: number[];
  ueSpeedKmphTiers: number[];
  profileSequence: CanonicalProfileId[];
}

export interface BaselineParameterEnvelopeCase {
  matrixCaseId: string;
  tupleDigest: string;
  profileId: CanonicalProfileId;
  mode: ProfileMode;
  axes: {
    minElevationDeg: number;
    ueCount: number;
    ueSpeedKmph: number;
  };
  runtimeOverrides: DeepPartial<PaperProfile>;
}

export interface BaselineParameterEnvelopeArtifact {
  artifactType: 'baseline-parameter-envelope-v1';
  schemaVersion: '1.0.0';
  axes: BaselineParameterEnvelopeAxes;
  caseCount: number;
  cases: BaselineParameterEnvelopeCase[];
  tupleDigest: string;
}

export interface BuildBaselineParameterEnvelopeOptions {
  axes?: Partial<BaselineParameterEnvelopeAxes>;
}

const DEFAULT_AXES: BaselineParameterEnvelopeAxes = {
  minElevationDegTiers: [10, 20, 35],
  ueCountTiers: [50, 100],
  ueSpeedKmphTiers: [0, 3, 30, 60],
  profileSequence: ['starlink-like', 'starlink-like', 'oneweb-like'],
};

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

function normalizeInteger(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be finite, got '${value}'.`);
  }
  return Math.round(value);
}

function normalizeMinElevationDeg(values: number[]): number[] {
  const normalized = [...new Set(values.map((value) => normalizeInteger(value, 'minElevationDeg')))].sort(
    (left, right) => left - right,
  );
  for (const value of normalized) {
    if (value <= 0 || value > 90) {
      throw new Error(`minElevationDeg tier must satisfy 1..90, got '${value}'.`);
    }
  }
  if (normalized.length === 0) {
    throw new Error('minElevationDeg tiers must include at least one value.');
  }
  return normalized;
}

function normalizeUeCount(values: number[]): number[] {
  const normalized = [...new Set(values.map((value) => normalizeInteger(value, 'ueCount')))].sort(
    (left, right) => left - right,
  );
  for (const value of normalized) {
    if (value <= 0) {
      throw new Error(`ueCount tier must be >= 1, got '${value}'.`);
    }
  }
  if (normalized.length === 0) {
    throw new Error('ueCount tiers must include at least one value.');
  }
  return normalized;
}

function normalizeUeSpeedKmph(values: number[]): number[] {
  const normalized = [...new Set(values.map((value) => normalizeInteger(value, 'ueSpeedKmph')))].sort(
    (left, right) => left - right,
  );
  for (const value of normalized) {
    if (value < 0) {
      throw new Error(`ueSpeedKmph tier must be >= 0, got '${value}'.`);
    }
  }
  if (normalized.length === 0) {
    throw new Error('ueSpeedKmph tiers must include at least one value.');
  }
  return normalized;
}

function normalizeProfileSequence(values: CanonicalProfileId[]): CanonicalProfileId[] {
  const normalized = [...new Set(values)];
  if (normalized.length === 0) {
    throw new Error('profileSequence must include at least one canonical profile.');
  }
  return normalized;
}

function canonicalizeAxes(axes: Partial<BaselineParameterEnvelopeAxes>): BaselineParameterEnvelopeAxes {
  return {
    minElevationDegTiers: normalizeMinElevationDeg(
      axes.minElevationDegTiers ?? DEFAULT_AXES.minElevationDegTiers,
    ),
    ueCountTiers: normalizeUeCount(axes.ueCountTiers ?? DEFAULT_AXES.ueCountTiers),
    ueSpeedKmphTiers: normalizeUeSpeedKmph(axes.ueSpeedKmphTiers ?? DEFAULT_AXES.ueSpeedKmphTiers),
    profileSequence: normalizeProfileSequence(axes.profileSequence ?? DEFAULT_AXES.profileSequence),
  };
}

function buildMatrixCaseId(input: {
  profileId: CanonicalProfileId;
  minElevationDeg: number;
  ueCount: number;
  ueSpeedKmph: number;
}): string {
  const profileTag = input.profileId.replace(/-/g, '_');
  return `bpev1-${profileTag}-el${input.minElevationDeg}-ue${input.ueCount}-sp${input.ueSpeedKmph}`;
}

function buildRuntimeOverrides(input: {
  minElevationDeg: number;
  ueCount: number;
  ueSpeedKmph: number;
}): DeepPartial<PaperProfile> {
  return {
    constellation: {
      minElevationDeg: input.minElevationDeg,
    },
    ue: {
      count: input.ueCount,
      speedKmphOptions: [input.ueSpeedKmph],
    },
  };
}

export function buildBaselineParameterEnvelopeArtifact(
  options: BuildBaselineParameterEnvelopeOptions = {},
): BaselineParameterEnvelopeArtifact {
  const axes = canonicalizeAxes(options.axes ?? {});
  const cases: BaselineParameterEnvelopeCase[] = [];

  for (const profileId of axes.profileSequence) {
    const profile = loadPaperProfile(profileId);

    for (const minElevationDeg of axes.minElevationDegTiers) {
      for (const ueCount of axes.ueCountTiers) {
        for (const ueSpeedKmph of axes.ueSpeedKmphTiers) {
          const runtimeOverrides = buildRuntimeOverrides({
            minElevationDeg,
            ueCount,
            ueSpeedKmph,
          });
          const matrixCaseId = buildMatrixCaseId({
            profileId,
            minElevationDeg,
            ueCount,
            ueSpeedKmph,
          });
          const tupleDigest = hashFNV1aHex(
            stableStringify({
              matrixCaseId,
              profileId,
              mode: profile.mode,
              minElevationDeg,
              ueCount,
              ueSpeedKmph,
              runtimeOverrides,
            }),
          );

          cases.push({
            matrixCaseId,
            tupleDigest,
            profileId,
            mode: profile.mode,
            axes: {
              minElevationDeg,
              ueCount,
              ueSpeedKmph,
            },
            runtimeOverrides,
          });
        }
      }
    }
  }

  cases.sort((left, right) => left.matrixCaseId.localeCompare(right.matrixCaseId));

  const tupleDigest = hashFNV1aHex(stableStringify(cases));
  return {
    artifactType: 'baseline-parameter-envelope-v1',
    schemaVersion: '1.0.0',
    axes,
    caseCount: cases.length,
    cases,
    tupleDigest,
  };
}
