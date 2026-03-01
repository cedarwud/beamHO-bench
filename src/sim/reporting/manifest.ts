import type { PaperProfile } from '@/config/paper-profiles/types';
import starlinkFixtureJson from '@/data/tle/starlink-sample.json';
import onewebFixtureJson from '@/data/tle/oneweb-sample.json';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { RuntimeParameterAuditSnapshot } from '@/sim/audit/runtime-parameter-audit';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-experiment-protocol.md
 * - sdd/completed/beamHO-bench-requirements.md
 *
 * Notes:
 * - Manifest fields follow the experiment protocol's reproducibility contract.
 */

interface TleFixtureMeta {
  generatedAtUtc: string;
}

export interface RunManifest {
  scenario_id: string;
  profile_id: string;
  baseline: RuntimeBaseline;
  seed: number;
  playback_rate: number;
  git_commit: string;
  started_at_utc: string;
  finished_at_utc: string;
  engine_version: string;
  profile_checksum_sha256: string;
  profile_schema_version: string;
  mode: 'paper-baseline' | 'real-trace';
  tle_snapshot_utc?: string;
  source_catalog_checksum_sha256: string;
  algorithm_fidelity: 'full' | 'simplified';
  resolved_assumption_ids: string[];
  validation_gate?: {
    pass: boolean;
    total_cases: number;
    failed_cases: number;
  };
  runtime_parameter_audit?: {
    pass: boolean;
    audited_tick: number;
    required_keys: number;
    touched_keys: number;
    missing_keys: string[];
  };
}

export interface RunManifestOptions {
  scenarioId: string;
  profile: PaperProfile;
  baseline: RuntimeBaseline;
  seed: number;
  playbackRate: number;
  profileChecksumSha256: string;
  sourceCatalogChecksumSha256: string;
  generatedAtUtc?: string;
  gitCommit?: string;
  engineVersion?: string;
  profileSchemaVersion?: string;
  resolvedAssumptionIds?: string[];
  runtimeParameterAudit?: RuntimeParameterAuditSnapshot | null;
  validationGate?: {
    pass: boolean;
    totalCases: number;
    failedCases: number;
  };
}

const STARLINK_FIXTURE = starlinkFixtureJson as TleFixtureMeta;
const ONEWEB_FIXTURE = onewebFixtureJson as TleFixtureMeta;

function resolveTleSnapshotUtc(profile: PaperProfile): string | undefined {
  if (profile.mode !== 'real-trace') {
    return undefined;
  }

  const provider = profile.constellation.tle?.provider;
  if (provider === 'oneweb') {
    return ONEWEB_FIXTURE.generatedAtUtc;
  }
  if (provider === 'starlink') {
    return STARLINK_FIXTURE.generatedAtUtc;
  }
  return undefined;
}

export function buildRunManifest(options: RunManifestOptions): RunManifest {
  const generatedAtUtc = options.generatedAtUtc ?? new Date().toISOString();

  const manifest: RunManifest = {
    scenario_id: options.scenarioId,
    profile_id: options.profile.profileId,
    baseline: options.baseline,
    seed: options.seed,
    playback_rate: options.playbackRate,
    git_commit: options.gitCommit ?? 'unknown',
    started_at_utc: generatedAtUtc,
    finished_at_utc: generatedAtUtc,
    engine_version: options.engineVersion ?? 'beamho-bench-v1',
    profile_checksum_sha256: options.profileChecksumSha256,
    profile_schema_version:
      options.profileSchemaVersion ?? 'paper-profile.schema.json@draft-2020-12',
    mode: options.profile.mode,
    source_catalog_checksum_sha256: options.sourceCatalogChecksumSha256,
    algorithm_fidelity: options.profile.handover.algorithmFidelity,
    resolved_assumption_ids: [...(options.resolvedAssumptionIds ?? [])].sort(),
  };

  const tleSnapshotUtc = resolveTleSnapshotUtc(options.profile);
  if (tleSnapshotUtc) {
    manifest.tle_snapshot_utc = tleSnapshotUtc;
  }

  if (options.validationGate) {
    manifest.validation_gate = {
      pass: options.validationGate.pass,
      total_cases: options.validationGate.totalCases,
      failed_cases: options.validationGate.failedCases,
    };
  }

  if (options.runtimeParameterAudit) {
    manifest.runtime_parameter_audit = {
      pass: options.runtimeParameterAudit.pass,
      audited_tick: options.runtimeParameterAudit.tick,
      required_keys: options.runtimeParameterAudit.requiredKeys.length,
      touched_keys: options.runtimeParameterAudit.touchedKeys.length,
      missing_keys: [...options.runtimeParameterAudit.missingKeys],
    };
  }

  return manifest;
}
