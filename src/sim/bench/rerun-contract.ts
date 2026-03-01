import {
  computeProfileChecksum,
  computeSourceCatalogChecksum,
  extractAssumptionIdsFromSourceMap,
  getSourceCatalog,
  isCanonicalProfileId,
  loadPaperProfile,
  loadProfileSourceMap,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import { sha256Hex, stableStringify } from '@/config/paper-profiles/checksum-utils';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { runBaselineBatch } from '@/sim/bench/runner';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import {
  createGreedySinrPolicyPlugin,
  createInvalidActionProbePolicyPlugin,
  createNoOpPolicyPlugin,
} from '@/sim/policy/builtin-plugins';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-baseline-generalization-sdd.md
 * - sdd/completed/beamHO-bench-experiment-protocol.md
 * - ASSUME-THROUGHPUT-MODEL-POLICY
 *
 * Notes:
 * - One-click rerun contract for reproducible artifact regeneration.
 */

const RUNTIME_BASELINES: RuntimeBaseline[] = [
  'max-rsrp',
  'max-elevation',
  'max-remaining-time',
  'a3',
  'a4',
  'cho',
  'mc-ho',
];

const POLICY_PLUGIN_IDS = ['noop', 'greedy-sinr', 'invalid-action-probe'] as const;
type PolicyPluginId = (typeof POLICY_PLUGIN_IDS)[number];

function isRuntimeBaseline(value: string): value is RuntimeBaseline {
  return RUNTIME_BASELINES.includes(value as RuntimeBaseline);
}

function isPolicyPluginId(value: string): value is PolicyPluginId {
  return POLICY_PLUGIN_IDS.includes(value as PolicyPluginId);
}

export interface RerunContractInput {
  scenarioId: string;
  profileId: CanonicalProfileId;
  seed: number;
  baselineOrPolicy: string;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  tickCount?: number;
}

interface BaselineOrPolicyResolution {
  baseline: RuntimeBaseline;
  policyRuntime:
    | {
        mode: 'off';
      }
    | {
        mode: 'on';
        pluginFactory: () => ReturnType<typeof createNoOpPolicyPlugin>;
      };
  normalizedBaselineOrPolicy: string;
}

export interface RerunDigestSummary {
  tupleHashSha256: string;
  manifestHashSha256: string;
  sourceTraceHashSha256: string;
  resultHashSha256: string;
  summaryCsvHashSha256: string;
  timeseriesCsvHashSha256: string;
}

export interface RerunContractResult {
  scenarioId: string;
  profileId: CanonicalProfileId;
  seed: number;
  baselineOrPolicy: string;
  tickCount: number;
  outputTag: string;
  manifest: ReturnType<typeof buildRunManifest>;
  sourceTrace: Awaited<ReturnType<typeof createSourceTraceArtifact>>;
  result: ReturnType<typeof runBaselineBatch>['runs'][number]['result'];
  summaryCsv: string;
  timeseriesCsv: string;
  digestSummary: RerunDigestSummary;
}

function clampTickCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 120;
  }
  return Math.max(1, Math.round(value as number));
}

function normalizePolicyToken(token: string): string {
  if (token.startsWith('policy-')) {
    return token.slice('policy-'.length);
  }
  return token;
}

