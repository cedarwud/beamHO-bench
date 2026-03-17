import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  buildResearchRuntimeOverrides,
  createResearchParameterSelection,
  normalizeResearchParameterSelection,
  type ResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import { runBaselineBatch } from '@/sim/bench/runner';
import {
  buildParametricOrbitSatelliteStateAtTime,
  createParametricOrbitContext,
  selectParametricOrbitRuntimeWindow,
} from '@/sim/scenarios/common/synthetic-orbit';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function buildTrajectoryKinematicSignature(options: {
  profileId: 'starlink-like';
  selection: ResearchParameterSelection;
  tickCount: number;
}): string {
  const baseProfile = loadPaperProfile(options.profileId);
  const runtimeOverrides = buildResearchRuntimeOverrides({
    profile: baseProfile,
    selection: options.selection,
  });
  const profile = loadPaperProfile(options.profileId, runtimeOverrides);
  const batch = runBaselineBatch({
    profile,
    seed: 42,
    baselines: ['max-rsrp'],
    tickCount: options.tickCount,
    captureSnapshots: true,
  });
  const run = batch.runs[0];
  const latestSnapshot = run.snapshots?.[run.snapshots.length - 1];
  assertCondition(
    Boolean(latestSnapshot && latestSnapshot.satellites.length > 0),
    'Expected captured snapshot with satellites for trajectory signature.',
  );

  const topSatellites = (latestSnapshot?.satellites ?? []).slice(0, 3).map((satellite) => ({
    id: satellite.id,
    positionWorld: satellite.positionWorld.map((value) => Number(value.toFixed(3))),
    elevationDeg: Number(satellite.elevationDeg.toFixed(3)),
    azimuthDeg: Number(satellite.azimuthDeg.toFixed(3)),
    rangeKm: Number(satellite.rangeKm.toFixed(3)),
  }));

  return JSON.stringify(topSatellites);
}

