import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  computeThroughputMbps,
  evaluateLinksForUe,
  selectBestLink,
} from '@/sim/channel/link-budget';
import type { HOEvent, SatelliteState, UEState } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 */

export interface HandoverDecisionResult {
  nextUes: UEState[];
  events: HOEvent[];
  meanSinrDb: number;
  meanThroughputMbps: number;
}

interface DecisionContext {
  tick: number;
  profile: PaperProfile;
  satellites: SatelliteState[];
  ues: UEState[];
}

export function runMaxRsrpBaseline(context: DecisionContext): HandoverDecisionResult {
  const { tick, profile, satellites, ues } = context;

  const events: HOEvent[] = [];
  const nextUes: UEState[] = [];
  let sinrSum = 0;
  let throughputSum = 0;

  for (const ue of ues) {
    const links = evaluateLinksForUe(profile, ue, satellites);
    const bestLink = selectBestLink(links);

    if (!bestLink) {
      nextUes.push({
        ...ue,
        servingSatId: null,
        servingBeamId: null,
        rsrpDbm: -160,
        sinrDb: -40,
      });
      sinrSum += -40;
      continue;
    }

    const hasServing = ue.servingSatId !== null && ue.servingBeamId !== null;
    const changedServing =
      hasServing &&
      (ue.servingSatId !== bestLink.satId || ue.servingBeamId !== bestLink.beamId);

    if (changedServing) {
      events.push({
        tick,
        ueId: ue.id,
        fromSatId: ue.servingSatId,
        toSatId: bestLink.satId,
        fromBeamId: ue.servingBeamId,
        toBeamId: bestLink.beamId,
        reason: 'max-rsrp',
      });
    }

    const throughputMbps = computeThroughputMbps(profile, bestLink.sinrDb);

    nextUes.push({
      ...ue,
      servingSatId: bestLink.satId,
      servingBeamId: bestLink.beamId,
      rsrpDbm: bestLink.rsrpDbm,
      sinrDb: bestLink.sinrDb,
    });

    sinrSum += bestLink.sinrDb;
    throughputSum += throughputMbps;
  }

  const ueCount = Math.max(ues.length, 1);

  return {
    nextUes,
    events,
    meanSinrDb: sinrSum / ueCount,
    meanThroughputMbps: throughputSum / ueCount,
  };
}