function resolveBaselineOrPolicy(value: string): BaselineOrPolicyResolution {
  if (isRuntimeBaseline(value)) {
    return {
      baseline: value,
      policyRuntime: { mode: 'off' },
      normalizedBaselineOrPolicy: `baseline:${value}`,
    };
  }

  if (value.startsWith('baseline:')) {
    const baseline = value.slice('baseline:'.length);
    if (!isRuntimeBaseline(baseline)) {
      throw new Error(`Unknown baseline in baseline_or_policy: '${baseline}'.`);
    }
    return {
      baseline,
      policyRuntime: { mode: 'off' },
      normalizedBaselineOrPolicy: `baseline:${baseline}`,
    };
  }

  if (value.startsWith('policy:')) {
    const payload = value.slice('policy:'.length);
    const [pluginTokenRaw, baselineRaw] = payload.split('@', 2);
    const pluginToken = normalizePolicyToken(pluginTokenRaw);
    if (!isPolicyPluginId(pluginToken)) {
      throw new Error(`Unknown policy plugin in baseline_or_policy: '${pluginTokenRaw}'.`);
    }

    const baseline = baselineRaw
      ? (() => {
          if (!isRuntimeBaseline(baselineRaw)) {
            throw new Error(`Unknown baseline in baseline_or_policy: '${baselineRaw}'.`);
          }
          return baselineRaw;
        })()
      : 'max-rsrp';

    const pluginFactory = () => {
      switch (pluginToken) {
        case 'invalid-action-probe':
          return createInvalidActionProbePolicyPlugin();
        case 'noop':
          return createNoOpPolicyPlugin();
        case 'greedy-sinr':
        default:
          return createGreedySinrPolicyPlugin();
      }
    };

    return {
      baseline,
      policyRuntime: {
        mode: 'on',
        pluginFactory,
      },
      normalizedBaselineOrPolicy: `policy:${pluginToken}@${baseline}`,
    };
  }

  throw new Error(
    `Unknown baseline_or_policy '${value}'. Use baseline name or 'policy:<plugin-id>[@baseline]'.`,
  );
}

function sanitizeOutputTagToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function assertResolvedSourceIdsKnown(
  sourceTrace: Awaited<ReturnType<typeof createSourceTraceArtifact>>,
): void {
  const missing = new Set<string>();
  for (const sourceIds of Object.values(sourceTrace.resolvedParameterSources)) {
    for (const sourceId of sourceIds) {
      if (!sourceTrace.resolvedSourceLinks[sourceId]) {
        missing.add(sourceId);
      }
    }
  }

  if (missing.size > 0) {
    throw new Error(
      `Unknown source IDs detected in rerun trace payload: ${[...missing].sort().join(', ')}.`,
    );
  }
}

async function buildDigestSummary(options: {
  scenarioId: string;
  profileId: CanonicalProfileId;
  seed: number;
  baselineOrPolicy: string;
  runtimeOverrides: DeepPartial<PaperProfile>;
  manifest: ReturnType<typeof buildRunManifest>;
  sourceTrace: Awaited<ReturnType<typeof createSourceTraceArtifact>>;
  result: ReturnType<typeof runBaselineBatch>['runs'][number]['result'];
  summaryCsv: string;
  timeseriesCsv: string;
}): Promise<RerunDigestSummary> {
  const tuplePayload = {
    scenario_id: options.scenarioId,
    profile_id: options.profileId,
    seed: options.seed,
    baseline_or_policy: options.baselineOrPolicy,
    runtime_overrides: options.runtimeOverrides,
  };
  const tupleHashSha256 = await sha256Hex(stableStringify(tuplePayload));

  // Exclude runtime timestamps so fixed input tuples can be compared deterministically.
  const manifestComparable = {
    ...options.manifest,
    started_at_utc: '<deterministic>',
    finished_at_utc: '<deterministic>',
  };
  const resultComparable = {
    ...options.result,
    metadata: {
      ...options.result.metadata,
      generatedAtUtc: '<deterministic>',
    },
  };

  return {
    tupleHashSha256,
    manifestHashSha256: await sha256Hex(stableStringify(manifestComparable)),
    sourceTraceHashSha256: await sha256Hex(stableStringify(options.sourceTrace)),
    resultHashSha256: await sha256Hex(stableStringify(resultComparable)),
    summaryCsvHashSha256: await sha256Hex(options.summaryCsv),
    timeseriesCsvHashSha256: await sha256Hex(options.timeseriesCsv),
  };
}

