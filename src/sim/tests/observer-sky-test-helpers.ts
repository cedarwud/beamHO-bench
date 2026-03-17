import { loadPaperProfile } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  buildResearchRuntimeOverrides,
  createResearchParameterSelection,
  normalizeResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import type { SatelliteGeometryState, SimSnapshot } from '@/sim/types';
import { buildObserverSkyDisplayPipeline } from '@/viz/satellite/display-pipeline';
import {
  getObserverSkyComposition,
  type ObserverSkyCompositionConfig,
  type ObserverSkyCompositionModeId,
} from '@/viz/satellite/view-composition';

/**
 * Provenance:
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 4, 5, 6)
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md (Section 4, 5)
 *
 * Notes:
 * - Test helpers reuse the same display pipeline as the frontend scene wiring.
 */

export function buildSyntheticObserverSkyProfile(
  overrides: Partial<Record<string, string>> = {},
): PaperProfile {
  const baseProfile = loadPaperProfile('starlink-like');
  const selection = normalizeResearchParameterSelection(baseProfile, {
    ...createResearchParameterSelection(baseProfile),
    'constellation.syntheticTrajectoryModel': 'walker-circular',
    'constellation.altitudeKm': '550',
    'constellation.inclinationDeg': '53',
    'constellation.orbitalPlanes': '24',
    'constellation.satellitesPerPlane': '66',
    'constellation.activeSatellitesInWindow': '16',
    'handover.params.candidateSatelliteLimit': '8',
    ...overrides,
  });
  const runtimeOverrides = buildResearchRuntimeOverrides({
    profile: baseProfile,
    selection,
  });
  return loadPaperProfile('starlink-like', runtimeOverrides);
}

export function getDisplayPool(snapshot: SimSnapshot): readonly SatelliteGeometryState[] {
  return snapshot.observerSkyPhysicalSatellites ?? snapshot.satellites;
}

export function buildObserverSkyDisplayView(options: {
  profile: PaperProfile;
  snapshot: SimSnapshot;
  compositionMode?: ObserverSkyCompositionModeId;
  composition?: ObserverSkyCompositionConfig;
  displayBudget?: number;
  sequenceKey?: string;
  memory?: ReturnType<typeof buildObserverSkyDisplayPipeline>['memory'] | null;
}) {
  const composition =
    options.composition ?? getObserverSkyComposition(options.compositionMode ?? 'observer-sky-primary');
  const sequenceKey =
    options.sequenceKey ??
    `${options.snapshot.scenarioId}:${options.snapshot.profileId}:${composition.modeId}`;
  return {
    composition,
    ...buildObserverSkyDisplayPipeline({
      profile: options.profile,
      satellites: getDisplayPool(options.snapshot),
      composition,
      displayBudget: options.displayBudget,
      sequenceKey,
      snapshotTick: options.snapshot.tick,
      snapshotTimeSec: options.snapshot.timeSec,
      memory: options.memory,
      showGhosts: true,
    }),
  };
}
