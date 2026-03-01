import type { PaperProfile } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-requirements.md (FR-028)
 * - sdd/completed/beamHO-bench-sdd.md (M2b runtime parameter audit)
 *
 * Notes:
 * - This module tracks runtime consumption of required RLF/HO parameters.
 * - Audit coverage is recorded per simulation run and exported for reproducibility.
 */

export const REQUIRED_RUNTIME_PARAMETER_AUDIT_KEYS = [
  'rlfStateMachine.qOutDb',
  'rlfStateMachine.qInDb',
  'rlfStateMachine.t310Ms',
  'rlfStateMachine.n310',
  'rlfStateMachine.n311',
  'rlfStateMachine.l3FilterK',
  'rlfStateMachine.harqMaxRetx',
  'rlfStateMachine.rlcMaxRetx',
  'rlfStateMachine.preambleMsg3MaxRetx',
  'rlfStateMachine.raResponseTimerSubframes',
  'rlfStateMachine.contentionResolutionTimerSubframes',
] as const;

export type RuntimeParameterAuditKey = (typeof REQUIRED_RUNTIME_PARAMETER_AUDIT_KEYS)[number];

export interface RuntimeParameterAuditUsage {
  count: number;
  lastValue: number | null;
}

export interface RuntimeParameterAuditSnapshot {
  profileId: string;
  scenarioId: string;
  tick: number;
  pass: boolean;
  requiredKeys: RuntimeParameterAuditKey[];
  touchedKeys: RuntimeParameterAuditKey[];
  missingKeys: RuntimeParameterAuditKey[];
  usage: Record<RuntimeParameterAuditKey, RuntimeParameterAuditUsage>;
}

type RlfStateMachineConfig = PaperProfile['rlfStateMachine'];

export class RuntimeParameterAuditSession {
  private readonly usageMap = new Map<RuntimeParameterAuditKey, RuntimeParameterAuditUsage>();
  private readonly requiredKeys = [...REQUIRED_RUNTIME_PARAMETER_AUDIT_KEYS];

  constructor(
    private readonly profileId: string,
    private readonly scenarioId: string,
  ) {}

  reset(): void {
    this.usageMap.clear();
  }

  mark(key: RuntimeParameterAuditKey, value: number): void {
    const current = this.usageMap.get(key) ?? { count: 0, lastValue: null };
    current.count += 1;
    current.lastValue = value;
    this.usageMap.set(key, current);
  }

  snapshot(tick: number): RuntimeParameterAuditSnapshot {
    const usage = {} as Record<RuntimeParameterAuditKey, RuntimeParameterAuditUsage>;

    for (const key of this.requiredKeys) {
      const entry = this.usageMap.get(key) ?? { count: 0, lastValue: null };
      usage[key] = {
        count: entry.count,
        lastValue: entry.lastValue,
      };
    }

    const touchedKeys = this.requiredKeys.filter((key) => usage[key].count > 0);
    const missingKeys = this.requiredKeys.filter((key) => usage[key].count === 0);

    return {
      profileId: this.profileId,
      scenarioId: this.scenarioId,
      tick,
      pass: missingKeys.length === 0,
      requiredKeys: [...this.requiredKeys],
      touchedKeys,
      missingKeys,
      usage,
    };
  }
}

export function createRuntimeParameterAuditSession(options: {
  profileId: string;
  scenarioId: string;
}): RuntimeParameterAuditSession {
  return new RuntimeParameterAuditSession(options.profileId, options.scenarioId);
}

export function markRlfStateMachineParameterSet(
  config: RlfStateMachineConfig,
  audit: RuntimeParameterAuditSession | undefined,
): void {
  if (!audit) {
    return;
  }

  audit.mark('rlfStateMachine.qOutDb', config.qOutDb);
  audit.mark('rlfStateMachine.qInDb', config.qInDb);
  audit.mark('rlfStateMachine.t310Ms', config.t310Ms);
  audit.mark('rlfStateMachine.n310', config.n310);
  audit.mark('rlfStateMachine.n311', config.n311);
  audit.mark('rlfStateMachine.l3FilterK', config.l3FilterK);
  audit.mark('rlfStateMachine.harqMaxRetx', config.harqMaxRetx);
  audit.mark('rlfStateMachine.rlcMaxRetx', config.rlcMaxRetx);
  audit.mark('rlfStateMachine.preambleMsg3MaxRetx', config.preambleMsg3MaxRetx);
  audit.mark('rlfStateMachine.raResponseTimerSubframes', config.raResponseTimerSubframes);
  audit.mark(
    'rlfStateMachine.contentionResolutionTimerSubframes',
    config.contentionResolutionTimerSubframes,
  );
}
