import type { PaperProfile } from '@/config/paper-profiles/types';
import type { LinkSample } from '@/sim/channel/link-budget';
import type { BeamState, SatelliteState, UEState } from '@/sim/types';
import type { CandidateDecision, UeTriggerMemory } from './baseline-types';
import {
  clamp,
  estimateDistanceToBeamCenterKm,
  estimateRemainingServiceSec,
  isFullAlgorithmFidelity,
  meetsA3LikeCondition,
  meetsAbsoluteThreshold,
  sampleKey,
  sortByRsrp,
} from './baseline-helpers';

function resolveChoDecisionSimplified(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  bestSample: LinkSample | null;
  memory: UeTriggerMemory;
  timeStepSec: number;
  beamByKey: Map<string, BeamState>;
  satById: Map<number, SatelliteState>;
}): CandidateDecision {
  const {
    profile,
    ue,
    links,
    servingSample,
    bestSample,
    memory,
    timeStepSec,
    beamByKey,
    satById,
  } = options;

  if (links.length === 0 || !bestSample) {
    delete memory.cho;
    return { selected: null, triggerEvent: false };
  }

  if (!servingSample) {
    delete memory.cho;
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
    delete memory.cho;
    return { selected: servingSample, triggerEvent: false };
  }

  // Source: PAP-2024-MCCHO-CORE
  // CHO is only prepared when serving and target are both in overlap-capable quality range.
  const overlapReady =
    meetsAbsoluteThreshold(profile, servingSample) &&
    meetsAbsoluteThreshold(profile, bestSample);

  if (!overlapReady) {
    delete memory.cho;
    return { selected: servingSample, triggerEvent: false };
  }

  const targetBeam = beamByKey.get(sampleKey(bestSample.satId, bestSample.beamId));
  const remainingSec = estimateRemainingServiceSec(profile, ue, targetBeam);
  const targetDistanceKm = estimateDistanceToBeamCenterKm(ue, targetBeam);
  const targetElevationDeg = satById.get(bestSample.satId)?.elevationDeg ?? null;

  // Source: PAP-2025-TIMERCHO-CORE
  // Timer-based CHO executes after alpha-scaled expected service duration.
  const alpha = clamp(profile.handover.params.timerAlphaOptions?.[0] ?? 0.85, 0.1, 1);
  const targetMs = Math.max(100, Math.round(alpha * remainingSec * 1000));

  const previous = memory.cho;
  const sameCandidate =
    previous &&
    previous.satId === bestSample.satId &&
    previous.beamId === bestSample.beamId;
  const elapsedMs = (sameCandidate ? previous.elapsedMs : 0) + timeStepSec * 1000;
  const remainingMs = Math.max(targetMs - elapsedMs, 0);

  memory.cho = {
    satId: bestSample.satId,
    beamId: bestSample.beamId,
    elapsedMs,
    targetMs,
    remainingMs,
    targetDistanceKm,
    targetElevationDeg,
    timeToThresholdSec: remainingSec,
  };

  if (elapsedMs >= targetMs) {
    delete memory.cho;
    return { selected: bestSample, triggerEvent: true, reasonSuffix: 'timer-cho' };
  }

  return {
    selected: servingSample,
    triggerEvent: false,
    reasonSuffix: 'prepared',
    prepared: memory.cho,
  };
}

function resolveChoDecisionFull(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  bestSample: LinkSample | null;
  memory: UeTriggerMemory;
  timeStepSec: number;
  beamByKey: Map<string, BeamState>;
  satById: Map<number, SatelliteState>;
}): CandidateDecision {
  const {
    profile,
    ue,
    links,
    servingSample,
    bestSample,
    memory,
    timeStepSec,
    beamByKey,
    satById,
  } = options;

  if (links.length === 0 || !bestSample) {
    delete memory.cho;
    return { selected: null, triggerEvent: false };
  }

  if (!servingSample) {
    delete memory.cho;
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
    delete memory.cho;
    return { selected: servingSample, triggerEvent: false };
  }

  // Source: PAP-2024-MCCHO-CORE
  // Full CHO keeps target preparation only if target is both threshold-valid and A3-superior.
  const prepareReady =
    meetsAbsoluteThreshold(profile, bestSample) &&
    meetsA3LikeCondition(profile, servingSample, bestSample);
  if (!prepareReady) {
    delete memory.cho;
    return { selected: servingSample, triggerEvent: false };
  }

  const targetBeam = beamByKey.get(sampleKey(bestSample.satId, bestSample.beamId));
  const targetRemainingSec = estimateRemainingServiceSec(profile, ue, targetBeam);
  const servingRemainingSec = estimateRemainingServiceSec(
    profile,
    ue,
    beamByKey.get(sampleKey(servingSample.satId, servingSample.beamId)),
  );
  const targetDistanceKm = estimateDistanceToBeamCenterKm(ue, targetBeam);
  const targetElevationDeg = satById.get(bestSample.satId)?.elevationDeg ?? null;

  // Source: PAP-2025-TIMERCHO-CORE
  // Full CHO execution supports timer-based and location-based trigger clauses.
  const alpha = clamp(profile.handover.params.timerAlphaOptions?.[0] ?? 0.85, 0.1, 1);
  const timerTargetMs = Math.max(100, Math.round(alpha * targetRemainingSec * 1000));
  const mtsSec = Math.max(profile.handover.params.mtsSec ?? 1, 0);
  const locationThresholdSec = Math.max(mtsSec, 0.1);

  const previous = memory.cho;
  const sameCandidate =
    previous &&
    previous.satId === bestSample.satId &&
    previous.beamId === bestSample.beamId;
  const elapsedMs = (sameCandidate ? previous.elapsedMs : 0) + timeStepSec * 1000;
  const remainingMs = Math.max(timerTargetMs - elapsedMs, 0);
  const timeToThresholdSec = Math.max(servingRemainingSec - locationThresholdSec, 0);

  memory.cho = {
    satId: bestSample.satId,
    beamId: bestSample.beamId,
    elapsedMs,
    targetMs: timerTargetMs,
    remainingMs,
    targetDistanceKm,
    targetElevationDeg,
    timeToThresholdSec,
  };

  const executeByTimer = elapsedMs >= timerTargetMs;
  const executeByLocation = servingRemainingSec <= locationThresholdSec;
  const executeReady =
    (executeByTimer || executeByLocation) &&
    meetsAbsoluteThreshold(profile, bestSample) &&
    meetsA3LikeCondition(profile, servingSample, bestSample);

  if (executeReady) {
    delete memory.cho;
    return {
      selected: bestSample,
      triggerEvent: true,
      reasonSuffix: executeByLocation ? 'location-cho-full' : 'timer-cho-full',
    };
  }

  return {
    selected: servingSample,
    triggerEvent: false,
    reasonSuffix: 'prepared-full',
    prepared: memory.cho,
  };
}

