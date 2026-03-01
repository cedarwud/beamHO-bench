import type { PaperProfile } from '@/config/paper-profiles/types';
import type { SatelliteState, UEState } from '@/sim/types';
import {
  beamContainsUe,
  computeNoiseDbm,
  computeRsrpDbm,
  estimateRangeKm,
} from './large-scale';
import { computeSmallScaleFadingDb } from './small-scale';

/**
 * Provenance:
 * - STD-3GPP-TR38.811-6.6.2-1
 * - PAP-2024-MADRL-CORE
 * - ASSUME-LINK-SYSTEM-LOSS-DB
 * - ASSUME-RX-NOISE-FIGURE-DB
 * - ASSUME-SMALL-SCALE-PARAMS-DEFAULT
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

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

export function evaluateLinksForUe(
  profile: PaperProfile,
  ue: UEState,
  satellites: SatelliteState[],
): LinkSample[] {
  const noiseMw = dbmToMw(
    computeNoiseDbm({
      bandwidthMHz: profile.channel.bandwidthMHz,
      noiseTemperatureK: profile.channel.noiseTemperatureK,
      noiseFigureDb: profile.channel.noiseFigureDb,
    }),
  );
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

      const smallScaleFadingDb = computeSmallScaleFadingDb(profile, {
        ueId: ue.id,
        satId: satellite.id,
        beamId: beam.beamId,
        rangeKm,
        elevationDeg: satellite.elevationDeg,
      });
      const rsrpDbm =
        computeRsrpDbm({
          eirpDensityDbwPerMHz: profile.beam.eirpDensityDbwPerMHz,
          bandwidthMHz: profile.channel.bandwidthMHz,
          carrierFrequencyGHz: profile.channel.carrierFrequencyGHz,
          ueAntennaGainDbi: profile.channel.ueAntennaGainDbi,
          systemLossDb: profile.channel.systemLossDb,
          rangeKm,
        }) + smallScaleFadingDb;
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
