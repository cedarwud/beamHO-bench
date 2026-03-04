import type { DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { ResearchParameterSelection } from './types';

export type ResearchConsistencyMode = 'strict' | 'exploratory';
export type ResearchConsistencyIssueSeverity = 'info' | 'warn' | 'error';

export interface ResearchConsistencyIssue {
  ruleId: string;
  messageCode: string;
  severity: ResearchConsistencyIssueSeverity;
  parameterIds: string[];
  message: string;
}

export interface ResearchConsistencyResolution {
  mode: ResearchConsistencyMode;
  selection: ResearchParameterSelection;
  derivedOverrides: DeepPartial<PaperProfile>;
  issues: ResearchConsistencyIssue[];
}

export interface BuildResearchRuntimeOverridesResult {
  mode: ResearchConsistencyMode;
  selection: ResearchParameterSelection;
  overrides: DeepPartial<PaperProfile>;
  issues: ResearchConsistencyIssue[];
}

const EARTH_GRAVITATIONAL_PARAMETER_KM3_PER_SEC2 = 398600.4418;
const EARTH_MEAN_RADIUS_KM = 6371;

function asBoolean(value: string): boolean {
  return value === 'true';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergePaperProfileOverrides(
  target: DeepPartial<PaperProfile>,
  source: DeepPartial<PaperProfile>,
): DeepPartial<PaperProfile> {
  const output = target as Record<string, unknown>;
  const patch = source as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (isPlainObject(value) && isPlainObject(output[key])) {
      mergePaperProfileOverrides(
        output[key] as DeepPartial<PaperProfile>,
        value as DeepPartial<PaperProfile>,
      );
      continue;
    }
    output[key] = value;
  }
  return target;
}

function toRounded(value: number, digits: number): number {
  const factor = 10 ** Math.max(0, Math.round(digits));
  return Math.round(value * factor) / factor;
}

function deriveCircularOrbitSpeedKmps(altitudeKm: number): number {
  // Source: ASSUME-CIRCULAR-ORBIT-SPEED-DERIVATION
  // Circular-orbit approximation keeps paper-baseline synthetic kinematics altitude-consistent.
  const orbitRadiusKm = Math.max(EARTH_MEAN_RADIUS_KM + altitudeKm, 1);
  return Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_PER_SEC2 / orbitRadiusKm);
}

function deriveFootprintDiameterKm(options: {
  altitudeKm: number;
  beamwidth3dBDeg: number;
}): number {
  const { altitudeKm, beamwidth3dBDeg } = options;
  // Source: ASSUME-BEAM-FOOTPRINT-GEOMETRY-COUPLING
  // Footprint uses a first-order cone geometry approximation from altitude and beamwidth.
  const halfAngleRad = (Math.max(beamwidth3dBDeg, 0) * Math.PI) / 360;
  return 2 * Math.max(altitudeKm, 0) * Math.tan(Math.max(halfAngleRad, 1e-9));
}