export async function runRerunContract(
  input: RerunContractInput,
): Promise<RerunContractResult> {
  if (!input.scenarioId || input.scenarioId.trim().length === 0) {
    throw new Error('scenario_id must be a non-empty string.');
  }
  if (!isCanonicalProfileId(input.profileId)) {
    throw new Error(`Unknown profile_id '${input.profileId}'.`);
  }

  const seed = Number.isFinite(input.seed) ? Math.round(input.seed) : NaN;
  if (!Number.isFinite(seed)) {
    throw new Error('seed must be a finite integer.');
  }

  const tickCount = clampTickCount(input.tickCount);
  const runtimeOverrides = input.runtimeOverrides ?? {};
  const resolution = resolveBaselineOrPolicy(input.baselineOrPolicy);
  const profile = loadPaperProfile(input.profileId, runtimeOverrides);

  const sourceMap = loadProfileSourceMap(input.profileId);
  const assumptionIds = extractAssumptionIdsFromSourceMap(sourceMap);
  const sourceCatalog = getSourceCatalog();
  const sourceCatalogById = new Set(sourceCatalog.map((entry) => entry.sourceId));
  for (const sourceIds of Object.values(sourceMap.sources)) {
    for (const sourceId of sourceIds) {
      if (!sourceCatalogById.has(sourceId)) {
        throw new Error(`Unknown source ID '${sourceId}' in profile source map.`);
      }
    }
  }

  const batch = runBaselineBatch({
    profile,
    seed,
    baselines: [resolution.baseline],
    tickCount,
    scenarioId: input.scenarioId,
    captureSnapshots: true,
    policyRuntime: resolution.policyRuntime,
  });
  const run = batch.runs[0];
  if (!run) {
    throw new Error('Rerun contract generated no run output.');
  }
  const latestSnapshot = run.snapshots?.[run.snapshots.length - 1] ?? null;

  const [profileChecksumSha256, sourceCatalogChecksumSha256] = await Promise.all([
    computeProfileChecksum(profile),
    computeSourceCatalogChecksum(),
  ]);

  const sourceTrace = await createSourceTraceArtifact({
    scenarioId: run.result.metadata.scenarioId,
    profileId: input.profileId,
    baseline: run.baseline,
    algorithmFidelity: profile.handover.algorithmFidelity,
    seed,
    playbackRate: run.result.metadata.playbackRate,
    runtimeOverrides,
    assumptionIds,
    policyRuntime: run.result.metadata.policyRuntime,
    beamScheduler: latestSnapshot?.beamScheduler ?? null,
    coupledDecisionStats: latestSnapshot?.coupledDecisionStats ?? null,
    assumptions: ['rerun-contract execution'],
  });
  assertResolvedSourceIdsKnown(sourceTrace);

  const manifest = buildRunManifest({
    scenarioId: run.result.metadata.scenarioId,
    profile,
    baseline: run.baseline,
    seed,
    playbackRate: run.result.metadata.playbackRate,
    profileChecksumSha256,
    sourceCatalogChecksumSha256,
    resolvedAssumptionIds: run.result.metadata.resolvedAssumptionIds,
    runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
    policyRuntime: run.result.metadata.policyRuntime,
    beamScheduler: latestSnapshot?.beamScheduler ?? null,
    coupledDecisionStats: latestSnapshot?.coupledDecisionStats ?? null,
  });

  const digestSummary = await buildDigestSummary({
    scenarioId: input.scenarioId,
    profileId: input.profileId,
    seed,
    baselineOrPolicy: resolution.normalizedBaselineOrPolicy,
    runtimeOverrides,
    manifest,
    sourceTrace,
    result: run.result,
    summaryCsv: batch.summaryCsv,
    timeseriesCsv: run.timeseriesCsv,
  });

  const outputTag = sanitizeOutputTagToken(
    `${input.scenarioId}_${input.profileId}_${seed}_${resolution.normalizedBaselineOrPolicy}`,
  );

  return {
    scenarioId: input.scenarioId,
    profileId: input.profileId,
    seed,
    baselineOrPolicy: resolution.normalizedBaselineOrPolicy,
    tickCount,
    outputTag,
    manifest,
    sourceTrace,
    result: run.result,
    summaryCsv: batch.summaryCsv,
    timeseriesCsv: run.timeseriesCsv,
    digestSummary,
  };
}