export function buildTrajectoryParameterIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: walker-circular trajectory backend is deterministic and responds to paper-tier parameters',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('starlink-like');
        const baseSelection = createResearchParameterSelection(baseProfile);
        const walkerSelection = normalizeResearchParameterSelection(baseProfile, {
          ...baseSelection,
          'constellation.syntheticTrajectoryModel': 'walker-circular',
          'constellation.inclinationDeg': '53',
          'constellation.orbitalPlanes': '24',
          'constellation.satellitesPerPlane': '66',
          'constellation.activeSatellitesInWindow': '16',
        });

        const linearSignature = buildTrajectoryKinematicSignature({
          profileId: 'starlink-like',
          selection: baseSelection,
          tickCount: 12,
        });
        const walkerSignatureFirst = buildTrajectoryKinematicSignature({
          profileId: 'starlink-like',
          selection: walkerSelection,
          tickCount: 12,
        });
        const walkerSignatureSecond = buildTrajectoryKinematicSignature({
          profileId: 'starlink-like',
          selection: walkerSelection,
          tickCount: 12,
        });

        assertCondition(
          walkerSignatureFirst === walkerSignatureSecond,
          'Expected walker-circular trajectory signature to be deterministic for fixed tuple.',
        );
        assertCondition(
          linearSignature !== walkerSignatureFirst,
          'Expected walker-circular trajectory signature to differ from linear-drift baseline.',
        );

        const walkerOverrides = buildResearchRuntimeOverrides({
          profile: baseProfile,
          selection: walkerSelection,
        });
        const resolvedWalkerProfile = loadPaperProfile('starlink-like', walkerOverrides);
        assertCondition(
          resolvedWalkerProfile.constellation.syntheticTrajectoryModel === 'walker-circular',
          'Expected resolved profile synthetic trajectory mode to be walker-circular.',
        );
        assertCondition(
          resolvedWalkerProfile.constellation.orbitalPlanes === 24 &&
            resolvedWalkerProfile.constellation.satellitesPerPlane === 66,
          'Expected walker-circular constellation tier overrides to propagate into resolved profile.',
        );

        const walkerBatch = runBaselineBatch({
          profile: resolvedWalkerProfile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 1,
          captureSnapshots: true,
        });
        const initialWalkerSnapshot = walkerBatch.runs[0]?.snapshots?.[0];
        assertCondition(
          Boolean(initialWalkerSnapshot && initialWalkerSnapshot.satellites.length === 16),
          'Expected walker-circular scene window to emit the configured 16 satellites instead of the full constellation size.',
        );
      },
    },
    {
      name: 'integration: walker-circular synthetic orbit starts with at least one visible satellite for the observer scene',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('starlink-like');
        const walkerSelection = normalizeResearchParameterSelection(baseProfile, {
          ...createResearchParameterSelection(baseProfile),
          'constellation.syntheticTrajectoryModel': 'walker-circular',
          'constellation.inclinationDeg': '90',
          'constellation.orbitalPlanes': '1',
          'constellation.satellitesPerPlane': '8',
          'constellation.activeSatellitesInWindow': '8',
          'constellation.minElevationDeg': '10',
        });
        const walkerOverrides = buildResearchRuntimeOverrides({
          profile: baseProfile,
          selection: walkerSelection,
        });
        const resolvedWalkerProfile = loadPaperProfile('starlink-like', walkerOverrides);
        const batch = runBaselineBatch({
          profile: resolvedWalkerProfile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 1,
          captureSnapshots: true,
        });
        const initialSnapshot = batch.runs[0]?.snapshots?.[0];
        const visibleSatelliteCount =
          initialSnapshot?.satellites.filter((satellite) => satellite.visible).length ?? 0;

        assertCondition(
          Boolean(initialSnapshot && initialSnapshot.satellites.length === 8),
          'Expected walker-circular synthetic orbit to emit the configured 8 satellites in the initial snapshot.',
        );
        assertCondition(
          visibleSatelliteCount >= 1,
          'Expected walker-circular synthetic orbit to place at least one satellite above the minimum elevation at tick 0.',
        );
      },
    },
    {
      name: 'integration: walker-circular backend window selection stays deterministic and azimuth-diversified',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('starlink-like');
        const walkerSelection = normalizeResearchParameterSelection(baseProfile, {
          ...createResearchParameterSelection(baseProfile),
          'constellation.syntheticTrajectoryModel': 'walker-circular',
          'constellation.altitudeKm': '550',
          'constellation.inclinationDeg': '53',
          'constellation.orbitalPlanes': '24',
          'constellation.satellitesPerPlane': '66',
          'constellation.activeSatellitesInWindow': '16',
        });
        const walkerOverrides = buildResearchRuntimeOverrides({
          profile: baseProfile,
          selection: walkerSelection,
        });
        const resolvedWalkerProfile = loadPaperProfile('starlink-like', walkerOverrides);
        const orbitContext = createParametricOrbitContext({
          profile: resolvedWalkerProfile,
          observerLat: 24.9441667,
          observerLon: 121.3713889,
          kmToWorldScale: 0.6,
        });
        const initialPhysicalPool = buildParametricOrbitSatelliteStateAtTime(orbitContext, 0);
        const replayPhysicalPool = buildParametricOrbitSatelliteStateAtTime(orbitContext, 0);
        const nextPhysicalPool = buildParametricOrbitSatelliteStateAtTime(orbitContext, 60);
        const initialWindow = selectParametricOrbitRuntimeWindow(
          initialPhysicalPool,
          orbitContext.desiredSatelliteCount,
        );
        const replayWindow = selectParametricOrbitRuntimeWindow(
          replayPhysicalPool,
          orbitContext.desiredSatelliteCount,
        );
        const nextWindow = selectParametricOrbitRuntimeWindow(
          nextPhysicalPool,
          orbitContext.desiredSatelliteCount,
        );

        assertCondition(
          initialWindow.length === 16,
          'Expected walker-circular backend window selection to honor the configured active satellite count.',
        );
        assertCondition(
          initialPhysicalPool.length > initialWindow.length,
          'Expected walker-circular backend to expose a broader physical pool than the runtime window.',
        );
        assertCondition(
          initialWindow.every((satellite) =>
            satellite.positionWorld.every((value) => Number.isFinite(value)),
          ),
          'Expected walker-circular backend state to produce finite physical world positions.',
        );
        assertCondition(
          JSON.stringify(initialWindow) === JSON.stringify(replayWindow),
          'Expected identical walker-circular backend selection for the same context and time.',
        );
        assertCondition(
          nextWindow.length === initialWindow.length,
          'Expected walker-circular backend window size to remain stable across ticks.',
        );
        const coveredAzimuthSectors = new Set(
          initialWindow.map((satellite) => Math.floor(((satellite.azimuthDeg % 360) + 360) % 360 / 45)),
        );
        assertCondition(
          coveredAzimuthSectors.size >= 4,
          'Expected walker-circular backend window to span multiple azimuth sectors instead of clustering into a narrow region.',
        );
      },
    },
  ];
}
