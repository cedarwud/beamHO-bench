import type { PaperProfile } from '@/config/paper-profiles/types';
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
}

export function applyHandoverStateMachine(input: StateMachineInput): StateMachineResult {
  const eventUeIds = new Set(input.events.map((event) => event.ueId));

  let rlfState1 = 0;
  let rlfState2 = 0;
  let hofState2 = 0;
  let hofState3 = 0;

  const qOutDb = input.profile.rlfStateMachine.qOutDb;

  const nextUes = input.ues.map((ue) => {
    let nextState = ue.hoState;

    if (eventUeIds.has(ue.id)) {
      nextState = 2;
    } else if (ue.hoState === 2) {
      nextState = 3;
    } else if (ue.hoState === 3) {
      nextState = 1;
    }

    if (ue.servingSatId !== null && ue.sinrDb < qOutDb) {
      if (nextState === 1) {
        rlfState1 += 1;
      } else if (nextState === 2) {
        rlfState2 += 1;
      }
    }

    if (ue.hoState === 2 && !eventUeIds.has(ue.id) && ue.sinrDb < qOutDb) {
      hofState2 += 1;
    }

    if (ue.hoState === 3 && ue.sinrDb < qOutDb) {
      hofState3 += 1;
    }

    return {
      ...ue,
      hoState: nextState,
      rlfTimerMs: ue.sinrDb < qOutDb ? input.profile.rlfStateMachine.t310Ms : null,
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
