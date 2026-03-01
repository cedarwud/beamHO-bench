import type { PaperProfile } from '@/config/paper-profiles/types';
import type { LinkSample } from '@/sim/channel/link-budget';
import { isFullAlgorithmFidelity } from '@/sim/handover/baseline-helpers';
import type { BeamState, SatelliteState, UEState } from '@/sim/types';
import type { PolicyAction, PolicyDecisionType } from './types';

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-rl-plugin-sdd.md
 * - PAP-2024-MCCHO-CORE
 * - STD-3GPP-TS38.331-RRC
 * - STD-3GPP-TR38.811-6.6.2-1
 *
 * Notes:
 * - Adapter maps policy actions into HO executor-compatible deterministic decisions.
 */

export type RuntimeBaselineLike =
  | 'max-rsrp'
  | 'max-elevation'
  | 'max-remaining-time'
  | 'a3'
  | 'a4'
  | 'cho'
  | 'mc-ho';

export interface PolicyDecisionRequest {
  tick: number;
  timeSec: number;
  baseline: RuntimeBaselineLike;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  satById: Map<number, SatelliteState>;
  beamByKey: Map<string, BeamState>;
}

export interface PolicyDecisionResolution {
  selected: LinkSample | null;
  triggerEvent: boolean;
  secondary?: LinkSample | null;
  prepared?: {
    satId: number;
    beamId: number;
    elapsedMs: number;
    targetMs?: number;
  } | null;
  rejectionReason: string | null;
  requestedTargetSatId: number | null;
  requestedTargetBeamId: number | null;
  actionReasonCode: string;
  decisionType: PolicyDecisionType;
}

const SUPPORTED_DECISION_TYPES = new Set<PolicyDecisionType>([
  'hold',
  'ho_execute',
  'ho_prepare',
  'dual_link_add',
  'dual_link_release',
]);

export function normalizeAction(candidate: unknown): PolicyAction | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const decisionType = record.decisionType;
  const reasonCode = record.reasonCode;

  if (
    typeof decisionType !== 'string' ||
    !SUPPORTED_DECISION_TYPES.has(decisionType as PolicyDecisionType)
  ) {
    return null;
  }

  if (typeof reasonCode !== 'string' || reasonCode.length === 0) {
    return null;
  }

  const targetSatId =
    typeof record.targetSatId === 'number' && Number.isFinite(record.targetSatId)
      ? Math.round(record.targetSatId)
      : null;
  const targetBeamId =
    typeof record.targetBeamId === 'number' && Number.isFinite(record.targetBeamId)
      ? Math.round(record.targetBeamId)
      : null;

  const normalized: PolicyAction = {
    decisionType: decisionType as PolicyDecisionType,
    reasonCode,
  };
  if (targetSatId !== null) {
    normalized.targetSatId = targetSatId;
  }
  if (targetBeamId !== null) {
    normalized.targetBeamId = targetBeamId;
  }
  if (typeof record.confidence === 'number' && Number.isFinite(record.confidence)) {
    normalized.confidence = record.confidence;
  }

  return normalized;
}

function hasSameTarget(
  sample: LinkSample | null,
  targetSatId: number,
  targetBeamId: number,
): boolean {
  return (
    sample !== null &&
    sample.satId === targetSatId &&
    sample.beamId === targetBeamId
  );
}

function resolveTargetSample(
  profile: PaperProfile,
  request: PolicyDecisionRequest,
  action: PolicyAction,
): LinkSample | null {
  const targetSatId =
    typeof action.targetSatId === 'number' && Number.isFinite(action.targetSatId)
      ? Math.round(action.targetSatId)
      : null;
  const targetBeamId =
    typeof action.targetBeamId === 'number' && Number.isFinite(action.targetBeamId)
      ? Math.round(action.targetBeamId)
      : null;

  if (targetSatId === null || targetBeamId === null) {
    return null;
  }

  const satellite = request.satById.get(targetSatId);
  if (!satellite) {
    return null;
  }

  const beamExists = satellite.beams.some((beam) => beam.beamId === targetBeamId);
  if (!beamExists) {
    return null;
  }

  if (!satellite.visible || satellite.elevationDeg < profile.constellation.minElevationDeg) {
    // Source: STD-3GPP-TR38.811-6.6.2-1
    // Enforce profile-defined minimum elevation visibility guard.
    return null;
  }

  return (
    request.links.find(
      (sample) => sample.satId === targetSatId && sample.beamId === targetBeamId,
    ) ?? null
  );
}

function resolveMtsMs(profile: PaperProfile): number | null {
  const mtsSec = profile.handover.params.mtsSec;
  if (typeof mtsSec !== 'number' || !Number.isFinite(mtsSec) || mtsSec <= 0) {
    return null;
  }
  return Math.round(mtsSec * 1000);
}

