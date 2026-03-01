import type { PaperProfile } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - PAP-2024-MADRL-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 * - ASSUME-SMALL-SCALE-PARAMS-DEFAULT
 *
 * Notes:
 * - This module provides deterministic small-scale fading plugins so
 *   reproducibility is preserved under fixed scenario + seed conditions.
 */

export interface SmallScaleLinkContext {
  ueId: number;
  satId: number;
  beamId: number;
  rangeKm: number;
  elevationDeg: number;
}

interface ShadowedRicianParams {
  kFactorMinDb: number;
  kFactorMaxDb: number;
  shadowingStdDevDb: number;
  multipathStdDevDb: number;
}

interface LooParams {
  shadowingStdDevDb: number;
  rayleighScaleDb: number;
}

const DEFAULT_SHADOWED_RICIAN_PARAMS: ShadowedRicianParams = {
  kFactorMinDb: -2,
  kFactorMaxDb: 10,
  shadowingStdDevDb: 2.3,
  multipathStdDevDb: 1.8,
};

const DEFAULT_LOO_PARAMS: LooParams = {
  shadowingStdDevDb: 2.5,
  rayleighScaleDb: 0.8,
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function hash32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function combineSeed(base: number, value: number): number {
  return hash32(base ^ hash32(value));
}

function quantize(value: number, scale: number): number {
  return Math.round(value * scale);
}

function buildSeed(context: SmallScaleLinkContext, salt: number): number {
  let seed = hash32(salt);
  seed = combineSeed(seed, context.ueId);
  seed = combineSeed(seed, context.satId);
  seed = combineSeed(seed, context.beamId);
  seed = combineSeed(seed, quantize(context.rangeKm, 100));
  seed = combineSeed(seed, quantize(context.elevationDeg, 100));
  return seed;
}

function unitFromSeed(seed: number): number {
  return (hash32(seed) + 0.5) / 4294967296;
}

function normalFromSeeds(seedA: number, seedB: number): number {
  const u1 = Math.max(unitFromSeed(seedA), 1e-12);
  const u2 = unitFromSeed(seedB);
  const radius = Math.sqrt(-2 * Math.log(u1));
  return radius * Math.cos(2 * Math.PI * u2);
}

function resolveShadowedRicianParams(profile: PaperProfile): ShadowedRicianParams {
  return profile.channel.smallScaleParams?.shadowedRician ?? DEFAULT_SHADOWED_RICIAN_PARAMS;
}

function resolveLooParams(profile: PaperProfile): LooParams {
  return profile.channel.smallScaleParams?.loo ?? DEFAULT_LOO_PARAMS;
}

function computeShadowedRicianFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  const params = resolveShadowedRicianParams(profile);
  const elevationNorm = clamp(context.elevationDeg / 90, 0, 1);
  const kDb =
    params.kFactorMinDb + (params.kFactorMaxDb - params.kFactorMinDb) * elevationNorm;
  const kLinear = Math.pow(10, kDb / 10);
  const losShadow = normalFromSeeds(buildSeed(context, 11), buildSeed(context, 13));
  const diffuse = normalFromSeeds(buildSeed(context, 17), buildSeed(context, 19));
  const diffuseScale = params.multipathStdDevDb / Math.sqrt(1 + kLinear);
  return losShadow * params.shadowingStdDevDb + diffuse * diffuseScale;
}

function computeLooFadingDb(profile: PaperProfile, context: SmallScaleLinkContext): number {
  const params = resolveLooParams(profile);
  const shadowing = normalFromSeeds(buildSeed(context, 23), buildSeed(context, 29));
  const u = Math.max(unitFromSeed(buildSeed(context, 31)), 1e-12);
  const rayleighAmplitude = Math.sqrt(-2 * Math.log(u));
  const rayleighDb = 20 * Math.log10(Math.max(rayleighAmplitude, 1e-9));
  return shadowing * params.shadowingStdDevDb + rayleighDb * params.rayleighScaleDb;
}

export function computeSmallScaleFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  // Source: PAP-2024-MADRL-CORE
  // Small-scale plugin is selected from profile.channel.smallScaleModel.
  switch (profile.channel.smallScaleModel) {
    case 'shadowed-rician':
      return computeShadowedRicianFadingDb(profile, context);
    case 'loo':
      return computeLooFadingDb(profile, context);
    case 'none':
    default:
      return 0;
  }
}
