/**
 * Provenance:
 * - sdd/pending/beamHO-bench-joint-beamho-sdd.md
 * - PAP-2025-DAPS-CORE
 * - ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
 *
 * Notes:
 * - This file defines scheduler state contracts used by coupled/uncoupled modes.
 */

export type BeamSchedulerMode = 'uncoupled' | 'coupled';

export interface BeamScheduleState {
  tick: number;
  satId: number;
  beamId: number;
  isActive: boolean;
  freqBlockId: number | null;
  powerClass: 'active' | 'sleep';
  windowId: number;
}

export interface BeamSchedulerEvent {
  tick: number;
  timeSec: number;
  satId: number;
  windowId: number;
  type: 'scheduler-window-update';
  activeBeamCount: number;
  totalBeamCount: number;
  reason: string;
}

export interface BeamSchedulerSummary {
  mode: BeamSchedulerMode;
  windowId: number;
  totalBeamCount: number;
  activeBeamCount: number;
  utilizationRatio: number;
  fairnessIndex: number;
  scheduleStateHash: string;
}

export interface BeamSchedulerSnapshot {
  tick: number;
  timeSec: number;
  summary: BeamSchedulerSummary;
  states: BeamScheduleState[];
  events: BeamSchedulerEvent[];
}

export interface CoupledDecisionStats {
  mode: BeamSchedulerMode;
  blockedByScheduleHandoverCount: number;
  schedulerInducedInterruptionSec: number;
  blockedReasons: Record<string, number>;
}
