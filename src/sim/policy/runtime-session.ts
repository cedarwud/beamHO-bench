import type { PaperProfile } from '@/config/paper-profiles/types';
import { estimateRemainingServiceSec, isFullAlgorithmFidelity, sampleKey } from '@/sim/handover/baseline-helpers';
import type { BeamState } from '@/sim/types';
import { createNoOpPolicyPlugin } from './noop-plugin';
import {
  adaptPolicyAction,
  createDefaultHoldAction,
  normalizeAction,
  type PolicyDecisionRequest,
  type PolicyDecisionResolution,
} from './runtime-adapter';
import type {
  PolicyInitContext,
  PolicyMode,
  PolicyObservation,
  PolicyPlugin,
  PolicyRuntimeSnapshot,
  PolicyTransition,
} from './types';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-rl-plugin-sdd.md
 * - PAP-2024-MADRL-CORE
 * - PAP-2025-DAPS-CORE
 *
 * Notes:
 * - Session handles plugin lifecycle, deterministic counters, and trace metadata.
 */

export interface PolicyRuntimeSessionOptions {
  mode?: PolicyMode;
  plugin?: PolicyPlugin;
  profile: PaperProfile;
  seed: number;
  scenarioId: string;
}

export type { PolicyDecisionRequest, PolicyDecisionResolution };

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Promise<unknown>).then === 'function'
  );
}

