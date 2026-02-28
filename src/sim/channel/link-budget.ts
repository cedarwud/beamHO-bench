import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteState, UEState } from '@/sim/types';

/**
 * Provenance:
 * - STD-3GPP-TR38.811-6.6.2-1
 */

export interface LinkSample {
  satId: number;
  beamId: number;
  rsrpDbm: number;
  sinrDb: number;
}

interface DbEntry {
  sample: LinkSample;
  signalMw: number;
}

const SYSTEM_LOSS_DB = 70; // Engineering assumption for v1 calibration.

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

function mwToDbm(mw: number): number {
  return 10 * Math.log10(Math.max(mw, 1e-15));
}

function computeFsplDb(rangeKm: number, frequencyGHz: number): number {
  return 92.45 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(frequencyGHz);
}

function computeNoiseDbm(profile: PaperProfile): number {
  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const thermalNoiseDbm = -174 + 10 * Math.log10(bandwidthHz);
  const noiseFigureDb = 5;
  return thermalNoiseDbm + noiseFigureDb;
}

function estimateRangeKm(ue: UEState, satellite: SatelliteState): number {
  const dx = satellite.positionWorld[0] - ue.positionWorld[0];
  const dy = satellite.positionWorld[1] - ue.positionWorld[1];
  const dz = satellite.positionWorld[2] - ue.positionWorld[2];
  const rangeWorld = Math.hypot(dx, dy, dz);

  // Keep world-to-km conversion aligned with scenario scaling (0.6 world unit per km by default).
  const WORLD_PER_KM = 0.6;
  return rangeWorld / WORLD_PER_KM;
}

function beamContainsUe(ue: UEState, beamCenter: [number, number, number], radiusWorld: number): boolean {
  const dx = ue.positionWorld[0] - beamCenter[0];
  const dz = ue.positionWorld[2] - beamCenter[2];
  return Math.hypot(dx, dz) <= radiusWorld;
}

function computeRsrpDbm(profile: PaperProfile, rangeKm: number): number {
  const eirpDbm = profile.beam.eirpDensityDbwPerMHz + 30;
  const fsplDb = computeFsplDb(rangeKm, profile.channel.carrierFrequencyGHz);
  return eirpDbm + profile.channel.ueAntennaGainDbi - fsplDb - SYSTEM_LOSS_DB;
}

export function evaluateLinksForUe(
  profile: PaperProfile,
  ue: UEState,
  satellites: SatelliteState[],
): LinkSample[] {
  const noiseMw = dbmToMw(computeNoiseDbm(profile));
  const entries: DbEntry[] = [];

  for (const satellite of satellites) {
    if (!satellite.visible) {
      continue;
    }

    const rangeKm = estimateRangeKm(ue, satellite);

    for (const beam of satellite.beams) {
      if (!beamContainsUe(ue, beam.centerWorld, beam.radiusWorld)) {
        continue;
      }

      const rsrpDbm = computeRsrpDbm(profile, rangeKm);
      entries.push({
        sample: {
          satId: satellite.id,
          beamId: beam.beamId,
          rsrpDbm,
          sinrDb: -Infinity,
        },
        signalMw: dbmToMw(rsrpDbm),
      });
    }
  }

  if (entries.length === 0) {
    return [];
  }

  const totalSignalMw = entries.reduce((sum, entry) => sum + entry.signalMw, 0);

  return entries.map((entry) => {
    const interferenceMw = Math.max(totalSignalMw - entry.signalMw, 0);
    const sinrMw = entry.signalMw / (interferenceMw + noiseMw);
    const sinrDb = 10 * Math.log10(Math.max(sinrMw, 1e-12));

    return {
      ...entry.sample,
      sinrDb,
    };
  });
}

export function selectBestLink(samples: LinkSample[]): LinkSample | null {
  if (samples.length === 0) {
    return null;
  }

  let best = samples[0];
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].rsrpDbm > best.rsrpDbm) {
      best = samples[index];
    }
  }

  return best;
}

export function computeThroughputMbps(profile: PaperProfile, sinrDb: number): number {
  const sinrLinear = Math.pow(10, sinrDb / 10);
  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const capacityBps = bandwidthHz * Math.log2(1 + Math.max(sinrLinear, 1e-9));
  return capacityBps / 1e6;
}
