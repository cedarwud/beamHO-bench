import { computeThroughputMbps, evaluateLinksForUe } from '@/sim/channel/link-budget';
import { resolveCoupledHandoverConflicts } from '@/sim/scheduler/coupled-resolver';
import type { CoupledDecisionStats } from '@/sim/scheduler/types';
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

interface UeDecisionDraft {
  ue: DecisionContext['ues'][number];
  servingSample: ReturnType<typeof findServingSample>;
  decision: {
    selected: ReturnType<typeof findServingSample>;
    triggerEvent: boolean;
    reasonSuffix?: string;
    secondary?: ReturnType<typeof findServingSample>;
    prepared?: {
      satId: number;
      beamId: number;
      elapsedMs: number;
      targetMs?: number;
      remainingMs?: number;
      targetDistanceKm?: number | null;
      targetElevationDeg?: number | null;
      timeToThresholdSec?: number | null;
    } | null;
  };
  policyResolution: {
    rejectionReason: string | null;
    requestedTargetSatId: number | null;
    requestedTargetBeamId: number | null;
    decisionType: string;
  } | null;
}

function buildDefaultCoupledDecisionStats(
  mode: 'uncoupled' | 'coupled',
): CoupledDecisionStats {
  return {
    mode,
    blockedByScheduleHandoverCount: 0,
    schedulerInducedInterruptionSec: 0,
    blockedReasons: {},
  };
}

function filterLinksByScheduler(
  links: ReturnType<typeof evaluateLinksForUe>,
  mode: 'uncoupled' | 'coupled' | undefined,
  activeBeamKeys: Set<string> | null,
): ReturnType<typeof evaluateLinksForUe> {
  if (mode !== 'coupled' || !activeBeamKeys) {
    return links;
  }

  // Source: PAP-2025-DAPS-CORE
  // Coupled mode constrains HO candidates to scheduler-active beams.
  return links.filter((sample) => activeBeamKeys.has(sampleKey(sample.satId, sample.beamId)));
}

