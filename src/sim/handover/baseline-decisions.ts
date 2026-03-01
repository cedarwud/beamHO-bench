import type { PaperProfile } from '@/config/paper-profiles/types';
import { selectBestLink, type LinkSample } from '@/sim/channel/link-budget';
import type { BeamState, SatelliteState, UEState } from '@/sim/types';
import { resolveA3Decision, resolveA4Decision } from './baseline-a3a4';
import { resolveChoDecision, resolveMcHoDecision } from './baseline-cho-mcho';
import { selectByElevation, selectByRemainingTime } from './baseline-helpers';
import type {
  CandidateDecision,
  RuntimeBaseline,
  UeTriggerMemory,
} from './baseline-types';

export function selectCandidate(options: {
  baseline: RuntimeBaseline;
  profile: PaperProfile;
  ue: UEState;
  links: LinkSample[];
  servingSample: LinkSample | null;
  satById: Map<number, SatelliteState>;
  beamByKey: Map<string, BeamState>;
  memory: UeTriggerMemory;
  timeStepSec: number;
}): CandidateDecision {
  const {
    baseline,
    profile,
    ue,
    links,
    servingSample,
    satById,
    beamByKey,
    memory,
    timeStepSec,
  } = options;

  const bestSample = selectBestLink(links);

  switch (baseline) {
    case 'max-rsrp':
      return { selected: bestSample, triggerEvent: true };
    case 'max-elevation':
      return { selected: selectByElevation(links, satById), triggerEvent: true };
    case 'max-remaining-time':
      return {
        selected: selectByRemainingTime(profile, ue, links, beamByKey),
        triggerEvent: true,
      };
    case 'a3':
      return resolveA3Decision({
        profile,
        ue,
        links,
        servingSample,
        bestSample,
        memory,
        timeStepSec,
      });
    case 'a4':
      return resolveA4Decision({
        profile,
        ue,
        links,
        servingSample,
        bestSample,
        memory,
        timeStepSec,
      });
    case 'cho':
      return resolveChoDecision({
        profile,
        ue,
        links,
        servingSample,
        bestSample,
        memory,
        timeStepSec,
        beamByKey,
        satById,
      });
    case 'mc-ho':
      return resolveMcHoDecision({
        profile,
        ue,
        links,
        servingSample,
      });
    default:
      return { selected: bestSample, triggerEvent: true };
  }
}
