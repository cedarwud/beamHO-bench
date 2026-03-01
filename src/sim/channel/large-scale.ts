import type { SatelliteState, UEState } from '@/sim/types';

/**
 * Provenance:
 * - STD-3GPP-TR38.811-6.6.2-1
 * - ASSUME-LINK-SYSTEM-LOSS-DB
 * - ASSUME-RX-NOISE-FIGURE-DB
 *
 * Notes:
 * - This module implements deterministic large-scale radio terms:
 *   geometric range, FSPL, thermal noise, and static link-budget terms.
 */

interface NoiseInput {
  bandwidthMHz: number;
  noiseTemperatureK: number;
  noiseFigureDb: number;
}

interface RsrpInput {
  eirpDensityDbwPerMHz: number;
  bandwidthMHz: number;
  carrierFrequencyGHz: number;
  ueAntennaGainDbi: number;
  systemLossDb: number;
  rangeKm: number;
}

const WGS84_A_KM = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B_KM = WGS84_A_KM * (1 - WGS84_F);
const BOLTZMANN_K = 1.380649e-23;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function geodeticToEcefKm(
  latDeg: number,
  lonDeg: number,
  altKm: number,
): [number, number, number] {
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);
  const e2 = 1 - (WGS84_B_KM * WGS84_B_KM) / (WGS84_A_KM * WGS84_A_KM);
  const n = WGS84_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);

  return [
    (n + altKm) * cosLat * cosLon,
    (n + altKm) * cosLat * sinLon,
    (n * (1 - e2) + altKm) * sinLat,
  ];
}

function estimateRangeKmFromWorld(ue: UEState, satellite: SatelliteState): number {
  const dx = satellite.positionWorld[0] - ue.positionWorld[0];
  const dy = satellite.positionWorld[1] - ue.positionWorld[1];
  const dz = satellite.positionWorld[2] - ue.positionWorld[2];
  const rangeWorld = Math.hypot(dx, dy, dz);
  const beamWithScale = satellite.beams.find(
    (beam) => beam.radiusKm > 0 && beam.radiusWorld > 0,
  );

  if (beamWithScale) {
    const worldPerKm = beamWithScale.radiusWorld / beamWithScale.radiusKm;
    return rangeWorld / Math.max(worldPerKm, 1e-9);
  }

  return satellite.rangeKm;
}

export function estimateRangeKm(ue: UEState, satellite: SatelliteState): number {
  const [ueLat, ueLon] = ue.positionLatLon;
  const [satX, satY, satZ] = satellite.positionEcef;
  const satRadiusKm = Math.hypot(satX, satY, satZ);

  if (
    Number.isFinite(ueLat) &&
    Number.isFinite(ueLon) &&
    Number.isFinite(satX) &&
    Number.isFinite(satY) &&
    Number.isFinite(satZ) &&
    satRadiusKm > 5000
  ) {
    const ueEcefKm = geodeticToEcefKm(ueLat, ueLon, 0);
    return Math.hypot(
      satX - ueEcefKm[0],
      satY - ueEcefKm[1],
      satZ - ueEcefKm[2],
    );
  }

  return estimateRangeKmFromWorld(ue, satellite);
}

export function beamContainsUe(
  ue: UEState,
  beamCenter: [number, number, number],
  radiusWorld: number,
): boolean {
  const dx = ue.positionWorld[0] - beamCenter[0];
  const dz = ue.positionWorld[2] - beamCenter[2];
  return Math.hypot(dx, dz) <= radiusWorld;
}

export function computeFsplDb(rangeKm: number, frequencyGHz: number): number {
  // Source: STD-3GPP-TR38.811-6.6.2-1
  // Free-space path loss in dB, range in km and frequency in GHz.
  return 92.45 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(frequencyGHz);
}

export function computeNoiseDbm(input: NoiseInput): number {
  // Source: STD-3GPP-TR38.811-6.6.2-1
  // Thermal noise is kTB, then add profile-driven receiver noise figure.
  const bandwidthHz = input.bandwidthMHz * 1e6;
  const thermalNoiseW = BOLTZMANN_K * input.noiseTemperatureK * bandwidthHz;
  const thermalNoiseDbm = 10 * Math.log10(Math.max(thermalNoiseW * 1e3, 1e-15));
  return thermalNoiseDbm + input.noiseFigureDb;
}

export function computeRsrpDbm(input: RsrpInput): number {
  // Source: ASSUME-LINK-SYSTEM-LOSS-DB
  // Aggregate implementation loss is profile-sourced for traceable calibration.
  const eirpDbw =
    input.eirpDensityDbwPerMHz + 10 * Math.log10(Math.max(input.bandwidthMHz, 1e-9));
  const eirpDbm = eirpDbw + 30;
  const fsplDb = computeFsplDb(input.rangeKm, input.carrierFrequencyGHz);
  return eirpDbm + input.ueAntennaGainDbi - fsplDb - input.systemLossDb;
}