export function runHandoverBaseline(context: DecisionContext): HandoverDecisionResult {
  const {
    tick,
    timeSec,
    timeStepSec,
    profile,
    satellites,
    ues,
    baseline,
    triggerMemory,
    policyRuntime,
    beamScheduler,
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
  const drafts: UeDecisionDraft[] = [];
  const schedulerMode = beamScheduler?.summary.mode;
  const activeBeamKeys =
    schedulerMode === 'coupled'
      ? new Set(
          (beamScheduler?.states ?? [])
            .filter((state) => state.isActive)
            .map((state) => sampleKey(state.satId, state.beamId)),
        )
      : null;
  let sinrSum = 0;
  let throughputSum = 0;

  for (const ue of ues) {
    const links = filterLinksByScheduler(
      evaluateLinksForUe(profile, ue, satellites),
      schedulerMode,
      activeBeamKeys,
    );
    const servingSample = findServingSample(links, ue);
    const ueMemory = nextTriggerMemory.get(ue.id) ?? {};
    const policyResolution = policyRuntime?.isEnabled()
      ? policyRuntime.resolveDecision({
          tick,
          timeSec,
          baseline,
          ue,
          links,
          servingSample,
          satById,
          beamByKey,
        })
      : null;

    const decision = policyResolution
      ? {
          selected: policyResolution.selected,
          triggerEvent: policyResolution.triggerEvent,
          reasonSuffix: policyResolution.actionReasonCode,
          secondary: policyResolution.secondary,
          prepared: policyResolution.prepared,
        }
      : selectCandidate({
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

    if (policyResolution) {
      delete ueMemory.a3;
      delete ueMemory.a4;
      delete ueMemory.cho;
    } else {
      if (baseline !== 'a3') {
        delete ueMemory.a3;
      }
      if (baseline !== 'a4') {
        delete ueMemory.a4;
      }
      if (baseline !== 'cho') {
        delete ueMemory.cho;
      }
    }

    if (ueMemory.a3 || ueMemory.a4 || ueMemory.cho) {
      nextTriggerMemory.set(ue.id, ueMemory);
    } else {
      nextTriggerMemory.delete(ue.id);
    }

    drafts.push({
      ue,
      servingSample,
      decision,
      policyResolution: policyResolution
        ? {
            rejectionReason: policyResolution.rejectionReason,
            requestedTargetSatId: policyResolution.requestedTargetSatId,
            requestedTargetBeamId: policyResolution.requestedTargetBeamId,
            decisionType: policyResolution.decisionType,
          }
        : null,
    });
  }

  const coupledResolution = resolveCoupledHandoverConflicts({
    profile,
    beamScheduler,
    beamByKey,
    currentUes: ues,
    timeStepSec,
    proposals: drafts.map((draft) => ({
      ueId: draft.ue.id,
      servingSatId: draft.ue.servingSatId,
      servingBeamId: draft.ue.servingBeamId,
      servingRsrpDbm: draft.servingSample?.rsrpDbm ?? DEFAULT_NO_LINK_RSRP_DBM,
      targetSatId: draft.decision.selected?.satId ?? null,
      targetBeamId: draft.decision.selected?.beamId ?? null,
      targetRsrpDbm: draft.decision.selected?.rsrpDbm ?? DEFAULT_NO_LINK_RSRP_DBM,
      targetSinrDb: draft.decision.selected?.sinrDb ?? DEFAULT_NO_LINK_SINR_DB,
      triggerEvent: draft.decision.triggerEvent,
    })),
  });

  for (const draft of drafts) {
    const ue = draft.ue;

    if (draft.policyResolution?.rejectionReason) {
      events.push({
        tick,
        ueId: ue.id,
        fromSatId: ue.servingSatId,
        toSatId: draft.policyResolution.requestedTargetSatId,
        fromBeamId: ue.servingBeamId,
        toBeamId: draft.policyResolution.requestedTargetBeamId,
        reason: `policy-reject:${draft.policyResolution.rejectionReason}`,
      });
    }

    const schedulerRejection = coupledResolution.rejectedByUeId.get(ue.id) ?? null;
    const effectiveDecision = schedulerRejection
      ? {
          selected: draft.servingSample,
          triggerEvent: false,
          reasonSuffix: schedulerRejection,
          secondary: null,
          prepared: null,
        }
      : draft.decision;

    if (schedulerRejection) {
      events.push({
        tick,
        ueId: ue.id,
        fromSatId: ue.servingSatId,
        toSatId: draft.decision.selected?.satId ?? null,
        fromBeamId: ue.servingBeamId,
        toBeamId: draft.decision.selected?.beamId ?? null,
        reason: `scheduler-block:${schedulerRejection}`,
      });
    }

    const selected = effectiveDecision.selected;
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
        choPreparedRemainingMs: null,
        choGeometryDistanceKm: null,
        choGeometryElevationDeg: null,
        choGeometryTimeToThresholdSec: null,
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

    if (changedServing && effectiveDecision.triggerEvent) {
      const reasonPrefix = draft.policyResolution
        ? `policy-${draft.policyResolution.decisionType}`
        : baseline;
      const reasonSuffix = effectiveDecision.reasonSuffix
        ? `-${effectiveDecision.reasonSuffix}`
        : '';
      events.push({
        tick,
        ueId: ue.id,
        fromSatId: ue.servingSatId,
        toSatId: selected.satId,
        fromBeamId: ue.servingBeamId,
        toBeamId: selected.beamId,
        reason: `${reasonPrefix}${reasonSuffix}`,
      });
    }

    const effectiveSinrDb =
      baseline === 'mc-ho' &&
      isFullAlgorithmFidelity(profile) &&
      effectiveDecision.secondary
        ? Math.max(selected.sinrDb, effectiveDecision.secondary.sinrDb)
        : selected.sinrDb;
    const throughputMbps = computeThroughputMbps(profile, effectiveSinrDb);
    throughputSum += throughputMbps;
    sinrSum += effectiveSinrDb;

    nextUes.push({
      ...ue,
      servingSatId: selected.satId,
      servingBeamId: selected.beamId,
      secondarySatId:
        baseline === 'mc-ho' && effectiveDecision.secondary
          ? effectiveDecision.secondary.satId
          : null,
      secondaryBeamId:
        baseline === 'mc-ho' && effectiveDecision.secondary
          ? effectiveDecision.secondary.beamId
          : null,
      choPreparedSatId:
        baseline === 'cho' && effectiveDecision.prepared
          ? effectiveDecision.prepared.satId
          : null,
      choPreparedBeamId:
        baseline === 'cho' && effectiveDecision.prepared
          ? effectiveDecision.prepared.beamId
          : null,
      choPreparedElapsedMs:
        baseline === 'cho' && effectiveDecision.prepared
          ? effectiveDecision.prepared.elapsedMs
          : null,
      choPreparedTargetMs:
        baseline === 'cho' && effectiveDecision.prepared
          ? (effectiveDecision.prepared.targetMs ?? null)
          : null,
      // Source: PAP-2025-TIMERCHO-CORE
      // Persist timer/geometry prepared metadata for runtime visualization and validation checks.
      choPreparedRemainingMs:
        baseline === 'cho' && effectiveDecision.prepared
          ? (effectiveDecision.prepared.remainingMs ?? null)
          : null,
      choGeometryDistanceKm:
        baseline === 'cho' && effectiveDecision.prepared
          ? (effectiveDecision.prepared.targetDistanceKm ?? null)
          : null,
      choGeometryElevationDeg:
        baseline === 'cho' && effectiveDecision.prepared
          ? (effectiveDecision.prepared.targetElevationDeg ?? null)
          : null,
      choGeometryTimeToThresholdSec:
        baseline === 'cho' && effectiveDecision.prepared
          ? (effectiveDecision.prepared.timeToThresholdSec ?? null)
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
    coupledDecisionStats:
      schedulerMode === 'coupled'
        ? {
            mode: 'coupled',
            blockedByScheduleHandoverCount:
              coupledResolution.stats.blockedByScheduleHandoverCount,
            schedulerInducedInterruptionSec:
              coupledResolution.stats.schedulerInducedInterruptionSec,
            blockedReasons: coupledResolution.stats.blockedReasons,
          }
        : buildDefaultCoupledDecisionStats('uncoupled'),
  };
}
