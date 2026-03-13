import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import type { SatelliteGeometryState, SimSnapshot } from '@/sim/types';
import { assertCondition } from './helpers';
import {
  buildObserverSkyDisplayView,
  buildSyntheticObserverSkyProfile,
  getDisplayPool,
} from './observer-sky-test-helpers';
import type { SimTestCase } from './types';

function computeAzimuthSectorCount(
  satellites: readonly Pick<SatelliteGeometryState, 'azimuthDeg'>[],
  sectorCount: number,
): number {
  const sectors = new Set(
    satellites.map((satellite) => {
      let normalized = satellite.azimuthDeg % 360;
      if (normalized < 0) {
        normalized += 360;
      }
      return Math.min(sectorCount - 1, Math.floor((normalized / 360) * sectorCount));
    }),
  );
  return sectors.size;
}

export function buildObserverSkyViewIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: observer-sky display selection stays independent from HO candidateSatelliteLimit and uses a broader physical pool',
      kind: 'integration',
      run: () => {
        const constrainedProfile = buildSyntheticObserverSkyProfile({
          'handover.params.candidateSatelliteLimit': '2',
        });
        const relaxedProfile = buildSyntheticObserverSkyProfile({
          'handover.params.candidateSatelliteLimit': '8',
        });
        const constrainedBatch = runBaselineBatch({
          profile: constrainedProfile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 1,
          captureSnapshots: true,
        });
        const relaxedBatch = runBaselineBatch({
          profile: relaxedProfile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 1,
          captureSnapshots: true,
        });
        const constrainedSnapshot = constrainedBatch.runs[0]?.snapshots?.[0];
        const relaxedSnapshot = relaxedBatch.runs[0]?.snapshots?.[0];

        assertCondition(Boolean(constrainedSnapshot), 'Expected constrained synthetic snapshot.');
        assertCondition(Boolean(relaxedSnapshot), 'Expected relaxed synthetic snapshot.');

        const constrainedPool = getDisplayPool(constrainedSnapshot as SimSnapshot);
        const relaxedPool = getDisplayPool(relaxedSnapshot as SimSnapshot);

        assertCondition(
          constrainedPool.length > (constrainedSnapshot?.satellites.length ?? 0),
          'Expected observer-sky physical pool to be broader than runtime synthetic satellites.',
        );
        assertCondition(
          constrainedPool.length === relaxedPool.length,
          'Expected candidateSatelliteLimit changes not to mutate observer-sky physical pool size.',
        );

        const renderableCount = constrainedPool.filter(
          (satellite) => satellite.elevationDeg >= 0,
        ).length;
        const displayBudget = Math.min(
          renderableCount,
          (constrainedSnapshot?.satellites.length ?? 0) + 4,
        );
        assertCondition(
          displayBudget > (constrainedSnapshot?.satellites.length ?? 0),
          'Expected extra above-horizon satellites to remain available for display beyond runtime window size.',
        );

        const constrainedDisplay = buildObserverSkyDisplayView({
          profile: constrainedProfile,
          snapshot: constrainedSnapshot as SimSnapshot,
          displayBudget,
        });
        const relaxedDisplay = buildObserverSkyDisplayView({
          profile: relaxedProfile,
          snapshot: relaxedSnapshot as SimSnapshot,
          displayBudget,
        });

        assertCondition(
          JSON.stringify(constrainedDisplay.selection.selectedIds) ===
            JSON.stringify(relaxedDisplay.selection.selectedIds),
          'Expected observer-sky display membership to stay invariant when only HO candidateSatelliteLimit changes.',
        );
      },
    },
    {
      name: 'integration: default Synthetic Orbit display spans multiple azimuth sectors instead of collapsing into a central top-N cluster',
      kind: 'integration',
      run: () => {
        const profile = buildSyntheticObserverSkyProfile();
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 1,
          captureSnapshots: true,
        });
        const snapshot = batch.runs[0]?.snapshots?.[0];
        assertCondition(Boolean(snapshot), 'Expected synthetic observer-sky snapshot.');

        const displayBudget = profile.constellation.activeSatellitesInWindow ?? 16;
        const displayView = buildObserverSkyDisplayView({
          profile,
          snapshot: snapshot as SimSnapshot,
          displayBudget,
        });

        assertCondition(
          displayView.candidates.length > displayBudget,
          'Expected more renderable physical satellites than the display budget for coverage validation.',
        );

        const selectedSectorCount = new Set(
          displayView.selection.selected.map((candidate) => candidate.sectorIndex),
        ).size;
        assertCondition(
          selectedSectorCount >= 4,
          `Expected Synthetic Orbit display to span at least 4 azimuth sectors, got ${selectedSectorCount}.`,
        );

        const rawRuntimeSectorCount = computeAzimuthSectorCount(
          snapshot?.satellites ?? [],
          8,
        );
        assertCondition(
          selectedSectorCount >= Math.min(4, rawRuntimeSectorCount),
          'Expected corrected display selection to preserve broad sky coverage.',
        );
      },
    },
    {
      name: 'integration: adjacent synthetic observer-sky ticks preserve display membership continuity',
      kind: 'integration',
      run: () => {
        const profile = buildSyntheticObserverSkyProfile();
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 4,
          captureSnapshots: true,
        });
        const snapshots = batch.runs[0]?.snapshots ?? [];
        assertCondition(
          snapshots.length >= 5,
          'Expected consecutive snapshots for observer-sky continuity validation.',
        );

        const displayBudget = profile.constellation.activeSatellitesInWindow ?? 16;
        let memory: ReturnType<typeof buildObserverSkyDisplayView>['memory'] | null = null;
        let previousSelectedIds: number[] | null = null;

        for (const snapshot of snapshots) {
          const view = buildObserverSkyDisplayView({
            profile,
            snapshot,
            displayBudget,
            memory,
          });
          if (previousSelectedIds !== null) {
            assertCondition(
              view.selection.retainedIds.length >= Math.ceil(previousSelectedIds.length / 2),
              `Expected bounded observer-sky churn at tick=${snapshot.tick}, retained=${view.selection.retainedIds.length}.`,
            );
            assertCondition(
              view.selection.droppedIds.length < previousSelectedIds.length,
              `Expected observer-sky continuity to avoid full-window replacement at tick=${snapshot.tick}.`,
            );
          }
          previousSelectedIds = view.selection.selectedIds;
          memory = view.memory;
        }
      },
    },
    {
      name: 'integration: observer-sky hidden/ghost/active semantics stay consistent across Synthetic Orbit, Starlink TLE, and OneWeb TLE under the corrective display policy',
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
            Boolean(snapshot),
            `Expected snapshot satellites for observer-sky integration profile=${profile.profileId}.`,
          );

          const displayView = buildObserverSkyDisplayView({
            profile,
            snapshot: snapshot as SimSnapshot,
          });
          const displayById = new Map(
            displayView.frame.satellites.map((satellite) => [satellite.satelliteId, satellite]),
          );
          const displayPool = getDisplayPool(snapshot as SimSnapshot);

          assertCondition(
            displayView.frame.satellites.length > 0,
            `Expected observer-sky display output for profile=${profile.profileId}.`,
          );
          assertCondition(
            displayView.frame.satellites.every((satellite) =>
              satellite.renderPosition.every((value) => Number.isFinite(value)),
            ),
            `Expected finite observer-sky render positions for profile=${profile.profileId}.`,
          );

          for (const satellite of displayPool) {
            const displayState = displayById.get(satellite.id);

            if (satellite.elevationDeg < 0) {
              assertCondition(
                displayState === undefined,
                `Expected below-horizon satellite to stay hidden for profile=${profile.profileId}, sat=${satellite.id}.`,
              );
              continue;
            }

            if (satellite.elevationDeg < profile.constellation.minElevationDeg) {
              if (displayState !== undefined) {
                assertCondition(
                  displayState.zone === 'ghost',
                  `Expected ghost display state below theta_min for profile=${profile.profileId}, sat=${satellite.id}.`,
                );
              }
              continue;
            }

            if (displayState !== undefined) {
              assertCondition(
                displayState.zone === 'active',
                `Expected active display state at/above theta_min for profile=${profile.profileId}, sat=${satellite.id}.`,
              );
            }
          }

          const replayDisplay = buildObserverSkyDisplayView({
            profile,
            snapshot: snapshot as SimSnapshot,
          });
          assertCondition(
            JSON.stringify(displayView.frame.satellites) ===
              JSON.stringify(replayDisplay.frame.satellites),
            `Expected deterministic observer-sky corrective display replay for profile=${profile.profileId}.`,
          );
        }
      },
    },
  ];
}