export function resolveResearchParameterConsistency(options: {
  profile: PaperProfile;
  selection: ResearchParameterSelection;
  mode?: ResearchConsistencyMode;
}): ResearchConsistencyResolution {
  const mode = options.mode ?? 'strict';
  const selection = { ...options.selection };
  const issues: ResearchConsistencyIssue[] = [];
  const derivedOverrides: DeepPartial<PaperProfile> = {};

  // Hard constraint: active-window size cannot exceed synthetic per-plane count.
  const maxActiveWindow = Math.max(1, Math.round(options.profile.constellation.satellitesPerPlane));
  const requestedActiveWindow = Math.max(
    1,
    Math.round(Number(selection['constellation.activeSatellitesInWindow']) || 1),
  );
  if (requestedActiveWindow > maxActiveWindow) {
    selection['constellation.activeSatellitesInWindow'] = String(maxActiveWindow);
    issues.push({
      ruleId: 'PC-HARD-ACTIVE-WINDOW-UPPER-BOUND',
      messageCode: 'active_window_clamped_to_satellites_per_plane',
      severity: 'warn',
      parameterIds: ['constellation.activeSatellitesInWindow', 'constellation.satellitesPerPlane'],
      message: `Requested activeSatellitesInWindow=${requestedActiveWindow} exceeds satellitesPerPlane=${maxActiveWindow}; clamped to ${maxActiveWindow}.`,
    });
  }

  // Hard constraint: realism toggles are invalid when small-scale model is disabled.
  if (selection['channel.smallScaleModel'] === 'none') {
    if (asBoolean(selection['channel.smallScaleParams.temporalCorrelation.enabled'])) {
      selection['channel.smallScaleParams.temporalCorrelation.enabled'] = 'false';
      issues.push({
        ruleId: 'PC-HARD-SMALL-SCALE-TEMPORAL-REQUIRES-MODEL',
        messageCode: 'temporal_disabled_when_small_scale_none',
        severity: 'warn',
        parameterIds: [
          'channel.smallScaleModel',
          'channel.smallScaleParams.temporalCorrelation.enabled',
        ],
        message: 'Temporal correlation is disabled because smallScaleModel=none.',
      });
    }
    if (asBoolean(selection['channel.smallScaleParams.dopplerAware.enabled'])) {
      selection['channel.smallScaleParams.dopplerAware.enabled'] = 'false';
      issues.push({
        ruleId: 'PC-HARD-SMALL-SCALE-DOPPLER-REQUIRES-MODEL',
        messageCode: 'doppler_disabled_when_small_scale_none',
        severity: 'warn',
        parameterIds: ['channel.smallScaleModel', 'channel.smallScaleParams.dopplerAware.enabled'],
        message: 'Doppler-aware fading is disabled because smallScaleModel=none.',
      });
    }
  }

  // Derived coupling is only applied in synthetic paper-baseline mode.
  if (options.profile.mode === 'paper-baseline') {
    const requestedAltitudeKm = Number(selection['constellation.altitudeKm']);
    const baseAltitudeKm = options.profile.constellation.altitudeKm;
    if (
      Number.isFinite(requestedAltitudeKm) &&
      Math.abs(requestedAltitudeKm - baseAltitudeKm) > 1e-9
    ) {
      const derivedSpeedKmps = toRounded(deriveCircularOrbitSpeedKmps(requestedAltitudeKm), 3);
      const derivedFootprintDiameterKm = toRounded(
        deriveFootprintDiameterKm({
          altitudeKm: requestedAltitudeKm,
          beamwidth3dBDeg: options.profile.beam.beamwidth3dBDeg,
        }),
        3,
      );

      derivedOverrides.constellation ??= {};
      derivedOverrides.constellation.satelliteSpeedKmps = derivedSpeedKmps;
      derivedOverrides.beam ??= {};
      derivedOverrides.beam.footprintDiameterKm = derivedFootprintDiameterKm;

      issues.push({
        ruleId: 'PC-DERIVE-ALTITUDE-COUPLING',
        messageCode: 'altitude_derived_speed_and_footprint',
        severity: 'info',
        parameterIds: [
          'constellation.altitudeKm',
          'constellation.satelliteSpeedKmps',
          'beam.footprintDiameterKm',
          'beam.beamwidth3dBDeg',
        ],
        message:
          'Altitude override applied derived satelliteSpeedKmps and beam footprint diameter for baseline physical consistency.',
      });
    }
  }

  // Soft warning: TTT values below tick granularity may collapse to one-tick behavior.
  const tttMs = Math.max(0, Math.round(Number(selection['handover.params.a3TttMs']) || 0));
  const tickMs = Math.max(1, Math.round(options.profile.timeStepSec * 1000));
  if (tttMs > 0 && tttMs < tickMs) {
    issues.push({
      ruleId: 'PC-WARN-TTT-TICK-ALIAS',
      messageCode: 'ttt_below_tick_granularity',
      severity: 'warn',
      parameterIds: ['handover.params.a3TttMs', 'timeStepSec'],
      message: `Configured TTT=${tttMs}ms is below tick granularity=${tickMs}ms and may collapse to one-tick behavior.`,
    });
  }

  return {
    mode,
    selection,
    derivedOverrides,
    issues,
  };
}