export function resolveChoDecision(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  bestSample: LinkSample | null;
  memory: UeTriggerMemory;
  timeStepSec: number;
  beamByKey: Map<string, BeamState>;
  satById: Map<number, SatelliteState>;
}): CandidateDecision {
  if (isFullAlgorithmFidelity(options.profile)) {
    return resolveChoDecisionFull(options);
  }
  return resolveChoDecisionSimplified(options);
}

function resolveMcHoDecisionSimplified(options: {
  profile: PaperProfile;
  links: LinkSample[];
}): CandidateDecision {
  const { profile, links } = options;

  if (links.length === 0) {
    return { selected: null, secondary: null, triggerEvent: false };
  }

  const sorted = sortByRsrp(links);
  const primary = sorted[0];

  // Source: PAP-2024-MCCHO-CORE
  // MC baseline keeps a secondary candidate above threshold, preferably from another satellite.
  const secondary =
    sorted.find(
      (candidate) =>
        candidate.satId !== primary.satId && meetsAbsoluteThreshold(profile, candidate),
    ) ?? null;

  return {
    selected: primary,
    secondary,
    triggerEvent: true,
    reasonSuffix: secondary ? 'dual' : 'single',
  };
}

function resolveMcHoDecisionFull(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
}): CandidateDecision {
  const { profile, ue, links, servingSample } = options;

  if (links.length === 0) {
    return { selected: null, secondary: null, triggerEvent: false };
  }

  const sorted = sortByRsrp(links);
  const best = sorted[0];

  let primary = best;
  let triggerEvent = true;
  let reasonSuffix = 'mc-ho-full';

  if (!servingSample) {
    triggerEvent = ue.servingSatId !== null;
    reasonSuffix = 'forced';
  } else {
    const servingViable = meetsAbsoluteThreshold(profile, servingSample);
    const betterThanServing = meetsA3LikeCondition(profile, servingSample, best);
    if (servingViable && !betterThanServing) {
      primary = servingSample;
      triggerEvent = false;
      reasonSuffix = 'hold-full';
    } else if (
      best.satId === servingSample.satId &&
      best.beamId === servingSample.beamId
    ) {
      primary = servingSample;
      triggerEvent = false;
      reasonSuffix = 'same-full';
    } else {
      primary = best;
      triggerEvent = true;
      reasonSuffix = betterThanServing ? 'switch-full' : 'fallback-full';
    }
  }

  // Source: PAP-2024-MCCHO-CORE
  // Full MC-HO keeps a viable secondary for dual-connectivity robustness.
  let secondary =
    sorted.find(
      (candidate) =>
        candidate.satId !== primary.satId && meetsAbsoluteThreshold(profile, candidate),
    ) ??
    sorted.find(
      (candidate) =>
        sampleKey(candidate.satId, candidate.beamId) !==
          sampleKey(primary.satId, primary.beamId) && meetsAbsoluteThreshold(profile, candidate),
    ) ??
    null;

  if (
    !secondary &&
    servingSample &&
    sampleKey(servingSample.satId, servingSample.beamId) !==
      sampleKey(primary.satId, primary.beamId) &&
    meetsAbsoluteThreshold(profile, servingSample)
  ) {
    secondary = servingSample;
  }

  return {
    selected: primary,
    secondary,
    triggerEvent,
    reasonSuffix,
  };
}

export function resolveMcHoDecision(options: {
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
}): CandidateDecision {
  if (isFullAlgorithmFidelity(options.profile)) {
    return resolveMcHoDecisionFull(options);
  }

  return resolveMcHoDecisionSimplified({
    profile: options.profile,
    links: options.links,
  });
}
