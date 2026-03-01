import type { PaperProfile } from '@/config/paper-profiles/types';
import type { LinkSample } from '@/sim/channel/link-budget';
import type { BeamState, SatelliteState, UEState } from '@/sim/types';

export const DEFAULT_NO_LINK_SINR_DB = -40;
export const DEFAULT_NO_LINK_RSRP_DBM = -160;

export function sampleKey(satId: number, beamId: number): string {
  return `${satId}:${beamId}`;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function findServingSample(links: LinkSample[], ue: UEState): LinkSample | null {
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

export function selectByElevation(
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

export function estimateRemainingServiceSec(
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

export function estimateDistanceToBeamCenterKm(
  ue: UEState,
  beam: BeamState | undefined,
): number | null {
  if (!beam || beam.radiusWorld <= 0 || beam.radiusKm <= 0) {
    return null;
  }

  // Source: PAP-2025-TIMERCHO-CORE
  // Distance-to-center is tracked for prepared-target geometry telemetry and HUD audit.
  const dx = ue.positionWorld[0] - beam.centerWorld[0];
  const dz = ue.positionWorld[2] - beam.centerWorld[2];
  const distanceWorld = Math.hypot(dx, dz);
  const kmPerWorld = beam.radiusKm / beam.radiusWorld;
  return distanceWorld * kmPerWorld;
}

export function selectByRemainingTime(
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

export function sortByRsrp(links: LinkSample[]): LinkSample[] {
  return [...links].sort((left, right) => right.rsrpDbm - left.rsrpDbm);
}

export function meetsAbsoluteThreshold(profile: PaperProfile, sample: LinkSample): boolean {
  const thresholdDbm = profile.handover.params.a4ThresholdDbm ?? -120;
  const homDb = profile.handover.params.homDb ?? 0;
  return sample.rsrpDbm >= thresholdDbm + homDb;
}

export function isFullAlgorithmFidelity(profile: PaperProfile): boolean {
  return profile.handover.algorithmFidelity === 'full';
}

export function meetsA3LikeCondition(
  profile: PaperProfile,
  servingSample: LinkSample,
  candidateSample: LinkSample,
): boolean {
  const a3OffsetDb = profile.handover.params.a3OffsetDb ?? 0;
  const homDb = profile.handover.params.homDb ?? 0;
  return candidateSample.rsrpDbm >= servingSample.rsrpDbm + a3OffsetDb + homDb;
}
