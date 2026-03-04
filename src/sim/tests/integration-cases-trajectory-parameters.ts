import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  buildResearchRuntimeOverrides,
  createResearchParameterSelection,
  normalizeResearchParameterSelection,
  type ResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import { runBaselineBatch } from '@/sim/bench/runner';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function buildTrajectoryKinematicSignature(options: {
  profileId: 'case9-default';
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
        const baseProfile = loadPaperProfile('case9-default');
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
          profileId: 'case9-default',
          selection: baseSelection,
          tickCount: 12,
        });
        const walkerSignatureFirst = buildTrajectoryKinematicSignature({
          profileId: 'case9-default',
          selection: walkerSelection,
          tickCount: 12,
        });
        const walkerSignatureSecond = buildTrajectoryKinematicSignature({
          profileId: 'case9-default',
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
        const resolvedWalkerProfile = loadPaperProfile('case9-default', walkerOverrides);
        assertCondition(
          resolvedWalkerProfile.constellation.syntheticTrajectoryModel === 'walker-circular',
          'Expected resolved profile synthetic trajectory mode to be walker-circular.',
        );
        assertCondition(
          resolvedWalkerProfile.constellation.orbitalPlanes === 24 &&
            resolvedWalkerProfile.constellation.satellitesPerPlane === 66,
          'Expected walker-circular constellation tier overrides to propagate into resolved profile.',
        );
      },
    },
  ];
}
