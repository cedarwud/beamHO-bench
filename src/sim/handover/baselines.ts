import type { HandoverBaseline, PaperProfile } from '@/config/paper-profiles/types';
import {
  computeThroughputMbps,
  evaluateLinksForUe,
  selectBestLink,
  type LinkSample,
} from '@/sim/channel/link-budget';
import type { BeamState, HOEvent, SatelliteState, UEState } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - STD-3GPP-TS38.331-RRC
 */

export type RuntimeBaseline = Extract<
  HandoverBaseline,
  'max-rsrp' | 'max-elevation' | 'max-remaining-time' | 'a3' | 'a4'
>;

interface CandidateMemory {
  satId: number;
  beamId: number;
  elapsedMs: number;
}

interface UeTriggerMemory {
  a3?: CandidateMemory;
  a4?: CandidateMemory;
}

export type TriggerMemoryStore = Map<number, UeTriggerMemory>;

export interface HandoverDecisionResult {
  nextUes: UEState[];
  events: HOEvent[];
  meanSinrDb: number;
  meanThroughputMbps: number;
  nextTriggerMemory: TriggerMemoryStore;
}

interface DecisionContext {
  tick: number;
  timeStepSec: number;
  profile: PaperProfile;
  satellites: SatelliteState[];
  ues: UEState[];
  baseline: RuntimeBaseline;
  triggerMemory?: TriggerMemoryStore;
}

interface CandidateDecision {
  selected: LinkSample | null;
  triggerEvent: boolean;
  reasonSuffix?: string;
}

const DEFAULT_NO_LINK_SINR_DB = -40;
const DEFAULT_NO_LINK_RSRP_DBM = -160;

function sampleKey(satId: number, beamId: number): string {
  return `${satId}:${beamId}`;
}

function findServingSample(links: LinkSample[], ue: UEState): LinkSample | null {
  if (ue.servingSatId === null || ue.servingBeamId === null) {
    return null;
  }
  return (
    links.find(
      (sample) =>
        sample.satId === ue.servingSatId && sample.beamId === ue.servingBeamId,
    ) ?? null
  );
}

function selectByElevation(
  links: LinkSample[],
  satById: Map<number, SatelliteState>,
): LinkSample | null {
  if (links.length === 0) {
    return null;
  }

  let best = links[0];
  let bestElevation = satById.get(best.satId)?.elevationDeg ?? -Infinity;

  for (let index = 1; index < links.length; index += 1) {
    const candidate = links[index];
    const elevation = satById.get(candidate.satId)?.elevationDeg ?? -Infinity;

    if (
      elevation > bestElevation ||
      (Math.abs(elevation - bestElevation) <= 1e-6 &&
        candidate.rsrpDbm > best.rsrpDbm)
    ) {
      best = candidate;
      bestElevation = elevation;
    }
  }

  return best;
}

function estimateRemainingServiceSec(
  profile: PaperProfile,
  ue: UEState,
  beam: BeamState | undefined,
): number {
  if (!beam || beam.radiusWorld <= 0 || beam.radiusKm <= 0) {
    return 0;
  }

  const dx = ue.positionWorld[0] - beam.centerWorld[0];
  const dz = ue.positionWorld[2] - beam.centerWorld[2];
  const distanceWorld = Math.hypot(dx, dz);
  const distanceRatio = Math.min(distanceWorld / beam.radiusWorld, 1);
  const remainingRadiusKm = Math.max(beam.radiusKm * (1 - distanceRatio), 0);

  // Source: PAP-2025-TIMERCHO-CORE
  // Keep remaining-time decision geometry-aware by combining footprint margin and mobility.
  const satelliteSpeedKmps = profile.constellation.satelliteSpeedKmps ?? 7.56;
  const ueSpeedKmps = ue.speedKmph / 3600;
  const relativeSpeedKmps = Math.max(satelliteSpeedKmps + ueSpeedKmps, 0.01);

  return remainingRadiusKm / relativeSpeedKmps;
}

function selectByRemainingTime(
  profile: PaperProfile,
  ue: UEState,
  links: LinkSample[],
  beamByKey: Map<string, BeamState>,
): LinkSample | null {
  if (links.length === 0) {
    return null;
  }

  let best = links[0];
  let bestRemaining = estimateRemainingServiceSec(
    profile,
    ue,
    beamByKey.get(sampleKey(best.satId, best.beamId)),
  );

  for (let index = 1; index < links.length; index += 1) {
    const candidate = links[index];
    const remaining = estimateRemainingServiceSec(
      profile,
      ue,
      beamByKey.get(sampleKey(candidate.satId, candidate.beamId)),
    );

    if (
      remaining > bestRemaining ||
      (Math.abs(remaining - bestRemaining) <= 1e-6 &&
        candidate.rsrpDbm > best.rsrpDbm)
    ) {
      best = candidate;
      bestRemaining = remaining;
    }
  }

  return best;
}

