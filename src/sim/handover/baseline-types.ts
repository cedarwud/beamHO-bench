import type { HandoverBaseline, PaperProfile } from '@/config/paper-profiles/types';
import type { LinkSample } from '@/sim/channel/link-budget';
import type { PolicyRuntimeSession } from '@/sim/policy/runtime-session';
import type { BeamSchedulerSnapshot, CoupledDecisionStats } from '@/sim/scheduler/types';
import type { HOEvent, SatelliteState, UEState } from '@/sim/types';

export type RuntimeBaseline = Extract<
  HandoverBaseline,
  'max-rsrp' | 'max-elevation' | 'max-remaining-time' | 'a3' | 'a4' | 'cho' | 'mc-ho'
>;

export interface CandidateMemory {
  satId: number;
  beamId: number;
  elapsedMs: number;
  targetMs?: number;
}

export interface UeTriggerMemory {
  a3?: CandidateMemory;
  a4?: CandidateMemory;
  cho?: CandidateMemory;
}

export type TriggerMemoryStore = Map<number, UeTriggerMemory>;

export interface HandoverDecisionResult {
  nextUes: UEState[];
  events: HOEvent[];
  meanSinrDb: number;
  meanThroughputMbps: number;
  nextTriggerMemory: TriggerMemoryStore;
  coupledDecisionStats: CoupledDecisionStats;
}

export interface DecisionContext {
  tick: number;
  timeSec: number;
  timeStepSec: number;
  profile: PaperProfile;
  satellites: SatelliteState[];
  ues: UEState[];
  baseline: RuntimeBaseline;
  triggerMemory?: TriggerMemoryStore;
  policyRuntime?: PolicyRuntimeSession;
  beamScheduler?: BeamSchedulerSnapshot;
}

export interface CandidateDecision {
  selected: LinkSample | null;
  triggerEvent: boolean;
  reasonSuffix?: string;
  secondary?: LinkSample | null;
  prepared?: CandidateMemory | null;
}
