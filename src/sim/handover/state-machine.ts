import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  markRlfStateMachineParameterSet,
  type RuntimeParameterAuditSession,
} from '@/sim/audit/runtime-parameter-audit';
import type { HOEvent, UEState } from '@/sim/types';

/**
 * Provenance:
 * - STD-3GPP-TS38.331-RRC
 * - STD-3GPP-TS38.321-MAC
 * - STD-3GPP-TS38.322-RLC
 */

export interface StateMachineResult {
  ues: UEState[];
  hofDelta: {
    state2: number;
    state3: number;
  };
  rlfDelta: {
    state1: number;
    state2: number;
  };
}

interface StateMachineInput {
  profile: PaperProfile;
  ues: UEState[];
  events: HOEvent[];
  runtimeParameterAudit?: RuntimeParameterAuditSession;
}

function applyL3Filter(previous: number, sample: number, filterK: number): number {
  const k = Math.max(0, Math.trunc(filterK));
  if (k === 0) {
    return sample;
  }

  // Source: STD-3GPP-TS38.331-RRC
  // L3 filtering uses coefficient K; here alpha is 1 / 2^K.
  const alpha = 1 / Math.pow(2, k);
  return previous + alpha * (sample - previous);
}

function computeRecoveryBudgetMs(profile: PaperProfile): number {
  const cfg = profile.rlfStateMachine;

  // Source: STD-3GPP-TS38.321-MAC
  // Source: STD-3GPP-TS38.322-RLC
  // Retransmission counters are converted with 1 ms/subframe granularity.
  const retransmissionBudgetMs =
    cfg.harqMaxRetx + cfg.rlcMaxRetx + cfg.preambleMsg3MaxRetx;
  const raBudgetMs = cfg.raResponseTimerSubframes;
  const contentionBudgetMs = cfg.contentionResolutionTimerSubframes;

  return Math.max(
    retransmissionBudgetMs + raBudgetMs + contentionBudgetMs,
    1,
  );
}

export function applyHandoverStateMachine(input: StateMachineInput): StateMachineResult {
  const eventUeIds = new Set(input.events.map((event) => event.ueId));
  const cfg = input.profile.rlfStateMachine;
  const timeStepMs = Math.max(1, Math.round(input.profile.timeStepSec * 1000));

  // FR-028 runtime audit requires full configured RLF/HO parameter-set consumption coverage.
  markRlfStateMachineParameterSet(cfg, input.runtimeParameterAudit);

  const recoveryBudgetMs = computeRecoveryBudgetMs(input.profile);

  let rlfState1 = 0;
  let rlfState2 = 0;
  let hofState2 = 0;
  let hofState3 = 0;

  const qOutDb = cfg.qOutDb;
  const qInDb = cfg.qInDb;

  const nextUes = input.ues.map((ue) => {
    let nextState = ue.hoState;

    // Source: PAP-2022-A4EVENT-CORE
    // Three-state HO model: state1 (pre), state2 (command), state3 (execution).
    if (eventUeIds.has(ue.id)) {
      nextState = 2;
    } else if (ue.hoState === 2) {
      nextState = 3;
    } else if (ue.hoState === 3) {
      nextState = 1;
    }

    const previousL3 = Number.isFinite(ue.l3SinrDb) ? (ue.l3SinrDb as number) : ue.sinrDb;
    const l3SinrDb = applyL3Filter(previousL3, ue.sinrDb, cfg.l3FilterK);
    const nextQOutCounter = l3SinrDb < qOutDb ? (ue.qOutCounter ?? 0) + 1 : 0;
    const nextQInCounter = l3SinrDb > qInDb ? (ue.qInCounter ?? 0) + 1 : 0;

    let nextRlfTimerMs = ue.rlfTimerMs;
    let nextRecoveryBudgetMs = ue.rlfRecoveryBudgetMs ?? null;
    let rlfDeclared = false;

    if (ue.servingSatId === null) {
      nextRlfTimerMs = null;
      nextRecoveryBudgetMs = null;
    } else {
      if (nextRlfTimerMs === null && nextQOutCounter >= cfg.n310) {
        nextRlfTimerMs = cfg.t310Ms;
      }

      if (nextRlfTimerMs !== null) {
        if (nextQInCounter >= cfg.n311) {
          nextRlfTimerMs = null;
          nextRecoveryBudgetMs = null;
        } else {
          nextRlfTimerMs = Math.max(nextRlfTimerMs - timeStepMs, 0);
        }
      }

      if (nextRlfTimerMs === 0) {
        if (nextRecoveryBudgetMs === null) {
          nextRecoveryBudgetMs = recoveryBudgetMs;
        }

        if (nextQInCounter >= cfg.n311 && l3SinrDb >= qInDb) {
          nextRlfTimerMs = null;
          nextRecoveryBudgetMs = null;
        } else {
          nextRecoveryBudgetMs = Math.max(nextRecoveryBudgetMs - timeStepMs, 0);
          if (nextRecoveryBudgetMs === 0 && l3SinrDb < qOutDb) {
            rlfDeclared = true;
          }
        }
      }
    }

    if (rlfDeclared) {
      if (nextState === 1) {
        rlfState1 += 1;
      } else if (nextState === 2) {
        rlfState2 += 1;
      }

      if (nextState === 2) {
        hofState2 += 1;
      } else if (nextState === 3) {
        hofState3 += 1;
      }

      nextState = 1;
    }

    if (!rlfDeclared && ue.hoState === 2 && !eventUeIds.has(ue.id) && l3SinrDb < qOutDb) {
      hofState2 += 1;
    }

    if (!rlfDeclared && ue.hoState === 3 && l3SinrDb < qOutDb) {
      hofState3 += 1;
    }

    return {
      ...ue,
      servingSatId: rlfDeclared ? null : ue.servingSatId,
      servingBeamId: rlfDeclared ? null : ue.servingBeamId,
      secondarySatId: rlfDeclared ? null : (ue.secondarySatId ?? null),
      secondaryBeamId: rlfDeclared ? null : (ue.secondaryBeamId ?? null),
      choPreparedSatId: rlfDeclared ? null : (ue.choPreparedSatId ?? null),
      choPreparedBeamId: rlfDeclared ? null : (ue.choPreparedBeamId ?? null),
      choPreparedElapsedMs: rlfDeclared ? null : (ue.choPreparedElapsedMs ?? null),
      choPreparedTargetMs: rlfDeclared ? null : (ue.choPreparedTargetMs ?? null),
      l3SinrDb,
      qOutCounter: rlfDeclared || ue.servingSatId === null ? 0 : nextQOutCounter,
      qInCounter: rlfDeclared || ue.servingSatId === null ? 0 : nextQInCounter,
      hoState: nextState,
      rlfTimerMs: rlfDeclared ? null : nextRlfTimerMs,
      rlfRecoveryBudgetMs: rlfDeclared ? null : nextRecoveryBudgetMs,
    };
  });

  return {
    ues: nextUes,
    hofDelta: {
      state2: hofState2,
      state3: hofState3,
    },
    rlfDelta: {
      state1: rlfState1,
      state2: rlfState2,
    },
  };
}
