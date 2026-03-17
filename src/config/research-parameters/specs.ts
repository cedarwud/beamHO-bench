import type { DeepPartial } from '@/config/paper-profiles/loader';
import type {
  BeamLayout,
  Deployment,
  FrequencyReuse,
  PaperProfile,
  SmallScaleModel,
  SyntheticTrajectoryModel,
} from '@/config/paper-profiles/types';
import type {
  ResearchParameterOption,
  ResearchParameterSpec,
} from './types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-DAPS-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - ASSUME-MIN-ELEVATION-SENSITIVITY-TIERS
 * - ASSUME-UE-COUNT-TIERS
 * - ASSUME-UE-SPEED-TIERS
 * - ASSUME-BEAM-COUNT-LAYOUT-TIERS
 * - ASSUME-FREQUENCY-REUSE-MODES
 * - ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG
 * - ASSUME-SMALL-SCALE-REALISM-OPTIONS
 *
 * Notes:
 * - This module defines research-critical parameter specifications only.
 * - UI/view controls (render mode, playback speed, link visibility) are intentionally excluded.
 */

function toNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value '${value}' for research parameter '${field}'.`);
  }
  return parsed;
}

function toBoolean(value: string): boolean {
  return value === 'true';
}

function layoutFromBeamCount(beamCount: number): BeamLayout {
  switch (beamCount) {
    case 7:
      return 'hex-7';
    case 16:
      return 'hex-16';
    case 19:
      return 'hex-19';
    case 50:
      return 'hex-50';
    default:
      return 'custom';
  }
}

export function asNearestOptionValue(
  value: string,
  options: ResearchParameterOption[],
): string {
  if (options.length === 0) {
    return value;
  }
  if (options.some((option) => option.value === value)) {
    return value;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return options[0].value;
  }

  let best = options[0];
  let bestDistance = Math.abs(Number(best.value) - numericValue);

  for (let index = 1; index < options.length; index += 1) {
    const candidate = options[index];
    const candidateNumber = Number(candidate.value);
    if (!Number.isFinite(candidateNumber)) {
      continue;
    }
    const distance = Math.abs(candidateNumber - numericValue);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best.value;
}

function stringOfNumber(value: number | undefined, fallback: number): string {
  return String(value ?? fallback);
}

function asFrequencyReuse(value: string): FrequencyReuse {
  if (value === 'FR1' || value === 'reuse-4') {
    return value;
  }
  throw new Error(`Invalid frequency reuse value '${value}'.`);
}

function asSmallScaleModel(value: string): SmallScaleModel {
  if (value === 'none' || value === 'shadowed-rician' || value === 'loo') {
    return value;
  }
  throw new Error(`Invalid small-scale model value '${value}'.`);
}

function asSyntheticTrajectoryModel(value: string): SyntheticTrajectoryModel {
  if (value === 'linear-drift' || value === 'walker-circular') {
    return value;
  }
  throw new Error(`Invalid synthetic trajectory model value '${value}'.`);
}


export const RESEARCH_PARAMETER_SPECS: ResearchParameterSpec[] = [
  {
    id: 'constellation.syntheticTrajectoryModel',
    groupId: 'orbit',
    label: 'Synthetic Trajectory Model',
    description: 'paper-baseline 衛星軌跡模型。',
    sourceIds: [
      'ASSUME-PAPER-BASELINE-SYNTHETIC-TRAJECTORY-MODE',
      'ASSUME-WALKER-CIRCULAR-PHASING',
    ],
    modes: ['paper-baseline'],
    options: [
      { value: 'linear-drift', label: 'linear drift (legacy)' },
      { value: 'walker-circular', label: 'walker circular (parametric)' },
    ],
    readFromProfile: (profile) =>
      profile.constellation.syntheticTrajectoryModel ?? 'linear-drift',
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.syntheticTrajectoryModel =
        asSyntheticTrajectoryModel(serializedValue);
    },
  },
  {
    id: 'constellation.altitudeKm',
    groupId: 'orbit',
    label: 'LEO Altitude',
    description: 'paper-baseline 模式的衛星高度層級。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2022-SEAMLESSNTN-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-CIRCULAR-ORBIT-SPEED-DERIVATION',
      'ASSUME-BEAM-FOOTPRINT-GEOMETRY-COUPLING',
    ],
    modes: ['paper-baseline'],
    options: [
      { value: '550', label: '550 km (Starlink-like)' },
      { value: '600', label: '600 km' },
      { value: '1200', label: '1200 km (OneWeb-like)' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.constellation.altitudeKm, 600),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.altitudeKm = toNumber(
        serializedValue,
        'constellation.altitudeKm',
      );
    },
  },
  {
    id: 'constellation.inclinationDeg',
    groupId: 'orbit',
    label: 'Orbit Inclination',
    description: '軌道傾角（walker-circular 模式）。',
    sourceIds: [
      'PAP-2022-SEAMLESSNTN-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-PAPER-BASELINE-SYNTHETIC-TRAJECTORY-MODE',
    ],
    modes: ['paper-baseline'],
    options: [
      { value: '53', label: '53° (Starlink-like)' },
      { value: '87.9', label: '87.9° (OneWeb-like)' },
      { value: '90', label: '90° (polar stress)' },
    ],
    isAvailable: ({ selection }) =>
      selection['constellation.syntheticTrajectoryModel'] === 'walker-circular',
    readFromProfile: (profile) =>
      stringOfNumber(profile.constellation.inclinationDeg, 90),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.inclinationDeg = toNumber(
        serializedValue,
        'constellation.inclinationDeg',
      );
    },
  },
  {
    id: 'constellation.orbitalPlanes',
    groupId: 'orbit',
    label: 'Orbital Planes',
    description: '星座軌道平面數（walker-circular 模式）。',
    sourceIds: [
      'PAP-2022-SEAMLESSNTN-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-PAPER-BASELINE-SYNTHETIC-TRAJECTORY-MODE',
    ],
    modes: ['paper-baseline'],
    options: [
      { value: '1', label: '1 plane (compact baseline)' },
      { value: '18', label: '18 planes (OneWeb-like)' },
      { value: '24', label: '24 planes (Starlink-like)' },
    ],
    isAvailable: ({ selection }) =>
      selection['constellation.syntheticTrajectoryModel'] === 'walker-circular',
    readFromProfile: (profile) =>
      stringOfNumber(profile.constellation.orbitalPlanes, 1),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.orbitalPlanes = Math.max(
        1,
        Math.round(toNumber(serializedValue, 'constellation.orbitalPlanes')),
      );
    },
  },
  {
    id: 'constellation.satellitesPerPlane',
    groupId: 'orbit',
    label: 'Satellites Per Plane',
    description: '每軌道平面的衛星數（walker-circular 模式）。',
    sourceIds: [
      'PAP-2022-SEAMLESSNTN-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-PAPER-BASELINE-SYNTHETIC-TRAJECTORY-MODE',
    ],
    modes: ['paper-baseline'],
    options: [
      { value: '7', label: '7 sats/plane (compact baseline)' },
      { value: '8', label: '8 sats/plane' },
      { value: '40', label: '40 sats/plane (OneWeb-like)' },
      { value: '66', label: '66 sats/plane (Starlink-like)' },
    ],
    isAvailable: ({ selection }) =>
      selection['constellation.syntheticTrajectoryModel'] === 'walker-circular',
    readFromProfile: (profile) =>
      stringOfNumber(profile.constellation.satellitesPerPlane, 7),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.satellitesPerPlane = Math.max(
        1,
        Math.round(toNumber(serializedValue, 'constellation.satellitesPerPlane')),
      );
    },
  },
  {
    id: 'constellation.minElevationDeg',
    groupId: 'orbit',
    label: 'Min Elevation',
    description: '可見衛星門檻仰角。',
    sourceIds: [
      'ASSUME-MIN-ELEVATION-SENSITIVITY-TIERS',
      'PAP-2024-MADRL-CORE',
      'PAP-2025-DAPS-CORE',
    ],
    options: [
      { value: '10', label: '10° (common baseline)' },
      { value: '20', label: '20° (stricter visibility)' },
      { value: '25', label: '25° (access-stability gate)' },
      { value: '35', label: '35° (high-elevation stress)' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.constellation.minElevationDeg, 10),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.minElevationDeg = toNumber(
        serializedValue,
        'constellation.minElevationDeg',
      );
    },
  },
  {
    id: 'constellation.activeSatellitesInWindow',
    groupId: 'orbit',
    label: 'Scene Satellite Window',
    description: '每個 tick 保留在場景與模擬視窗中的衛星數量上限。',
    sourceIds: ['PAP-2022-SEAMLESSNTN-CORE', 'PAP-2024-MADRL-CORE', 'PAP-2025-DAPS-CORE'],
    options: [
      { value: '1', label: '1 satellite (single-pass debug)' },
      { value: '8', label: '8 satellites' },
      { value: '16', label: '16 satellites' },
      { value: '30', label: '30 satellites' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(
        profile.constellation.activeSatellitesInWindow ??
          profile.constellation.satellitesPerPlane,
        profile.constellation.satellitesPerPlane,
      ),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.constellation ??= {};
      overrides.constellation.activeSatellitesInWindow = Math.max(
        1,
        Math.round(toNumber(serializedValue, 'constellation.activeSatellitesInWindow')),
      );
    },
  },
  {
    id: 'handover.params.candidateSatelliteLimit',
    groupId: 'handover',
    label: 'HO Candidate Window',
    description: '每個 UE 每個 tick 參與換手決策的候選衛星上限。',
    sourceIds: [
      'PAP-2022-SEAMLESSNTN-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-HANDOVER-CANDIDATE-WINDOW',
    ],
    options: [
      { value: '1', label: '1 satellite (single-pass debug)' },
      { value: '2', label: '2 satellites' },
      { value: '4', label: '4 satellites' },
      { value: '7', label: '7 satellites' },
      { value: '8', label: '8 satellites' },
      { value: '10', label: '10 satellites' },
      { value: '16', label: '16 satellites' },
      { value: '30', label: '30 satellites' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(
        profile.handover.params.candidateSatelliteLimit ??
          profile.constellation.activeSatellitesInWindow ??
          profile.constellation.satellitesPerPlane,
        profile.constellation.activeSatellitesInWindow ??
          profile.constellation.satellitesPerPlane,
      ),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.candidateSatelliteLimit = Math.max(
        1,
        Math.round(toNumber(serializedValue, 'handover.params.candidateSatelliteLimit')),
      );
    },
  },
  {
    id: 'beam.beamsPerSatellite',
    groupId: 'beam',
    label: 'Beams Per Satellite',
    description: '多波束數量（含 layout 自動對應）。',
    sourceIds: ['ASSUME-BEAM-COUNT-LAYOUT-TIERS', 'PAP-2022-A4EVENT-CORE', 'PAP-2024-MADRL-CORE'],
    options: [
      { value: '7', label: '7 beams' },
      { value: '16', label: '16 beams' },
      { value: '19', label: '19 beams' },
      { value: '50', label: '50 beams' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.beam.beamsPerSatellite, 7),
    applyToOverrides: (serializedValue, overrides) => {
      const beamCount = Math.max(1, Math.round(toNumber(serializedValue, 'beam.beamsPerSatellite')));
      overrides.beam ??= {};
      overrides.beam.beamsPerSatellite = beamCount;
      overrides.beam.layout = layoutFromBeamCount(beamCount);
    },
  },
  {
    id: 'beam.overlapRatio',
    groupId: 'beam',
    label: 'Beam Overlap',
    description: '相鄰波束重疊比例。',
    sourceIds: ['PAP-2024-MCCHO-CORE', 'PAP-2025-DAPS-CORE', 'PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: '0.1', label: '10%' },
      { value: '0.2', label: '20%' },
      { value: '0.25', label: '25%' },
      { value: '0.3', label: '30%' },
      { value: '0.4', label: '40%' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.beam.overlapRatio ?? 0.25, 0.25),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.beam ??= {};
      overrides.beam.overlapRatio = toNumber(serializedValue, 'beam.overlapRatio');
    },
  },
  {
    id: 'beam.frequencyReuse',
    groupId: 'beam',
    label: 'Frequency Reuse',
    description: '同頻干擾分組模式。',
    sourceIds: ['ASSUME-FREQUENCY-REUSE-MODES', 'PAP-2022-A4EVENT-CORE', 'PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: 'FR1', label: 'FR1 (full reuse)' },
      { value: 'reuse-4', label: 'reuse-4' },
    ],
    readFromProfile: (profile) => profile.beam.frequencyReuse,
    applyToOverrides: (serializedValue, overrides) => {
      overrides.beam ??= {};
      overrides.beam.frequencyReuse = asFrequencyReuse(serializedValue);
    },
  },
  {
    id: 'beam.footprintDiameterKm',
    groupId: 'beam',
    label: 'Beam Diameter',
    description: '單一波束地面覆蓋直徑（km）。由高度與 HPBW 推導，也可手動覆寫。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2025-TIMERCHO-CORE',
      'PAP-2024-MADRL-CORE',
      'ASSUME-BEAM-FOOTPRINT-GEOMETRY-COUPLING',
    ],
    options: [
      { value: '50', label: '50 km' },
      { value: '100', label: '100 km' },
      { value: '150', label: '150 km' },
      { value: '200', label: '200 km' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.beam.footprintDiameterKm, 50),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.beam ??= {};
      overrides.beam.footprintDiameterKm = toNumber(
        serializedValue,
        'beam.footprintDiameterKm',
      );
    },
  },
  {
    id: 'ue.count',
    groupId: 'ue',
    label: 'UE Count',
    description: '場景 UE 數量。',
    sourceIds: ['ASSUME-UE-COUNT-TIERS', 'PAP-2022-SEAMLESSNTN-CORE', 'PAP-2025-DAPS-CORE'],
    options: [
      { value: '50', label: '50 UEs' },
      { value: '100', label: '100 UEs' },
      { value: '200', label: '200 UEs' },
      { value: '350', label: '350 UEs (stress)' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.ue.count, 100),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.ue ??= {};
      overrides.ue.count = Math.max(1, Math.round(toNumber(serializedValue, 'ue.count')));
    },
  },
  {
    id: 'ue.speedKmph',
    groupId: 'ue',
    label: 'UE Speed Tier',
    description: 'UE 速度分層（單一 tier 固定）。',
    sourceIds: ['ASSUME-UE-SPEED-TIERS', 'PAP-2025-TIMERCHO-CORE', 'PAP-2024-MCCHO-CORE'],
    options: [
      { value: '0', label: '0 km/h (stationary)' },
      { value: '3', label: '3 km/h (pedestrian)' },
      { value: '30', label: '30 km/h (urban vehicle)' },
      { value: '60', label: '60 km/h (vehicular)' },
    ],
    readFromProfile: (profile) => {
      const first = profile.ue.speedKmphOptions[0];
      return String(first ?? 0);
    },
    applyToOverrides: (serializedValue, overrides) => {
      overrides.ue ??= {};
      overrides.ue.speedKmphOptions = [toNumber(serializedValue, 'ue.speedKmph')];
    },
  },
  {
    id: 'handover.params.a3OffsetDb',
    groupId: 'handover',
    label: 'A3 Offset',
    description: 'A3 事件鄰區優勢偏移量。',
    sourceIds: ['PAP-2022-A4EVENT-CORE', 'STD-3GPP-TS38.331-RRC', 'PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: '0', label: '0 dB' },
      { value: '2', label: '2 dB' },
      { value: '4', label: '4 dB' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.handover.params.a3OffsetDb ?? 0, 0),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.a3OffsetDb = toNumber(serializedValue, 'handover.params.a3OffsetDb');
    },
  },
  {
    id: 'handover.params.a3TttMs',
    groupId: 'handover',
    label: 'A3/A4 TTT',
    description: '事件條件維持時間門檻。',
    sourceIds: ['PAP-2022-A4EVENT-CORE', 'STD-3GPP-TS38.331-RRC', 'PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: '0', label: '0 ms' },
      { value: '40', label: '40 ms' },
      { value: '256', label: '256 ms' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.handover.params.a3TttMs ?? 0, 0),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.a3TttMs = Math.max(
        0,
        Math.round(toNumber(serializedValue, 'handover.params.a3TttMs')),
      );
    },
  },
  {
    id: 'handover.params.a4ThresholdDbm',
    groupId: 'handover',
    label: 'A4 Threshold',
    description: 'A4 絕對門檻。',
    sourceIds: ['PAP-2022-A4EVENT-CORE', 'STD-3GPP-TS38.331-RRC'],
    options: [
      { value: '-102', label: '-102 dBm' },
      { value: '-101', label: '-101 dBm' },
      { value: '-100', label: '-100 dBm' },
      { value: '-99', label: '-99 dBm' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.handover.params.a4ThresholdDbm ?? -100, -100),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.a4ThresholdDbm = toNumber(
        serializedValue,
        'handover.params.a4ThresholdDbm',
      );
    },
  },
  {
    id: 'handover.params.homDb',
    groupId: 'handover',
    label: 'Hysteresis Margin',
    description: '事件觸發遲滯值（HOM）。',
    sourceIds: ['PAP-2022-A4EVENT-CORE', 'STD-3GPP-TS38.331-RRC'],
    options: [
      { value: '0', label: '0 dB' },
      { value: '2', label: '2 dB' },
      { value: '4', label: '4 dB' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.handover.params.homDb ?? 0, 0),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.homDb = toNumber(serializedValue, 'handover.params.homDb');
    },
  },
  {
    id: 'handover.params.mtsSec',
    groupId: 'handover',
    label: 'MTS Guard',
    description: 'CHO 最小 remaining-ToS 條件。',
    sourceIds: ['PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: '0.5', label: '0.5 s' },
      { value: '1', label: '1.0 s' },
      { value: '1.5', label: '1.5 s' },
    ],
    readFromProfile: (profile) => stringOfNumber(profile.handover.params.mtsSec ?? 1, 1),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.mtsSec = toNumber(serializedValue, 'handover.params.mtsSec');
    },
  },
  {
    id: 'handover.params.timerAlpha',
    groupId: 'handover',
    label: 'Timer Alpha',
    description: '幾何 timer-CHO 的 alpha 權重。',
    sourceIds: ['PAP-2025-TIMERCHO-CORE'],
    options: [
      { value: '0.8', label: 'alpha = 0.8' },
      { value: '0.85', label: 'alpha = 0.85' },
      { value: '0.9', label: 'alpha = 0.9' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.handover.params.timerAlphaOptions?.[0] ?? 0.85, 0.85),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.handover ??= {};
      overrides.handover.params ??= {};
      overrides.handover.params.timerAlphaOptions = [
        toNumber(serializedValue, 'handover.params.timerAlpha'),
      ];
    },
  },
  {
    id: 'channel.carrierFrequencyGHz',
    groupId: 'linkbudget',
    label: 'Carrier Frequency',
    description: '載波頻率，影響 FSPL、SF/CL 查表、波束直徑。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2025-TIMERCHO-CORE',
      'PAP-2024-HOBS',
    ],
    options: [
      { value: '2', label: 'S-band (2 GHz)' },
      { value: '12', label: 'Ku-band (12 GHz)' },
      { value: '20', label: 'Ka-band (20 GHz)' },
      { value: '28', label: 'Ka-band (28 GHz)' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.channel.carrierFrequencyGHz, 2),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.channel ??= {};
      overrides.channel.carrierFrequencyGHz = toNumber(
        serializedValue,
        'channel.carrierFrequencyGHz',
      );
    },
  },
  {
    id: 'beam.eirpDensityDbwPerMHz',
    groupId: 'linkbudget',
    label: 'EIRP Density',
    description: '衛星等效全向輻射功率密度（dBW/MHz）。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2025-TIMERCHO-CORE',
      'PAP-2024-BEAM-MGMT-SPECTRUM',
    ],
    options: [
      { value: '30', label: '30 dBW/MHz' },
      { value: '34', label: '34 dBW/MHz (3GPP Case 9)' },
      { value: '40', label: '40 dBW/MHz' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.beam.eirpDensityDbwPerMHz, 34),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.beam ??= {};
      overrides.beam.eirpDensityDbwPerMHz = toNumber(
        serializedValue,
        'beam.eirpDensityDbwPerMHz',
      );
    },
  },
  {
    id: 'channel.bandwidthMHz',
    groupId: 'linkbudget',
    label: 'Bandwidth',
    description: '通道頻寬（MHz），影響噪聲功率與吞吐量。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2024-BEAM-MGMT-SPECTRUM',
      'PAP-2026-BHFREQREUSE',
    ],
    options: [
      { value: '10', label: '10 MHz' },
      { value: '30', label: '30 MHz' },
      { value: '100', label: '100 MHz' },
      { value: '400', label: '400 MHz' },
    ],
    readFromProfile: (profile) =>
      stringOfNumber(profile.channel.bandwidthMHz, 30),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.channel ??= {};
      overrides.channel.bandwidthMHz = toNumber(
        serializedValue,
        'channel.bandwidthMHz',
      );
    },
  },
  {
    id: 'scenario.deployment',
    groupId: 'linkbudget',
    label: 'Scenario',
    description: '部署場景，決定 3GPP TR 38.811 SF/CL 查表。',
    sourceIds: [
      'PAP-2022-A4EVENT-CORE',
      'PAP-2025-TIMERCHO-CORE',
      'PAP-2024-MCCHO-CORE',
    ],
    options: [
      { value: 'rural', label: 'Rural' },
      { value: 'suburban', label: 'Suburban' },
      { value: 'dense-urban', label: 'Dense Urban' },
    ],
    readFromProfile: (profile) => profile.scenario.deployment,
    applyToOverrides: (serializedValue, overrides) => {
      if (
        serializedValue !== 'rural' &&
        serializedValue !== 'suburban' &&
        serializedValue !== 'dense-urban'
      ) {
        throw new Error(`Invalid deployment value '${serializedValue}'.`);
      }
      overrides.scenario ??= {};
      overrides.scenario.deployment = serializedValue as Deployment;
    },
  },
  {
    id: 'channel.smallScaleModel',
    groupId: 'channel',
    label: 'Small-Scale Model',
    description: '小尺度衰落模型。',
    sourceIds: ['PAP-2024-MADRL-CORE', 'ASSUME-SMALL-SCALE-PARAMS-DEFAULT'],
    options: [
      { value: 'none', label: 'none' },
      { value: 'shadowed-rician', label: 'shadowed-rician' },
      { value: 'loo', label: 'loo' },
    ],
    readFromProfile: (profile) => profile.channel.smallScaleModel,
    applyToOverrides: (serializedValue, overrides) => {
      overrides.channel ??= {};
      overrides.channel.smallScaleModel = asSmallScaleModel(serializedValue);
    },
  },
  {
    id: 'channel.smallScaleParams.temporalCorrelation.enabled',
    groupId: 'channel',
    label: 'Temporal Correlation',
    description: '啟用時間相關衰落。',
    sourceIds: ['ASSUME-SMALL-SCALE-REALISM-OPTIONS'],
    options: [
      { value: 'false', label: 'off' },
      { value: 'true', label: 'on' },
    ],
    isAvailable: ({ selection }) => selection['channel.smallScaleModel'] !== 'none',
    readFromProfile: (profile) =>
      String(profile.channel.smallScaleParams?.temporalCorrelation?.enabled ?? false),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.channel ??= {};
      overrides.channel.smallScaleParams ??= {};
      overrides.channel.smallScaleParams.temporalCorrelation ??= {
        enabled: false,
        coefficient: 0.85,
      };
      overrides.channel.smallScaleParams.temporalCorrelation.enabled = toBoolean(serializedValue);
    },
  },
  {
    id: 'channel.smallScaleParams.dopplerAware.enabled',
    groupId: 'channel',
    label: 'Doppler-Aware Fading',
    description: '啟用 Doppler-aware 項。',
    sourceIds: ['ASSUME-SMALL-SCALE-REALISM-OPTIONS'],
    options: [
      { value: 'false', label: 'off' },
      { value: 'true', label: 'on' },
    ],
    isAvailable: ({ selection }) => selection['channel.smallScaleModel'] !== 'none',
    readFromProfile: (profile) =>
      String(profile.channel.smallScaleParams?.dopplerAware?.enabled ?? false),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.channel ??= {};
      overrides.channel.smallScaleParams ??= {};
      overrides.channel.smallScaleParams.dopplerAware ??= {
        enabled: false,
        velocityScale: 1,
        speedOfLightMps: 299792458,
      };
      overrides.channel.smallScaleParams.dopplerAware.enabled = toBoolean(serializedValue);
    },
  },
  {
    id: 'scheduler.mode',
    groupId: 'scheduler',
    label: 'Scheduler Coupling Mode',
    description: '是否啟用與 HO 耦合的排程限制。',
    sourceIds: ['ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG', 'PAP-2025-DAPS-CORE'],
    options: [
      { value: 'uncoupled', label: 'uncoupled' },
      { value: 'coupled', label: 'coupled' },
    ],
    readFromProfile: (profile) => profile.scheduler.mode,
    applyToOverrides: (serializedValue, overrides) => {
      if (serializedValue !== 'uncoupled' && serializedValue !== 'coupled') {
        throw new Error(`Invalid scheduler.mode value '${serializedValue}'.`);
      }
      overrides.scheduler ??= {};
      overrides.scheduler.mode = serializedValue;
    },
  },
  {
    id: 'scheduler.maxActiveBeamsPerSatellite',
    groupId: 'scheduler',
    label: 'Active Beams',
    description: 'Beam hopping 每時槽最大活躍波束數。',
    sourceIds: [
      'PAP-2020-BHHOPPING',
      'PAP-2024-BHFREQREUSE',
      'ASSUME-BEAM-SCHEDULER-WINDOW-CONFIG',
    ],
    options: [
      { value: '4', label: '4 beams' },
      { value: '6', label: '6 beams' },
      { value: '8', label: '8 beams' },
      { value: '10', label: '10 beams' },
    ],
    isAvailable: ({ selection }) => selection['scheduler.mode'] === 'coupled',
    readFromProfile: (profile) =>
      stringOfNumber(profile.scheduler.maxActiveBeamsPerSatellite, 10),
    applyToOverrides: (serializedValue, overrides) => {
      overrides.scheduler ??= {};
      overrides.scheduler.maxActiveBeamsPerSatellite = Math.max(
        1,
        Math.round(toNumber(serializedValue, 'scheduler.maxActiveBeamsPerSatellite')),
      );
    },
  },
];
