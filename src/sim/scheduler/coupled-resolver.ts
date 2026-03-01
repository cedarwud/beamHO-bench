import type { PaperProfile } from '@/config/paper-profiles/types';
import { sampleKey } from '@/sim/handover/baseline-helpers';
import type { BeamState, UEState } from '@/sim/types';
import type { BeamSchedulerSnapshot } from './types';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-joint-beamho-sdd.md
 * - PAP-2025-DAPS-CORE
 * - PAP-2024-MCCHO-CORE
 * - ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
 *
 * Notes:
 * - Deterministic coupled resolver enforces schedule/capacity/overlap/fairness constraints.
 */

export interface CoupledHandoverProposal {
  ueId: number;
  servingSatId: number | null;
  servingBeamId: number | null;
  servingRsrpDbm: number;
  targetSatId: number | null;
  targetBeamId: number | null;
  targetRsrpDbm: number;
  targetSinrDb: number;
  triggerEvent: boolean;
}

export interface CoupledResolverStats {
  blockedByScheduleHandoverCount: number;
  schedulerInducedInterruptionSec: number;
  blockedReasons: Record<string, number>;
}

export interface CoupledResolverResult {
  rejectedByUeId: Map<number, string>;
  stats: CoupledResolverStats;
}

interface CoupledResolverOptions {
  profile: PaperProfile;
  beamScheduler?: BeamSchedulerSnapshot;
  beamByKey: Map<string, BeamState>;
  currentUes: UEState[];
  proposals: CoupledHandoverProposal[];
  timeStepSec: number;
}

function computeJainFairness(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const sumSq = values.reduce((acc, value) => acc + value * value, 0);
  if (sumSq <= 0) {
    return 1;
  }
  return (sum * sum) / (values.length * sumSq);
}

function cloneOccupancy(source: Map<string, number>): Map<string, number> {
  return new Map(source.entries());
}

function buildCurrentOccupancy(ues: UEState[]): Map<string, number> {
  const occupancy = new Map<string, number>();
  for (const ue of ues) {
    if (ue.servingSatId === null || ue.servingBeamId === null) {
      continue;
    }
    const key = sampleKey(ue.servingSatId, ue.servingBeamId);
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  }
  return occupancy;
}

function evaluateOverlapAllowed(
  profile: PaperProfile,
  sourceBeam: BeamState | undefined,
  targetBeam: BeamState | undefined,
): boolean {
  if (!sourceBeam || !targetBeam) {
    return true;
  }

  // Source: PAP-2024-MCCHO-CORE
  // Source: PAP-2025-DAPS-CORE
  // Coupled handover requires geometric overlap feasibility between source and target beams.
  const overlapRatio = profile.beam.overlapRatio ?? 0;
  const dx = sourceBeam.centerWorld[0] - targetBeam.centerWorld[0];
  const dz = sourceBeam.centerWorld[2] - targetBeam.centerWorld[2];
  const centerDistance = Math.hypot(dx, dz);
  const overlapDistanceLimit =
    (sourceBeam.radiusWorld + targetBeam.radiusWorld) * (1 + overlapRatio);

  return centerDistance <= overlapDistanceLimit;
}

function evaluateFairnessGuard(
  profile: PaperProfile,
  activeBeamKeys: string[],
  occupancy: Map<string, number>,
): boolean {
  // Source: ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
  // Fairness guard uses profile-defined Jain target for scheduler allocation.
  const target = profile.scheduler.fairnessTargetJain;
  const values = activeBeamKeys.map((key) => occupancy.get(key) ?? 0);
  const fairness = computeJainFairness(values);
  return fairness + 1e-9 >= target;
}

function buildActiveBeamKeys(snapshot: BeamSchedulerSnapshot): string[] {
  return snapshot.states
    .filter((state) => state.isActive)
    .map((state) => sampleKey(state.satId, state.beamId))
    .sort((left, right) => left.localeCompare(right));
}

