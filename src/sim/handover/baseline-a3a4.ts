import type { PaperProfile } from '@/config/paper-profiles/types';
import type { LinkSample } from '@/sim/channel/link-budget';
import type { UEState } from '@/sim/types';
import type { CandidateDecision, UeTriggerMemory } from './baseline-types';
import { meetsA3LikeCondition, meetsAbsoluteThreshold } from './baseline-helpers';

export function resolveA3Decision(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  bestSample: LinkSample | null;
  memory: UeTriggerMemory;
  timeStepSec: number;
}): CandidateDecision {
  const {
    profile,
    ue,
    links,
    servingSample,
    bestSample,
    memory,
    timeStepSec,
  } = options;

  if (links.length === 0 || !bestSample) {
    delete memory.a3;
    return { selected: null, triggerEvent: false };
  }

  if (!servingSample) {
    delete memory.a3;
    return {
      selected: bestSample,
      triggerEvent: ue.servingSatId !== null,
      reasonSuffix: 'forced',
    };
  }

  if (
    bestSample.satId === servingSample.satId &&
    bestSample.beamId === servingSample.beamId
  ) {
    delete memory.a3;
    return { selected: servingSample, triggerEvent: false };
  }

  // Source: PAP-2022-A4EVENT-CORE
  // A3 condition: neighbor is better than serving by offset plus hysteresis.
  const meetsA3 = meetsA3LikeCondition(profile, servingSample, bestSample);
  if (!meetsA3) {
    delete memory.a3;
    return { selected: servingSample, triggerEvent: false };
  }

  const tttMs = Math.max(profile.handover.params.a3TttMs ?? 0, 0);
  if (tttMs === 0) {
    delete memory.a3;
    return { selected: bestSample, triggerEvent: true };
  }

  const previous = memory.a3;
  const sameCandidate =
    previous &&
    previous.satId === bestSample.satId &&
    previous.beamId === bestSample.beamId;
  const elapsedMs = (sameCandidate ? previous.elapsedMs : 0) + timeStepSec * 1000;

  memory.a3 = {
    satId: bestSample.satId,
    beamId: bestSample.beamId,
    elapsedMs,
  };

  if (elapsedMs >= tttMs) {
    delete memory.a3;
    return { selected: bestSample, triggerEvent: true, reasonSuffix: 'ttt' };
  }

  return { selected: servingSample, triggerEvent: false };
}

export function resolveA4Decision(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  bestSample: LinkSample | null;
  memory: UeTriggerMemory;
  timeStepSec: number;
}): CandidateDecision {
  const {
    profile,
    ue,
    links,
    servingSample,
    bestSample,
    memory,
    timeStepSec,
  } = options;

  if (links.length === 0 || !bestSample) {
    delete memory.a4;
    return { selected: null, triggerEvent: false };
  }

  const meetsThreshold = meetsAbsoluteThreshold(profile, bestSample);

  // Source: PAP-2022-A4EVENT-CORE
  // A4 condition: target quality crosses the absolute threshold.
  if (!servingSample) {
    delete memory.a4;
    return {
      selected: meetsThreshold ? bestSample : null,
      triggerEvent: ue.servingSatId !== null && meetsThreshold,
      reasonSuffix: 'forced',
    };
  }

  if (
    bestSample.satId === servingSample.satId &&
    bestSample.beamId === servingSample.beamId
  ) {
    delete memory.a4;
    return { selected: servingSample, triggerEvent: false };
  }

  if (!meetsThreshold) {
    delete memory.a4;
    return { selected: servingSample, triggerEvent: false };
  }

  const tttMs = Math.max(profile.handover.params.a3TttMs ?? 0, 0);
  if (tttMs === 0) {
    delete memory.a4;
    return { selected: bestSample, triggerEvent: true };
  }

  const previous = memory.a4;
  const sameCandidate =
    previous &&
    previous.satId === bestSample.satId &&
    previous.beamId === bestSample.beamId;
  const elapsedMs = (sameCandidate ? previous.elapsedMs : 0) + timeStepSec * 1000;

  memory.a4 = {
    satId: bestSample.satId,
    beamId: bestSample.beamId,
    elapsedMs,
  };

  if (elapsedMs >= tttMs) {
    delete memory.a4;
    return { selected: bestSample, triggerEvent: true, reasonSuffix: 'ttt' };
  }

  return { selected: servingSample, triggerEvent: false };
}