function cloneStringArray(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

function cloneStringArrayMap(value: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(value)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([featureId, sourceIds]) => [featureId, cloneStringArray(sourceIds)]),
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${pairs.join(',')}}`;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildInitContext(options: PolicyRuntimeSessionOptions): PolicyInitContext {
  return {
    scenarioId: options.scenarioId,
    profileId: options.profile.profileId,
    seed: options.seed,
    mode: options.profile.mode,
    algorithmFidelity: options.profile.handover.algorithmFidelity,
  };
}

export class PolicyRuntimeSession {
  private readonly mode: PolicyMode;
  private readonly plugin: PolicyPlugin;
  private readonly profile: PaperProfile;
  private readonly seed: number;
  private readonly scenarioId: string;
  private readonly runtimeConfigHash: string;
  private readonly stateFeatureSourceMap: Record<string, string[]>;
  private readonly rewardSourceIds: string[];
  private decisionCount = 0;
  private rejectionCount = 0;
  private readonly rejectionReasons = new Map<string, number>();
  private pluginInitFailed = false;

  constructor(options: PolicyRuntimeSessionOptions) {
    this.mode = options.mode ?? 'off';
    this.plugin = options.plugin ?? createNoOpPolicyPlugin();
    this.profile = options.profile;
    this.seed = options.seed;
    this.scenarioId = options.scenarioId;
    this.stateFeatureSourceMap = cloneStringArrayMap(
      this.plugin.metadata.stateFeatureSourceMap,
    );
    this.rewardSourceIds = cloneStringArray(this.plugin.metadata.rewardSourceIds);
    this.runtimeConfigHash = fnv1a32(
      stableStringify({
        mode: this.mode,
        scenarioId: this.scenarioId,
        profileId: this.profile.profileId,
        seed: this.seed,
        policyId: this.plugin.metadata.policyId,
        policyVersion: this.plugin.metadata.policyVersion,
        checkpointHash: this.plugin.metadata.checkpointHash,
      }),
    );

    if (this.mode === 'on') {
      this.initializePlugin();
    }
  }

  isEnabled(): boolean {
    return this.mode === 'on';
  }

  private initializePlugin(): void {
    try {
      const result = this.plugin.init(
        buildInitContext({
          mode: this.mode,
          plugin: this.plugin,
          profile: this.profile,
          seed: this.seed,
          scenarioId: this.scenarioId,
        }),
      );
      if (isPromiseLike(result)) {
        this.pluginInitFailed = true;
        this.bumpRejection('plugin-init-async-unsupported');
        return;
      }
      this.pluginInitFailed = false;
    } catch {
      this.pluginInitFailed = true;
      this.bumpRejection('plugin-init-error');
    }
  }

  reset(): void {
    this.decisionCount = 0;
    this.rejectionCount = 0;
    this.rejectionReasons.clear();
    this.pluginInitFailed = false;

    if (this.mode !== 'on') {
      return;
    }

    try {
      const resetResult = this.plugin.reset();
      if (isPromiseLike(resetResult)) {
        this.pluginInitFailed = true;
        this.bumpRejection('plugin-reset-async-unsupported');
      }
    } catch {
      this.pluginInitFailed = true;
      this.bumpRejection('plugin-reset-error');
    }

    this.initializePlugin();
  }

  snapshot(): PolicyRuntimeSnapshot {
    return {
      policyMode: this.mode,
      policyId: this.mode === 'on' ? this.plugin.metadata.policyId : null,
      policyVersion: this.mode === 'on' ? this.plugin.metadata.policyVersion : null,
      checkpointHash: this.mode === 'on' ? this.plugin.metadata.checkpointHash : null,
      runtimeConfigHash: this.runtimeConfigHash,
      decisionCount: this.decisionCount,
      rejectionCount: this.rejectionCount,
      rejectionReasons: Object.fromEntries(
        [...this.rejectionReasons.entries()].sort((left, right) => left[0].localeCompare(right[0])),
      ),
      stateFeatureSourceMap:
        this.mode === 'on' ? cloneStringArrayMap(this.stateFeatureSourceMap) : {},
      rewardSourceIds: this.mode === 'on' ? [...this.rewardSourceIds] : [],
    };
  }

  resolveDecision(request: PolicyDecisionRequest): PolicyDecisionResolution {
    this.decisionCount += 1;

    const observation = this.buildObservation(request);
    let action = createDefaultHoldAction('policy-default-hold');
    let rejectionReason: string | null = null;

    if (this.mode !== 'on') {
      return adaptPolicyAction(this.profile, request, action);
    }

    if (this.pluginInitFailed) {
      rejectionReason = 'plugin-not-ready';
      action = createDefaultHoldAction('plugin-not-ready');
    } else {
      const observeFailure = this.observePolicy(observation);
      if (observeFailure) {
        rejectionReason = observeFailure;
        action = createDefaultHoldAction(observeFailure);
      } else {
        const actResult = this.runPolicyAct(observation);
        action = actResult.action;
        rejectionReason = actResult.rejectionReason;
      }
    }

    const adapted = adaptPolicyAction(this.profile, request, action);
    const finalRejectionReason = rejectionReason ?? adapted.rejectionReason;

    if (finalRejectionReason) {
      this.bumpRejection(finalRejectionReason);
    }

    this.updatePolicy({
      observation,
      action,
      accepted: finalRejectionReason === null,
      rejectionReason: finalRejectionReason,
    });

    return {
      ...adapted,
      rejectionReason: finalRejectionReason,
    };
  }

  private observePolicy(observation: PolicyObservation): string | null {
    try {
      const result = this.plugin.observe(observation);
      if (isPromiseLike(result)) {
        return 'plugin-observe-async-unsupported';
      }
      return null;
    } catch {
      return 'plugin-observe-error';
    }
  }

  private runPolicyAct(observation: PolicyObservation): {
    action: ReturnType<typeof createDefaultHoldAction>;
    rejectionReason: string | null;
  } {
    try {
      const result = this.plugin.act(observation);
      if (isPromiseLike(result)) {
        return {
          action: createDefaultHoldAction('plugin-act-async-unsupported'),
          rejectionReason: 'plugin-act-async-unsupported',
        };
      }

      const normalized = normalizeAction(result);
      if (!normalized) {
        return {
          action: createDefaultHoldAction('invalid-action-shape'),
          rejectionReason: 'invalid-action-shape',
        };
      }

      return {
        action: normalized,
        rejectionReason: null,
      };
    } catch {
      return {
        action: createDefaultHoldAction('plugin-act-error'),
        rejectionReason: 'plugin-act-error',
      };
    }
  }

  private updatePolicy(transition: PolicyTransition): void {
    if (!this.plugin.update) {
      return;
    }

    try {
      const result = this.plugin.update(transition);
      if (isPromiseLike(result)) {
        this.bumpRejection('plugin-update-async-unsupported');
      }
    } catch {
      this.bumpRejection('plugin-update-error');
    }
  }

  private bumpRejection(reason: string): void {
    this.rejectionCount += 1;
    this.rejectionReasons.set(reason, (this.rejectionReasons.get(reason) ?? 0) + 1);
  }

  private buildObservation(request: PolicyDecisionRequest): PolicyObservation {
    const candidates = [...request.links]
      .sort((left, right) => {
        if (left.rsrpDbm !== right.rsrpDbm) {
          return right.rsrpDbm - left.rsrpDbm;
        }
        if (left.sinrDb !== right.sinrDb) {
          return right.sinrDb - left.sinrDb;
        }
        if (left.satId !== right.satId) {
          return left.satId - right.satId;
        }
        return left.beamId - right.beamId;
      })
      .map((sample) => ({
        satId: sample.satId,
        beamId: sample.beamId,
        rsrpDbm: sample.rsrpDbm,
        sinrDb: sample.sinrDb,
        elevationDeg: request.satById.get(sample.satId)?.elevationDeg ?? -90,
        remainingVisibilitySec: estimateRemainingServiceSec(
          this.profile,
          request.ue,
          request.beamByKey.get(sampleKey(sample.satId, sample.beamId)) as BeamState | undefined,
        ),
      }));

    return {
      tick: request.tick,
      timeSec: request.timeSec,
      ueId: request.ue.id,
      hoState: request.ue.hoState,
      servingSatId: request.ue.servingSatId,
      servingBeamId: request.ue.servingBeamId,
      secondarySatId: request.ue.secondarySatId ?? null,
      secondaryBeamId: request.ue.secondaryBeamId ?? null,
      preparedSatId: request.ue.choPreparedSatId ?? null,
      preparedBeamId: request.ue.choPreparedBeamId ?? null,
      candidates,
      schedulerFlags: {
        prepared:
          request.ue.choPreparedSatId !== null &&
          request.ue.choPreparedSatId !== undefined &&
          request.ue.choPreparedBeamId !== null &&
          request.ue.choPreparedBeamId !== undefined,
        dualLinkCapable: request.baseline === 'mc-ho' && isFullAlgorithmFidelity(this.profile),
      },
      runtime: {
        mode: this.profile.mode,
        profileId: this.profile.profileId,
        seed: this.seed,
        algorithmFidelity: this.profile.handover.algorithmFidelity,
      },
    };
  }
}
