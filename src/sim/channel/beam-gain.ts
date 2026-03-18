/**
 * Provenance:
 * - PAP-2023-BHFREQREUSE §III-A (Bessel beam pattern)
 * - PAP-2022-BEAM-MGMT-SPECTRUM §II-B (antenna gain model)
 * - ITU-R S.672-4 (reference radiation pattern for satellite antennas)
 * - ASSUME-BEAM-GAIN-FLOOR-DB
 * - ASSUME-BEAM-OFFAXIS-SMALL-ANGLE
 *
 * Notes:
 * - Pure beam antenna gain functions for SINR calculation.
 * - Three gain models matching GainModel type: flat, bessel-j1, bessel-j1-j3.
 * - Bessel functions implemented as Taylor series (no external dependency).
 */

import type { GainModel } from '@/config/paper-profiles/types';

/** Gain floor in dB — pattern nulls below this are clamped. */
const GAIN_FLOOR_DB = -20; // ASSUME-BEAM-GAIN-FLOOR-DB

/** α scaling constant: first zero of 2·J₁(u)/u occurs at u ≈ 3.8317,
 *  and 3dB point is at u ≈ 2.07123. */
const ALPHA_3DB = 2.07123;

// ── Taylor-series Bessel functions ──

function besselJ1(x: number): number {
  // J₁(x) = Σ (-1)^k / (k! (k+1)!) · (x/2)^(2k+1)
  const halfX = x / 2;
  let term = halfX;
  let sum = term;
  for (let k = 1; k <= 12; k++) {
    term *= -(halfX * halfX) / (k * (k + 1));
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

function besselJ3(x: number): number {
  // J₃(x) = Σ (-1)^k / (k! (k+3)!) · (x/2)^(2k+3)
  const halfX = x / 2;
  let term = (halfX * halfX * halfX) / 6; // (x/2)^3 / 3!
  let sum = term;
  for (let k = 1; k <= 12; k++) {
    term *= -(halfX * halfX) / (k * (k + 3));
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

/**
 * Compute beam antenna gain in dB relative to boresight (0 dB at center).
 *
 * @param offAxisDeg - Angular offset from beam boresight in degrees
 * @param beamwidth3dBDeg - Half-power (3 dB) beamwidth in degrees
 * @param gainModel - Gain pattern model
 * @returns Gain in dB (0 at boresight, negative off-axis, floored at GAIN_FLOOR_DB)
 */
export function computeBeamGainDb(
  offAxisDeg: number,
  beamwidth3dBDeg: number,
  gainModel: GainModel,
): number {
  if (gainModel === 'flat' || gainModel === 'custom') {
    return 0;
  }

  if (offAxisDeg <= 0 || beamwidth3dBDeg <= 0) {
    return 0; // boresight
  }

  const sinTheta = Math.sin((offAxisDeg * Math.PI) / 180);
  const sin3dB = Math.sin((beamwidth3dBDeg * Math.PI) / 180);
  const alpha = ALPHA_3DB * sinTheta / Math.max(sin3dB, 1e-12);

  if (alpha < 1e-9) {
    return 0; // effectively at boresight
  }

  let normalizedPattern: number;

  if (gainModel === 'bessel-j1') {
    // G(θ) = [2·J₁(α)/α]²
    const envelope = 2 * besselJ1(alpha) / alpha;
    normalizedPattern = envelope * envelope;
  } else {
    // bessel-j1-j3: G(θ) = [2·J₁(α)/α + 36·J₃(α)/α³]²
    const term1 = 2 * besselJ1(alpha) / alpha;
    const term2 = 36 * besselJ3(alpha) / (alpha * alpha * alpha);
    const envelope = term1 + term2;
    normalizedPattern = envelope * envelope;
  }

  const gainDb = 10 * Math.log10(Math.max(normalizedPattern, 1e-12));
  return Math.max(gainDb, GAIN_FLOOR_DB);
}

/**
 * Compute off-axis angle from UE ground distance and satellite altitude.
 * ASSUME-BEAM-OFFAXIS-SMALL-ANGLE: uses atan(d/h), valid for LEO footprints (r << h).
 *
 * @param ueDistanceKm - Ground distance from UE to beam center projection in km
 * @param altitudeKm - Satellite altitude in km
 * @returns Off-axis angle in degrees
 */
export function computeOffAxisDeg(ueDistanceKm: number, altitudeKm: number): number {
  if (altitudeKm <= 0 || ueDistanceKm <= 0) {
    return 0;
  }
  return (Math.atan(ueDistanceKm / altitudeKm) * 180) / Math.PI;
}

/** Re-export floor constant for external consumers (e.g. link-budget skip check). */
export const BEAM_GAIN_FLOOR_DB = GAIN_FLOOR_DB;
