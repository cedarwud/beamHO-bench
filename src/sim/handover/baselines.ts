import { computeThroughputMbps, evaluateLinksForUe } from '@/sim/channel/link-budget';
import type { BeamState, SatelliteState } from '@/sim/types';
import { selectCandidate } from './baseline-decisions';
import {
  DEFAULT_NO_LINK_RSRP_DBM,
  DEFAULT_NO_LINK_SINR_DB,
  findServingSample,
  isFullAlgorithmFidelity,
  sampleKey,
} from './baseline-helpers';
import type {
  DecisionContext,
  HandoverDecisionResult,
  RuntimeBaseline,
  TriggerMemoryStore,
} from './baseline-types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - STD-3GPP-TS38.331-RRC
 */

export type { RuntimeBaseline, TriggerMemoryStore, HandoverDecisionResult };

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
  const events: HandoverDecisionResult['events'] = [];
  const nextUes: HandoverDecisionResult['nextUes'] = [];
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

    if (baseline !== 'a3') {
      delete ueMemory.a3;
    }
    if (baseline !== 'a4') {
      delete ueMemory.a4;
    }
    if (baseline !== 'cho') {
      delete ueMemory.cho;
    }

    if (ueMemory.a3 || ueMemory.a4 || ueMemory.cho) {
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
        secondarySatId: null,
        secondaryBeamId: null,
        choPreparedSatId: null,
        choPreparedBeamId: null,
        choPreparedElapsedMs: null,
        choPreparedTargetMs: null,
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

    const effectiveSinrDb =
      baseline === 'mc-ho' &&
      isFullAlgorithmFidelity(profile) &&
      decision.secondary
        ? Math.max(selected.sinrDb, decision.secondary.sinrDb)
        : selected.sinrDb;
    const throughputMbps = computeThroughputMbps(profile, effectiveSinrDb);
    throughputSum += throughputMbps;
    sinrSum += effectiveSinrDb;

    nextUes.push({
      ...ue,
      servingSatId: selected.satId,
      servingBeamId: selected.beamId,
      secondarySatId:
        baseline === 'mc-ho' && decision.secondary ? decision.secondary.satId : null,
      secondaryBeamId:
        baseline === 'mc-ho' && decision.secondary ? decision.secondary.beamId : null,
      choPreparedSatId:
        baseline === 'cho' && decision.prepared ? decision.prepared.satId : null,
      choPreparedBeamId:
        baseline === 'cho' && decision.prepared ? decision.prepared.beamId : null,
      choPreparedElapsedMs:
        baseline === 'cho' && decision.prepared ? decision.prepared.elapsedMs : null,
      choPreparedTargetMs:
        baseline === 'cho' && decision.prepared
          ? (decision.prepared.targetMs ?? null)
          : null,
      rsrpDbm: selected.rsrpDbm,
      sinrDb: effectiveSinrDb,
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
