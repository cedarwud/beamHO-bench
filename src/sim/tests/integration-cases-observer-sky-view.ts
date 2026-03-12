import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  buildResearchRuntimeOverrides,
  createResearchParameterSelection,
  normalizeResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import { runBaselineBatch } from '@/sim/bench/runner';
import { buildSatelliteDisplayFrame } from '@/viz/satellite/display-adapter';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function buildSyntheticObserverSkyProfile() {
  const baseProfile = loadPaperProfile('case9-default');
  const selection = normalizeResearchParameterSelection(baseProfile, {
    ...createResearchParameterSelection(baseProfile),
    'constellation.syntheticTrajectoryModel': 'walker-circular',
    'constellation.altitudeKm': '550',
    'constellation.inclinationDeg': '53',
    'constellation.orbitalPlanes': '24',
    'constellation.satellitesPerPlane': '66',
    'constellation.activeSatellitesInWindow': '16',
  });
  const runtimeOverrides = buildResearchRuntimeOverrides({
    profile: baseProfile,
    selection,
  });
  return loadPaperProfile('case9-default', runtimeOverrides);
}

export function buildObserverSkyViewIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: observer-sky display adapter enforces the same zone semantics across Synthetic Orbit, Starlink TLE, and OneWeb TLE',
      kind: 'integration',
      run: () => {
        const profiles = [
          buildSyntheticObserverSkyProfile(),
          loadPaperProfile('starlink-like'),
          loadPaperProfile('oneweb-like'),
        ];

        for (const profile of profiles) {
          const batch = runBaselineBatch({
            profile,
            seed: 42,
            baselines: ['max-rsrp'],
            tickCount: 1,
            captureSnapshots: true,
          });
          const snapshot = batch.runs[0]?.snapshots?.[0];
          assertCondition(
            Boolean(snapshot && snapshot.satellites.length > 0),
            `Expected snapshot satellites for observer-sky integration profile=${profile.profileId}.`,
          );

          const displayFrame = buildSatelliteDisplayFrame({
            satellites: snapshot?.satellites ?? [],
            config: {
              areaWidthKm: profile.scenario.areaKm.width,
              areaHeightKm: profile.scenario.areaKm.height,
              minElevationDeg: profile.constellation.minElevationDeg,
            },
          });
          const displayById = new Map(
            displayFrame.satellites.map((satellite) => [satellite.satelliteId, satellite]),
          );

          assertCondition(
            displayFrame.satellites.length > 0,
            `Expected observer-sky display output for profile=${profile.profileId}.`,
          );
          assertCondition(
            displayFrame.satellites.every((satellite) =>
              satellite.renderPosition.every((value) => Number.isFinite(value)),
            ),
            `Expected finite observer-sky render positions for profile=${profile.profileId}.`,
          );

          for (const satellite of snapshot?.satellites ?? []) {
            const displayState = displayById.get(satellite.id);

            if (satellite.elevationDeg < 0) {
              assertCondition(
                displayState === undefined,
                `Expected below-horizon satellite to stay hidden for profile=${profile.profileId}, sat=${satellite.id}.`,
              );
              continue;
            }

            if (satellite.elevationDeg < profile.constellation.minElevationDeg) {
              assertCondition(
                displayState?.zone === 'ghost',
                `Expected ghost display state below theta_min for profile=${profile.profileId}, sat=${satellite.id}.`,
              );
              continue;
            }

            assertCondition(
              displayState?.zone === 'active',
              `Expected active display state at/above theta_min for profile=${profile.profileId}, sat=${satellite.id}.`,
            );
          }

          const replayDisplayFrame = buildSatelliteDisplayFrame({
            satellites: snapshot?.satellites ?? [],
            config: {
              areaWidthKm: profile.scenario.areaKm.width,
              areaHeightKm: profile.scenario.areaKm.height,
              minElevationDeg: profile.constellation.minElevationDeg,
            },
          });
          assertCondition(
            JSON.stringify(displayFrame.satellites) === JSON.stringify(replayDisplayFrame.satellites),
            `Expected deterministic observer-sky display adapter replay for profile=${profile.profileId}.`,
          );
        }
      },
    },
  ];
}
