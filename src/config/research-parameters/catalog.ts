import type { DeepPartial } from '@/config/paper-profiles/loader';
import type {
  BeamLayout,
  FrequencyReuse,
  PaperProfile,
  ProfileMode,
  SmallScaleModel,
} from '@/config/paper-profiles/types';
import {
  RESEARCH_PARAMETER_GROUPS,
  type ResearchParameterGroup,
  type ResearchParameterId,
  type ResearchParameterOption,
  type ResearchParameterSelection,
  type ResearchParameterSpec,
} from './types';
import {
  mergePaperProfileOverrides,
  resolveResearchParameterConsistency,
  type BuildResearchRuntimeOverridesResult,
  type ResearchConsistencyMode,
} from './consistency';

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
 * - This catalog defines research-critical controls only.
 * - UI/view controls (render mode, playback speed, link visibility) are intentionally excluded.
 */

export type {
  ResearchParameterGroupId,
  ResearchParameterSelection,
  ResearchParameterId,
} from './types';
export type {
  BuildResearchRuntimeOverridesResult,
  ResearchConsistencyIssue,
  ResearchConsistencyIssueSeverity,
  ResearchConsistencyMode,
  ResearchConsistencySummary,
} from './consistency';
export { summarizeResearchConsistency } from './consistency';

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

function asNearestOptionValue(
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


const RESEARCH_PARAMETER_SPECS: ResearchParameterSpec[] = [
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
      { value: '600', label: '600 km (Case-9 / A4 / MC-CHO)' },
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
    label: 'Active Satellites In Window',
    description: '每個 tick 的活躍衛星視窗大小。',
    sourceIds: ['PAP-2022-SEAMLESSNTN-CORE', 'PAP-2024-MADRL-CORE', 'PAP-2025-DAPS-CORE'],
    options: [
      { value: '7', label: '7 satellites' },
      { value: '10', label: '10 satellites' },
      { value: '16', label: '16 satellites' },
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
    readFromProfile: (profile) => stringOfNumber(profile.beam.beamsPerSatellite, 19),
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
];

const SPEC_BY_ID = new Map(RESEARCH_PARAMETER_SPECS.map((spec) => [spec.id, spec]));

export const ALL_RESEARCH_PARAMETER_IDS: readonly ResearchParameterId[] = RESEARCH_PARAMETER_SPECS.map(
  (spec) => spec.id,
);

function isSpecModeEnabled(spec: ResearchParameterSpec, mode: ProfileMode): boolean {
  return !spec.modes || spec.modes.includes(mode);
}

function isSpecAvailable(
  spec: ResearchParameterSpec,
  profile: PaperProfile,
  selection: ResearchParameterSelection,
): boolean {
  if (!isSpecModeEnabled(spec, profile.mode)) {
    return false;
  }
  return spec.isAvailable ? spec.isAvailable({ profile, selection }) : true;
}

function normalizeSelectionValue(
  spec: ResearchParameterSpec,
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): string {
  const fromSelection = selection[spec.id];
  const fallback = spec.readFromProfile(profile);
  const candidate = fromSelection ?? fallback;
  return asNearestOptionValue(candidate, spec.options);
}

export function createResearchParameterSelection(profile: PaperProfile): ResearchParameterSelection {
  const selection = {} as ResearchParameterSelection;
  for (const spec of RESEARCH_PARAMETER_SPECS) {
    selection[spec.id] = normalizeSelectionValue(spec, profile, {});
  }
  return selection;
}

export function normalizeResearchParameterSelection(
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): ResearchParameterSelection {
  const normalized = {} as ResearchParameterSelection;
  for (const spec of RESEARCH_PARAMETER_SPECS) {
    normalized[spec.id] = normalizeSelectionValue(spec, profile, selection);
  }
  return normalized;
}

export function buildResearchRuntimeOverridesWithConsistency(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
  consistencyMode?: ResearchConsistencyMode;
}): BuildResearchRuntimeOverridesResult {
  const { profile } = options;
  const normalizedSelection = normalizeResearchParameterSelection(profile, options.selection);
  const consistency = resolveResearchParameterConsistency({
    profile,
    selection: normalizedSelection,
    mode: options.consistencyMode ?? 'strict',
  });
  const overrides: DeepPartial<PaperProfile> = {};

  for (const spec of RESEARCH_PARAMETER_SPECS) {
    if (!isSpecAvailable(spec, profile, consistency.selection)) {
      continue;
    }
    spec.applyToOverrides(consistency.selection[spec.id], overrides);
  }

  mergePaperProfileOverrides(overrides, consistency.derivedOverrides);

  const hardErrors = consistency.issues.filter((issue) => issue.severity === 'error');
  if (hardErrors.length > 0 && consistency.mode === 'strict') {
    throw new Error(
      `Research parameter consistency failure: ${hardErrors
        .map((issue) => `${issue.ruleId}:${issue.messageCode}`)
        .join(', ')}`,
    );
  }

  return {
    mode: consistency.mode,
    selection: consistency.selection,
    overrides,
    issues: consistency.issues,
  };
}

export function buildResearchRuntimeOverrides(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
  consistencyMode?: ResearchConsistencyMode;
}): DeepPartial<PaperProfile> {
  return buildResearchRuntimeOverridesWithConsistency(options).overrides;
}

export function getResearchParameterSpecById(
  parameterId: ResearchParameterId,
): ResearchParameterSpec {
  const spec = SPEC_BY_ID.get(parameterId);
  if (!spec) {
    throw new Error(`Unknown research parameter id '${parameterId}'.`);
  }
  return spec;
}

export function listResearchParameterSpecs(
  profile: PaperProfile,
  selection: Partial<ResearchParameterSelection>,
): ResearchParameterSpec[] {
  const normalized = normalizeResearchParameterSelection(profile, selection);
  return RESEARCH_PARAMETER_SPECS.filter((spec) =>
    isSpecAvailable(spec, profile, normalized),
  );
}

export function listResearchParameterGroups(options: {
  profile: PaperProfile;
  selection: Partial<ResearchParameterSelection>;
}): Array<{
  group: ResearchParameterGroup;
  specs: ResearchParameterSpec[];
}> {
  const visibleSpecs = listResearchParameterSpecs(options.profile, options.selection);
  return RESEARCH_PARAMETER_GROUPS.map((group) => ({
    group,
    specs: visibleSpecs.filter((spec) => spec.groupId === group.id),
  })).filter((entry) => entry.specs.length > 0);
}
