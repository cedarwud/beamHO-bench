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

export interface LinkEvaluationContext {
  tick?: number;
  timeSec?: number;
  timeStepSec?: number;
}

interface DbEntry {
  sample: LinkSample;
  signalMw: number;
  reuseGroupId: number;
}

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function resolveReuseGroupCount(frequencyReuse: PaperProfile['beam']['frequencyReuse']): number {
  if (frequencyReuse === 'FR1') {
    return 1;
  }
  if (frequencyReuse.startsWith('reuse-')) {
    const count = Number.parseInt(frequencyReuse.slice('reuse-'.length), 10);
    if (Number.isFinite(count) && count > 1) {
      return count;
    }
  }
  return 1;
}

function resolveReuseGroupId(
  profile: PaperProfile,
  sample: Pick<LinkSample, 'beamId'>,
): number {
  const groupCount = resolveReuseGroupCount(profile.beam.frequencyReuse);
  if (groupCount <= 1) {
    return 0;
  }
  return positiveModulo(sample.beamId, groupCount);
}

export function evaluateLinksForUe(
  profile: PaperProfile,
  ue: UEState,
  satellites: SatelliteState[],
  context: LinkEvaluationContext = {},
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
        ueSpeedKmph: ue.speedKmph,
        tick: context.tick,
        timeSec: context.timeSec,
        timeStepSec: context.timeStepSec,
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
        reuseGroupId: resolveReuseGroupId(profile, { beamId: beam.beamId }),
      });
    }
  }

  if (entries.length === 0) {
    return [];
  }

  return entries.map((entry, index) => {
    let interferenceMw = 0;
    for (let otherIndex = 0; otherIndex < entries.length; otherIndex += 1) {
      if (otherIndex === index) {
        continue;
      }
      const other = entries[otherIndex];
      if (other.reuseGroupId !== entry.reuseGroupId) {
        continue;
      }
      interferenceMw += other.signalMw;
    }
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

function computeMcsMappedThroughputMbps(profile: PaperProfile, sinrDb: number): number {
  const sortedTable = [...profile.channel.throughputModel.mcsTable].sort((left, right) => {
    if (left.minSinrDb !== right.minSinrDb) {
      return left.minSinrDb - right.minSinrDb;
    }
    return left.spectralEfficiencyBpsHz - right.spectralEfficiencyBpsHz;
  });
  if (sortedTable.length === 0) {
    return 0;
  }

  let selectedEfficiency = sortedTable[0].spectralEfficiencyBpsHz;
  for (const row of sortedTable) {
    if (sinrDb + 1e-9 >= row.minSinrDb) {
      selectedEfficiency = row.spectralEfficiencyBpsHz;
      continue;
    }
    break;
  }

  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const throughputBps = bandwidthHz * Math.max(selectedEfficiency, 0);
  return throughputBps / 1e6;
}

export function computeThroughputMbps(profile: PaperProfile, sinrDb: number): number {
  // Source: ASSUME-THROUGHPUT-MODEL-POLICY
  // Throughput model is explicit and profile-scoped for cross-paper reproducibility.
  if (profile.channel.throughputModel.model === 'mcs-mapped') {
    // Source: ASSUME-MCS-SPECTRAL-EFFICIENCY-TABLE
    // Optional MCS mode consumes profile-defined SINR-to-efficiency table.
    return computeMcsMappedThroughputMbps(profile, sinrDb);
  }

  const sinrLinear = Math.pow(10, sinrDb / 10);
  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const capacityBps = bandwidthHz * Math.log2(1 + Math.max(sinrLinear, 1e-9));
  return capacityBps / 1e6;
}
