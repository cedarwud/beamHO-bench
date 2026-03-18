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

export interface ResearchConsistencySummary {
  mode: ResearchConsistencyMode;
  issueCount: number;
  issueCodes: string[];
  issues: Array<{
    ruleId: string;
    messageCode: string;
    severity: ResearchConsistencyIssueSeverity;
    parameterIds: string[];
  }>;
}

const EARTH_GRAVITATIONAL_PARAMETER_KM3_PER_SEC2 = 398600.4418;
const EARTH_MEAN_RADIUS_KM = 6371;

function asBoolean(value: string): boolean {
  return value === 'true';
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(1, Math.round(fallback));
  }
  return Math.max(1, Math.round(parsed));
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

  const syntheticTrajectoryModel =
    selection['constellation.syntheticTrajectoryModel'] ??
    options.profile.constellation.syntheticTrajectoryModel ??
    'linear-drift';
  const requestedOrbitalPlanes = toPositiveInt(
    selection['constellation.orbitalPlanes'],
    options.profile.constellation.orbitalPlanes,
  );
  const requestedSatellitesPerPlane = toPositiveInt(
    selection['constellation.satellitesPerPlane'],
    options.profile.constellation.satellitesPerPlane,
  );
  const effectiveOrbitalPlanes =
    syntheticTrajectoryModel === 'walker-circular'
      ? requestedOrbitalPlanes
      : Math.max(1, Math.round(options.profile.constellation.orbitalPlanes));
  const effectiveSatellitesPerPlane =
    syntheticTrajectoryModel === 'walker-circular'
      ? requestedSatellitesPerPlane
      : Math.max(1, Math.round(options.profile.constellation.satellitesPerPlane));

  // Hard constraint: active-window size cannot exceed effective constellation capacity.
  const maxActiveWindow = Math.max(1, effectiveOrbitalPlanes * effectiveSatellitesPerPlane);
  const requestedActiveWindow = Math.max(
    1,
    Math.round(Number(selection['constellation.activeSatellitesInWindow']) || 1),
  );
  if (requestedActiveWindow > maxActiveWindow) {
    selection['constellation.activeSatellitesInWindow'] = String(maxActiveWindow);
    issues.push({
      ruleId: 'PC-HARD-ACTIVE-WINDOW-UPPER-BOUND',
      messageCode: 'active_window_clamped_to_constellation_capacity',
      severity: 'warn',
      parameterIds: [
        'constellation.activeSatellitesInWindow',
        'constellation.orbitalPlanes',
        'constellation.satellitesPerPlane',
      ],
      message: `Requested activeSatellitesInWindow=${requestedActiveWindow} exceeds constellation capacity=${maxActiveWindow} (planes=${effectiveOrbitalPlanes}, satellitesPerPlane=${effectiveSatellitesPerPlane}); clamped to ${maxActiveWindow}.`,
    });
  }
  const effectiveActiveWindow = Math.min(requestedActiveWindow, maxActiveWindow);
  const requestedCandidateSatelliteLimit = Math.max(
    1,
    Math.round(
      Number(selection['handover.params.candidateSatelliteLimit']) || effectiveActiveWindow,
    ),
  );
  if (requestedCandidateSatelliteLimit > effectiveActiveWindow) {
    selection['handover.params.candidateSatelliteLimit'] = String(effectiveActiveWindow);
    issues.push({
      ruleId: 'PC-HARD-CANDIDATE-WINDOW-UPPER-BOUND',
      messageCode: 'candidate_window_clamped_to_scene_window',
      severity: 'warn',
      parameterIds: [
        'handover.params.candidateSatelliteLimit',
        'constellation.activeSatellitesInWindow',
      ],
      message: `Requested candidateSatelliteLimit=${requestedCandidateSatelliteLimit} exceeds activeSatellitesInWindow=${effectiveActiveWindow}; clamped to ${effectiveActiveWindow}.`,
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

  // Cross-check profile speed against orbital mechanics formula (all modes).
  // PROJECT_CONSTRAINTS §2.6: derived physical quantities must match formulas.
  {
    const profileAlt = options.profile.constellation.altitudeKm;
    const profileSpeed = options.profile.constellation.satelliteSpeedKmps ?? 0;
    const expectedSpeed = toRounded(deriveCircularOrbitSpeedKmps(profileAlt), 2);
    if (profileSpeed > 0 && Math.abs(profileSpeed - expectedSpeed) > 0.05) {
      issues.push({
        ruleId: 'PC-CHECK-SPEED-FORMULA',
        messageCode: 'profile_speed_diverges_from_formula',
        severity: 'warn',
        parameterIds: ['constellation.satelliteSpeedKmps', 'constellation.altitudeKm'],
        message: `Profile satelliteSpeedKmps=${profileSpeed} diverges from v=√(μ/r)=${expectedSpeed} at altitude=${profileAlt}km (Δ=${toRounded(Math.abs(profileSpeed - expectedSpeed), 3)} km/s).`,
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
    if (mode === 'strict') {
      selection['handover.params.a3TttMs'] = String(tickMs);
      issues.push({
        ruleId: 'PC-WARN-TTT-TICK-ALIAS',
        messageCode: 'ttt_clamped_to_tick_granularity_in_strict_mode',
        severity: 'warn',
        parameterIds: ['handover.params.a3TttMs', 'timeStepSec'],
        message: `Configured TTT=${tttMs}ms is below tick granularity=${tickMs}ms; strict mode raised TTT to ${tickMs}ms.`,
      });
    } else {
      issues.push({
        ruleId: 'PC-WARN-TTT-TICK-ALIAS',
        messageCode: 'ttt_below_tick_granularity',
        severity: 'warn',
        parameterIds: ['handover.params.a3TttMs', 'timeStepSec'],
        message: `Configured TTT=${tttMs}ms is below tick granularity=${tickMs}ms and may collapse to one-tick behavior.`,
      });
    }
  }

  return {
    mode,
    selection,
    derivedOverrides,
    issues,
  };
}

export function summarizeResearchConsistency(options: {
  mode: ResearchConsistencyMode;
  issues: ResearchConsistencyIssue[];
}): ResearchConsistencySummary {
  const normalizedIssues = options.issues
    .map((issue) => ({
      ruleId: issue.ruleId,
      messageCode: issue.messageCode,
      severity: issue.severity,
      parameterIds: [...issue.parameterIds].sort(),
    }))
    .sort((left, right) => {
      if (left.ruleId !== right.ruleId) {
        return left.ruleId.localeCompare(right.ruleId);
      }
      if (left.messageCode !== right.messageCode) {
        return left.messageCode.localeCompare(right.messageCode);
      }
      return left.severity.localeCompare(right.severity);
    });

  const issueCodes = [...new Set(
    normalizedIssues.map((issue) => `${issue.ruleId}:${issue.messageCode}`),
  )].sort();

  return {
    mode: options.mode,
    issueCount: normalizedIssues.length,
    issueCodes,
    issues: normalizedIssues,
  };
}