function fallbackHoldResolution(
  request: PolicyDecisionRequest,
  action: PolicyAction,
  rejectionReason: string | null,
): PolicyDecisionResolution {
  // Source: sdd/pending/beamHO-bench-rl-plugin-sdd.md
  // Invalid actions deterministically fallback to hold in the current tick.
  return {
    selected: request.servingSample,
    triggerEvent: false,
    rejectionReason,
    requestedTargetSatId:
      typeof action.targetSatId === 'number' && Number.isFinite(action.targetSatId)
        ? Math.round(action.targetSatId)
        : null,
    requestedTargetBeamId:
      typeof action.targetBeamId === 'number' && Number.isFinite(action.targetBeamId)
        ? Math.round(action.targetBeamId)
        : null,
    actionReasonCode: action.reasonCode,
    decisionType: action.decisionType,
  };
}

export function adaptPolicyAction(
  profile: PaperProfile,
  request: PolicyDecisionRequest,
  action: PolicyAction,
): PolicyDecisionResolution {
  if (action.decisionType === 'hold') {
    return fallbackHoldResolution(request, action, null);
  }

  if (action.decisionType === 'ho_execute') {
    const target = resolveTargetSample(profile, request, action);
    if (!target) {
      return fallbackHoldResolution(
        request,
        action,
        'target-not-visible-or-eligible',
      );
    }

    return {
      selected: target,
      triggerEvent: true,
      rejectionReason: null,
      requestedTargetSatId: target.satId,
      requestedTargetBeamId: target.beamId,
      actionReasonCode: action.reasonCode,
      decisionType: action.decisionType,
    };
  }

  if (action.decisionType === 'ho_prepare') {
    // Source: STD-3GPP-TS38.331-RRC
    // CHO prepare is only legal in CHO baseline with full-fidelity mode.
    if (request.baseline !== 'cho') {
      return fallbackHoldResolution(
        request,
        action,
        'unsupported-decision-type-for-baseline',
      );
    }
    if (!isFullAlgorithmFidelity(profile)) {
      return fallbackHoldResolution(request, action, 'requires-full-fidelity');
    }
    if (!request.servingSample) {
      return fallbackHoldResolution(request, action, 'requires-serving-link');
    }
    const target = resolveTargetSample(profile, request, action);
    if (!target) {
      return fallbackHoldResolution(
        request,
        action,
        'target-not-visible-or-eligible',
      );
    }
    if (hasSameTarget(request.servingSample, target.satId, target.beamId)) {
      return fallbackHoldResolution(request, action, 'target-equals-serving');
    }

    const targetMs = resolveMtsMs(profile);
    if (targetMs === null) {
      return fallbackHoldResolution(request, action, 'missing-profile-mts-sec');
    }

    return {
      selected: request.servingSample,
      triggerEvent: false,
      prepared: {
        satId: target.satId,
        beamId: target.beamId,
        elapsedMs: 0,
        targetMs,
      },
      rejectionReason: null,
      requestedTargetSatId: target.satId,
      requestedTargetBeamId: target.beamId,
      actionReasonCode: action.reasonCode,
      decisionType: action.decisionType,
    };
  }

  if (action.decisionType === 'dual_link_add') {
    // Source: PAP-2024-MCCHO-CORE
    // Dual-link add/release is constrained to MC-HO mode.
    if (request.baseline !== 'mc-ho') {
      return fallbackHoldResolution(
        request,
        action,
        'unsupported-decision-type-for-baseline',
      );
    }
    if (!isFullAlgorithmFidelity(profile)) {
      return fallbackHoldResolution(request, action, 'requires-full-fidelity');
    }
    if (!request.servingSample) {
      return fallbackHoldResolution(request, action, 'requires-serving-link');
    }
    const target = resolveTargetSample(profile, request, action);
    if (!target) {
      return fallbackHoldResolution(
        request,
        action,
        'target-not-visible-or-eligible',
      );
    }
    if (hasSameTarget(request.servingSample, target.satId, target.beamId)) {
      return fallbackHoldResolution(request, action, 'target-equals-serving');
    }

    return {
      selected: request.servingSample,
      triggerEvent: false,
      secondary: target,
      rejectionReason: null,
      requestedTargetSatId: target.satId,
      requestedTargetBeamId: target.beamId,
      actionReasonCode: action.reasonCode,
      decisionType: action.decisionType,
    };
  }

  if (action.decisionType === 'dual_link_release') {
    if (request.baseline !== 'mc-ho') {
      return fallbackHoldResolution(
        request,
        action,
        'unsupported-decision-type-for-baseline',
      );
    }
    if (!isFullAlgorithmFidelity(profile)) {
      return fallbackHoldResolution(request, action, 'requires-full-fidelity');
    }

    return {
      selected: request.servingSample,
      triggerEvent: false,
      secondary: null,
      rejectionReason: null,
      requestedTargetSatId: null,
      requestedTargetBeamId: null,
      actionReasonCode: action.reasonCode,
      decisionType: action.decisionType,
    };
  }

  return fallbackHoldResolution(request, action, 'unsupported-decision-type');
}

export function createDefaultHoldAction(reasonCode: string): PolicyAction {
  return {
    decisionType: 'hold',
    reasonCode,
  };
}
