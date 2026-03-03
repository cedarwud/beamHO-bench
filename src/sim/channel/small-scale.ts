import type { PaperProfile } from '@/config/paper-profiles/types';

/**
 * Provenance:
 * - PAP-2024-MADRL-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 * - ASSUME-SMALL-SCALE-PARAMS-DEFAULT
 * - ASSUME-SMALL-SCALE-REALISM-OPTIONS
 *
 * Notes:
 * - Deterministic fading is preserved for fixed tuple inputs.
 * - Temporal correlation and Doppler-aware options are opt-in and profile-scoped.
 */

export interface SmallScaleLinkContext {
  ueId: number;
  satId: number;
  beamId: number;
  rangeKm: number;
  elevationDeg: number;
  ueSpeedKmph?: number;
  tick?: number;
  timeSec?: number;
  timeStepSec?: number;
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

interface TemporalCorrelationParams {
  enabled: boolean;
  coefficient: number;
}

interface DopplerAwareParams {
  enabled: boolean;
  velocityScale: number;
  speedOfLightMps: number;
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

const DEFAULT_TEMPORAL_CORRELATION_PARAMS: TemporalCorrelationParams = {
  // Source: ASSUME-SMALL-SCALE-REALISM-OPTIONS
  // Disabled by default to preserve legacy small-scale behavior.
  enabled: false,
  coefficient: 0.85,
};

const DEFAULT_DOPPLER_AWARE_PARAMS: DopplerAwareParams = {
  // Source: ASSUME-SMALL-SCALE-REALISM-OPTIONS
  // Disabled by default; enabled mode uses profile-scoped scaling constants.
  enabled: false,
  velocityScale: 1,
  speedOfLightMps: 299792458,
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

function unitFromSeed(seed: number): number {
  return (hash32(seed) + 0.5) / 4294967296;
}

function normalFromSeeds(seedA: number, seedB: number): number {
  const u1 = Math.max(unitFromSeed(seedA), 1e-12);
  const u2 = unitFromSeed(seedB);
  const radius = Math.sqrt(-2 * Math.log(u1));
  return radius * Math.cos(2 * Math.PI * u2);
}

function resolveTemporalState(context: SmallScaleLinkContext): {
  tick: number;
  timeSec: number;
  timeStepSec: number;
} {
  const timeStepSec =
    Number.isFinite(context.timeStepSec) && (context.timeStepSec as number) > 0
      ? (context.timeStepSec as number)
      : 1;
  const tickFromContext = Number.isFinite(context.tick) ? Math.round(context.tick as number) : null;
  const timeSecFromContext = Number.isFinite(context.timeSec) ? (context.timeSec as number) : null;
  const tick = tickFromContext ?? Math.round((timeSecFromContext ?? 0) / timeStepSec);
  const timeSec = timeSecFromContext ?? tick * timeStepSec;
  return {
    tick,
    timeSec,
    timeStepSec,
  };
}

function buildLegacySeed(context: SmallScaleLinkContext, salt: number): number {
  let seed = hash32(salt);
  seed = combineSeed(seed, context.ueId);
  seed = combineSeed(seed, context.satId);
  seed = combineSeed(seed, context.beamId);
  seed = combineSeed(seed, quantize(context.rangeKm, 100));
  seed = combineSeed(seed, quantize(context.elevationDeg, 100));
  return seed;
}

function buildTemporalSeed(
  context: SmallScaleLinkContext,
  salt: number,
  tick: number,
): number {
  let seed = buildLegacySeed(context, salt);
  seed = combineSeed(seed, tick);
  return seed;
}

function resolveShadowedRicianParams(profile: PaperProfile): ShadowedRicianParams {
  return profile.channel.smallScaleParams?.shadowedRician ?? DEFAULT_SHADOWED_RICIAN_PARAMS;
}

function resolveLooParams(profile: PaperProfile): LooParams {
  return profile.channel.smallScaleParams?.loo ?? DEFAULT_LOO_PARAMS;
}

function resolveTemporalCorrelationParams(profile: PaperProfile): TemporalCorrelationParams {
  const value = profile.channel.smallScaleParams?.temporalCorrelation;
  return {
    enabled: value?.enabled ?? DEFAULT_TEMPORAL_CORRELATION_PARAMS.enabled,
    coefficient: clamp(value?.coefficient ?? DEFAULT_TEMPORAL_CORRELATION_PARAMS.coefficient, 0, 0.999999),
  };
}

function resolveDopplerAwareParams(profile: PaperProfile): DopplerAwareParams {
  const value = profile.channel.smallScaleParams?.dopplerAware;
  const speedOfLightMps = value?.speedOfLightMps ?? DEFAULT_DOPPLER_AWARE_PARAMS.speedOfLightMps;
  return {
    enabled: value?.enabled ?? DEFAULT_DOPPLER_AWARE_PARAMS.enabled,
    velocityScale: Math.max(value?.velocityScale ?? DEFAULT_DOPPLER_AWARE_PARAMS.velocityScale, 0),
    speedOfLightMps: Number.isFinite(speedOfLightMps) && speedOfLightMps > 0
      ? speedOfLightMps
      : DEFAULT_DOPPLER_AWARE_PARAMS.speedOfLightMps,
  };
}

function computeShadowedRicianLegacyFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  const params = resolveShadowedRicianParams(profile);
  const elevationNorm = clamp(context.elevationDeg / 90, 0, 1);
  const kDb =
    params.kFactorMinDb + (params.kFactorMaxDb - params.kFactorMinDb) * elevationNorm;
  const kLinear = Math.pow(10, kDb / 10);
  const losShadow = normalFromSeeds(buildLegacySeed(context, 11), buildLegacySeed(context, 13));
  const diffuse = normalFromSeeds(buildLegacySeed(context, 17), buildLegacySeed(context, 19));
  const diffuseScale = params.multipathStdDevDb / Math.sqrt(1 + kLinear);
  return losShadow * params.shadowingStdDevDb + diffuse * diffuseScale;
}

function computeLooLegacyFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  const params = resolveLooParams(profile);
  const shadowing = normalFromSeeds(buildLegacySeed(context, 23), buildLegacySeed(context, 29));
  const u = Math.max(unitFromSeed(buildLegacySeed(context, 31)), 1e-12);
  const rayleighAmplitude = Math.sqrt(-2 * Math.log(u));
  const rayleighDb = 20 * Math.log10(Math.max(rayleighAmplitude, 1e-9));
  return shadowing * params.shadowingStdDevDb + rayleighDb * params.rayleighScaleDb;
}

function computeShadowedRicianInnovationDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
  tick: number,
): number {
  const params = resolveShadowedRicianParams(profile);
  const elevationNorm = clamp(context.elevationDeg / 90, 0, 1);
  const kDb =
    params.kFactorMinDb + (params.kFactorMaxDb - params.kFactorMinDb) * elevationNorm;
  const kLinear = Math.pow(10, kDb / 10);
  const losShadow = normalFromSeeds(
    buildTemporalSeed(context, 111, tick),
    buildTemporalSeed(context, 113, tick),
  );
  const diffuse = normalFromSeeds(
    buildTemporalSeed(context, 117, tick),
    buildTemporalSeed(context, 119, tick),
  );
  const diffuseScale = params.multipathStdDevDb / Math.sqrt(1 + kLinear);
  return losShadow * params.shadowingStdDevDb + diffuse * diffuseScale;
}

function computeLooInnovationDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
  tick: number,
): number {
  const params = resolveLooParams(profile);
  const shadowing = normalFromSeeds(
    buildTemporalSeed(context, 123, tick),
    buildTemporalSeed(context, 129, tick),
  );
  const u = Math.max(unitFromSeed(buildTemporalSeed(context, 131, tick)), 1e-12);
  const rayleighAmplitude = Math.sqrt(-2 * Math.log(u));
  const rayleighDb = 20 * Math.log10(Math.max(rayleighAmplitude, 1e-9));
  return shadowing * params.shadowingStdDevDb + rayleighDb * params.rayleighScaleDb;
}

function applyTemporalCorrelation(
  currentInnovationDb: number,
  previousInnovationDb: number,
  coefficient: number,
): number {
  const alpha = clamp(coefficient, 0, 0.999999);
  const innovationWeight = Math.sqrt(Math.max(1 - alpha ** 2, 0));
  return alpha * previousInnovationDb + innovationWeight * currentInnovationDb;
}

function resolveDopplerAmplitudeDb(
  profile: PaperProfile,
  model: PaperProfile['channel']['smallScaleModel'],
): number {
  if (model === 'shadowed-rician') {
    return resolveShadowedRicianParams(profile).multipathStdDevDb;
  }
  if (model === 'loo') {
    return resolveLooParams(profile).rayleighScaleDb;
  }
  return 0;
}

function computeDopplerTermDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
  timeSec: number,
  amplitudeDb: number,
  dopplerAware: DopplerAwareParams,
): number {
  if (amplitudeDb <= 0) {
    return 0;
  }
  const ueSpeedKmph = Math.max(context.ueSpeedKmph ?? 0, 0);
  const speedMps = (ueSpeedKmph / 3.6) * dopplerAware.velocityScale;
  if (speedMps <= 0) {
    return 0;
  }
  const carrierHz = profile.channel.carrierFrequencyGHz * 1e9;
  const shiftHz = (carrierHz * speedMps) / dopplerAware.speedOfLightMps;
  const phaseOffset = 2 * Math.PI * unitFromSeed(buildLegacySeed(context, 151));
  const phase = 2 * Math.PI * shiftHz * timeSec + phaseOffset;
  return Math.cos(phase) * amplitudeDb;
}

function computeRealismEnhancedFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  const model = profile.channel.smallScaleModel;
  if (model !== 'shadowed-rician' && model !== 'loo') {
    return 0;
  }

  const temporal = resolveTemporalCorrelationParams(profile);
  const dopplerAware = resolveDopplerAwareParams(profile);
  if (!temporal.enabled && !dopplerAware.enabled) {
    return model === 'shadowed-rician'
      ? computeShadowedRicianLegacyFadingDb(profile, context)
      : computeLooLegacyFadingDb(profile, context);
  }

  const temporalState = resolveTemporalState(context);
  const computeInnovation =
    model === 'shadowed-rician'
      ? computeShadowedRicianInnovationDb
      : computeLooInnovationDb;

  let fadingDb = computeInnovation(profile, context, temporalState.tick);
  if (temporal.enabled) {
    const previousInnovation = computeInnovation(profile, context, temporalState.tick - 1);
    fadingDb = applyTemporalCorrelation(
      fadingDb,
      previousInnovation,
      temporal.coefficient,
    );
  }

  if (dopplerAware.enabled) {
    fadingDb += computeDopplerTermDb(
      profile,
      context,
      temporalState.timeSec,
      resolveDopplerAmplitudeDb(profile, model),
      dopplerAware,
    );
  }
  return fadingDb;
}

export function computeSmallScaleFadingDb(
  profile: PaperProfile,
  context: SmallScaleLinkContext,
): number {
  // Source: PAP-2024-MADRL-CORE
  // Small-scale plugin is selected from profile.channel.smallScaleModel.
  switch (profile.channel.smallScaleModel) {
    case 'shadowed-rician':
    case 'loo':
      return computeRealismEnhancedFadingDb(profile, context);
    case 'none':
    default:
      return 0;
  }
}