function resolveA3Decision(options: {
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

  const a3OffsetDb = profile.handover.params.a3OffsetDb ?? 0;
  const homDb = profile.handover.params.homDb ?? 0;

  // Source: PAP-2022-A4EVENT-CORE
  // A3 condition: neighbor is better than serving by offset plus hysteresis.
  const meetsA3 = bestSample.rsrpDbm >= servingSample.rsrpDbm + a3OffsetDb + homDb;

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

function resolveA4Decision(options: {
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

  const thresholdDbm = profile.handover.params.a4ThresholdDbm ?? -120;
  const homDb = profile.handover.params.homDb ?? 0;
  const meetsThreshold = bestSample.rsrpDbm >= thresholdDbm + homDb;

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

function selectCandidate(options: {
  baseline: RuntimeBaseline;
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  satById: Map<number, SatelliteState>;
  beamByKey: Map<string, BeamState>;
  memory: UeTriggerMemory;
  timeStepSec: number;
}): CandidateDecision {
  const {
    baseline,
    profile,
    ue,
    links,
    servingSample,
    satById,
    beamByKey,
    memory,
    timeStepSec,
  } = options;

  const bestSample = selectBestLink(links);

  switch (baseline) {
    case 'max-rsrp':
      return { selected: bestSample, triggerEvent: true };
    case 'max-elevation':
      return { selected: selectByElevation(links, satById), triggerEvent: true };
    case 'max-remaining-time':
      return {
        selected: selectByRemainingTime(profile, ue, links, beamByKey),
        triggerEvent: true,
      };
    case 'a3':
      return resolveA3Decision({
        profile,
        ue,
        links,
        servingSample,
        bestSample,
        memory,
        timeStepSec,
      });
    case 'a4':
      return resolveA4Decision({
        profile,
        ue,
        links,
        servingSample,
        bestSample,
        memory,
        timeStepSec,
      });
    default:
      return { selected: bestSample, triggerEvent: true };
  }
}

export function runHandoverBaseline(context: DecisionContext): HandoverDecisionResult {
  const {
    tick,
    timeStepSec,
    profile,
    satellites,
    ues,
    baseline,
    triggerMemory,
  } = context;

  const satById = new Map<number, SatelliteState>(
    satellites.map((satellite) => [satellite.id, satellite]),
  );
  const beamByKey = new Map<string, BeamState>();
  for (const satellite of satellites) {
    for (const beam of satellite.beams) {
      beamByKey.set(sampleKey(satellite.id, beam.beamId), beam);
    }
  }

  const nextTriggerMemory: TriggerMemoryStore = triggerMemory ?? new Map();
  const events: HOEvent[] = [];
  const nextUes: UEState[] = [];
  let sinrSum = 0;
  let throughputSum = 0;

  for (const ue of ues) {
    const links = evaluateLinksForUe(profile, ue, satellites);
    const servingSample = findServingSample(links, ue);
    const ueMemory = nextTriggerMemory.get(ue.id) ?? {};

    const decision = selectCandidate({
      baseline,
      profile,
      ue,
      links,
      servingSample,
      satById,
      beamByKey,
      memory: ueMemory,
      timeStepSec,
    });

    if (baseline !== 'a3' && baseline !== 'a4') {
      delete ueMemory.a3;
      delete ueMemory.a4;
    }

    if (ueMemory.a3 || ueMemory.a4) {
      nextTriggerMemory.set(ue.id, ueMemory);
    } else {
      nextTriggerMemory.delete(ue.id);
    }

    const selected = decision.selected;
    if (!selected) {
      nextUes.push({
        ...ue,
        servingSatId: null,
        servingBeamId: null,
        rsrpDbm: DEFAULT_NO_LINK_RSRP_DBM,
        sinrDb: DEFAULT_NO_LINK_SINR_DB,
      });
      sinrSum += DEFAULT_NO_LINK_SINR_DB;
      continue;
    }

    const hasServing = ue.servingSatId !== null && ue.servingBeamId !== null;
    const changedServing =
      hasServing &&
      (ue.servingSatId !== selected.satId || ue.servingBeamId !== selected.beamId);

    if (changedServing && decision.triggerEvent) {
      const reasonSuffix = decision.reasonSuffix ? `-${decision.reasonSuffix}` : '';
      events.push({
        tick,
        ueId: ue.id,
        fromSatId: ue.servingSatId,
        toSatId: selected.satId,
        fromBeamId: ue.servingBeamId,
        toBeamId: selected.beamId,
        reason: `${baseline}${reasonSuffix}`,
      });
    }

    const throughputMbps = computeThroughputMbps(profile, selected.sinrDb);
    throughputSum += throughputMbps;
    sinrSum += selected.sinrDb;

    nextUes.push({
      ...ue,
      servingSatId: selected.satId,
      servingBeamId: selected.beamId,
      rsrpDbm: selected.rsrpDbm,
      sinrDb: selected.sinrDb,
    });
  }

  const ueCount = Math.max(ues.length, 1);

  return {
    nextUes,
    events,
    meanSinrDb: sinrSum / ueCount,
    meanThroughputMbps: throughputSum / ueCount,
    nextTriggerMemory,
  };
}
