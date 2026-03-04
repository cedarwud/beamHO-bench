import type { DeepPartial } from '@/config/paper-profiles/loader';
import type { PaperProfile, ProfileMode } from '@/config/paper-profiles/types';

export type ResearchParameterGroupId =
  | 'orbit'
  | 'beam'
  | 'ue'
  | 'handover'
  | 'channel'
  | 'scheduler';

export type ResearchParameterId =
  | 'constellation.altitudeKm'
  | 'constellation.minElevationDeg'
  | 'constellation.activeSatellitesInWindow'
  | 'beam.beamsPerSatellite'
  | 'beam.overlapRatio'
  | 'beam.frequencyReuse'
  | 'ue.count'
  | 'ue.speedKmph'
  | 'handover.params.a3OffsetDb'
  | 'handover.params.a3TttMs'
  | 'handover.params.a4ThresholdDbm'
  | 'handover.params.homDb'
  | 'handover.params.mtsSec'
  | 'handover.params.timerAlpha'
  | 'channel.smallScaleModel'
  | 'channel.smallScaleParams.temporalCorrelation.enabled'
  | 'channel.smallScaleParams.dopplerAware.enabled'
  | 'scheduler.mode';

export interface ResearchParameterOption {
  value: string;
  label: string;
}

export interface ResearchParameterGroup {
  id: ResearchParameterGroupId;
  label: string;
  description: string;
}

export interface AvailabilityContext {
  profile: PaperProfile;
  selection: ResearchParameterSelection;
}

export interface ResearchParameterSpec {
  id: ResearchParameterId;
  groupId: ResearchParameterGroupId;
  label: string;
  description: string;
  sourceIds: string[];
  options: ResearchParameterOption[];
  modes?: ProfileMode[];
  isAvailable?: (context: AvailabilityContext) => boolean;
  readFromProfile: (profile: PaperProfile) => string;
  applyToOverrides: (
    serializedValue: string,
    overrides: DeepPartial<PaperProfile>,
  ) => void;
}

export type ResearchParameterSelection = Record<ResearchParameterId, string>;

export const RESEARCH_PARAMETER_GROUPS: readonly ResearchParameterGroup[] = [
  {
    id: 'orbit',
    label: 'Orbit & Visibility',
    description: 'LEO 幾何可視條件與活躍衛星視窗。',
  },
  {
    id: 'beam',
    label: 'Beam Topology',
    description: '多波束幾何與同頻干擾結構。',
  },
  {
    id: 'ue',
    label: 'UE Load & Mobility',
    description: '負載密度與移動速度分層。',
  },
  {
    id: 'handover',
    label: 'Handover Trigger',
    description: 'A3/A4/CHO 觸發敏感度。',
  },
  {
    id: 'channel',
    label: 'Channel Realism',
    description: '小尺度衰落模型與時間相關增量。',
  },
  {
    id: 'scheduler',
    label: 'Scheduler Coupling',
    description: 'Beam-hopping 排程與換手耦合模式。',
  },
];