function isExecutableHandoverProposal(proposal: CoupledHandoverProposal): boolean {
  if (!proposal.triggerEvent) {
    return false;
  }
  if (proposal.targetSatId === null || proposal.targetBeamId === null) {
    return false;
  }
  if (proposal.servingSatId === null || proposal.servingBeamId === null) {
    return false;
  }
  return (
    proposal.targetSatId !== proposal.servingSatId ||
    proposal.targetBeamId !== proposal.servingBeamId
  );
}

export function resolveCoupledHandoverConflicts(
  options: CoupledResolverOptions,
): CoupledResolverResult {
  if (!options.beamScheduler || options.beamScheduler.summary.mode !== 'coupled') {
    return {
      rejectedByUeId: new Map(),
      stats: {
        blockedByScheduleHandoverCount: 0,
        schedulerInducedInterruptionSec: 0,
        blockedReasons: {},
      },
    };
  }

  const activeBeamKeys = buildActiveBeamKeys(options.beamScheduler);
  const activeBeamSet = new Set(activeBeamKeys);
  const occupancy = buildCurrentOccupancy(options.currentUes);
  const rejectedByUeId = new Map<number, string>();
  const blockedReasonCounter = new Map<string, number>();
  let blockedCount = 0;
  let schedulerInducedInterruptionSec = 0;

  const proposals = options.proposals
    .filter((proposal) => isExecutableHandoverProposal(proposal))
    .sort((left, right) => {
      if (left.servingRsrpDbm !== right.servingRsrpDbm) {
        return left.servingRsrpDbm - right.servingRsrpDbm;
      }
      if (left.targetSinrDb !== right.targetSinrDb) {
        return right.targetSinrDb - left.targetSinrDb;
      }
      if (left.targetRsrpDbm !== right.targetRsrpDbm) {
        return right.targetRsrpDbm - left.targetRsrpDbm;
      }
      return left.ueId - right.ueId;
    });

  for (const proposal of proposals) {
    const sourceKey = sampleKey(proposal.servingSatId as number, proposal.servingBeamId as number);
    const targetKey = sampleKey(proposal.targetSatId as number, proposal.targetBeamId as number);
    const sourceBeam = options.beamByKey.get(sourceKey);
    const targetBeam = options.beamByKey.get(targetKey);

    let rejectionReason: string | null = null;

    if (!activeBeamSet.has(targetKey)) {
      rejectionReason = 'blocked-by-schedule-inactive-beam';
    } else if (!evaluateOverlapAllowed(options.profile, sourceBeam, targetBeam)) {
      rejectionReason = 'blocked-by-schedule-overlap-constraint';
    } else {
      // Source: ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
      // Per-beam capacity cap is profile-sourced and enforced before HO commit.
      const projected = cloneOccupancy(occupancy);
      projected.set(sourceKey, Math.max((projected.get(sourceKey) ?? 1) - 1, 0));
      projected.set(targetKey, (projected.get(targetKey) ?? 0) + 1);

      const targetLoad = projected.get(targetKey) ?? 0;
      if (targetLoad > options.profile.scheduler.maxUsersPerActiveBeam) {
        rejectionReason = 'blocked-by-schedule-capacity';
      } else if (!evaluateFairnessGuard(options.profile, activeBeamKeys, projected)) {
        rejectionReason = 'blocked-by-schedule-fairness-guard';
      } else {
        occupancy.clear();
        for (const [key, value] of projected.entries()) {
          occupancy.set(key, value);
        }
      }
    }

    if (!rejectionReason) {
      continue;
    }

    rejectedByUeId.set(proposal.ueId, rejectionReason);
    blockedCount += 1;
    blockedReasonCounter.set(
      rejectionReason,
      (blockedReasonCounter.get(rejectionReason) ?? 0) + 1,
    );
    if (proposal.servingSatId === null || proposal.servingBeamId === null) {
      schedulerInducedInterruptionSec += options.timeStepSec;
    }
  }

  return {
    rejectedByUeId,
    stats: {
      blockedByScheduleHandoverCount: blockedCount,
      schedulerInducedInterruptionSec,
      blockedReasons: Object.fromEntries(
        [...blockedReasonCounter.entries()].sort((left, right) =>
          left[0].localeCompare(right[0]),
        ),
      ),
    },
  };
}
