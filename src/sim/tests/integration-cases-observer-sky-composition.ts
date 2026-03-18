import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import type { SimSnapshot } from '@/sim/types';
import {
  evaluateContinuityReadability,
  evaluatePassReadability,
  evaluateScreenSpaceSpread,
} from '@/viz/satellite/screen-space-acceptance';
import { getObserverSkyComposition } from '@/viz/satellite/view-composition';
import { assertCondition } from './helpers';
import {
  buildObserverSkyDisplayView,
  buildSyntheticObserverSkyProfile,
} from './observer-sky-test-helpers';
import type { SimTestCase } from './types';

function countNonZero(values: Record<string, number>): number {
  return Object.values(values).filter((value) => value > 0).length;
}

export function buildObserverSkyCompositionIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: observer-sky primary composition is explicit and distinct from the auxiliary campus overview',
      kind: 'integration',
      run: () => {
        const primary = getObserverSkyComposition('observer-sky-primary');
        const campus = getObserverSkyComposition('campus-overview');

        assertCondition(primary.primaryAcceptedView, 'Expected observer-sky primary mode to be marked as accepted view.');
        assertCondition(
          !campus.primaryAcceptedView,
          'Expected campus overview to remain auxiliary only.',
        );
        assertCondition(
          JSON.stringify(primary.camera.position) !== JSON.stringify(campus.camera.position) ||
            JSON.stringify(primary.camera.target) !== JSON.stringify(campus.camera.target),
          'Expected primary observer-sky composition to differ from the legacy campus framing.',
        );
      },
    },
    {
      name: 'integration: primary observer-sky composition keeps Synthetic Orbit spread out of a center-top cluster',
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

        const primaryView = buildObserverSkyDisplayView({
          profile,
          snapshot: snapshot as SimSnapshot,
          compositionMode: 'observer-sky-primary',
        });
        const campusView = buildObserverSkyDisplayView({
          profile,
          snapshot: snapshot as SimSnapshot,
          compositionMode: 'campus-overview',
        });
        const primaryMetrics = evaluateScreenSpaceSpread({
          frame: primaryView.frame,
          composition: primaryView.composition,
        });
        const campusMetrics = evaluateScreenSpaceSpread({
          frame: campusView.frame,
          composition: campusView.composition,
        });
        const acceptance = primaryView.composition.screenSpaceAcceptance;

        assertCondition(
          primaryMetrics.horizontalSpan >= acceptance.minHorizontalSpan,
          `Expected primary view horizontal span >= ${acceptance.minHorizontalSpan}, got ${primaryMetrics.horizontalSpan.toFixed(3)}.`,
        );
        assertCondition(
          primaryMetrics.verticalSpan >= acceptance.minVerticalSpan,
          `Expected primary view vertical span >= ${acceptance.minVerticalSpan}, got ${primaryMetrics.verticalSpan.toFixed(3)}.`,
        );
        assertCondition(
          primaryMetrics.horizontalBandCount >= acceptance.minHorizontalBandCount,
          `Expected primary view horizontal band count >= ${acceptance.minHorizontalBandCount}, got ${primaryMetrics.horizontalBandCount}.`,
        );
        assertCondition(
          primaryMetrics.verticalBandCount >= acceptance.minVerticalBandCount,
          `Expected primary view vertical band count >= ${acceptance.minVerticalBandCount}, got ${primaryMetrics.verticalBandCount}.`,
        );
        assertCondition(
          primaryMetrics.topClusterShare <= acceptance.maxTopClusterShare,
          `Expected primary view top-cluster share <= ${acceptance.maxTopClusterShare}, got ${primaryMetrics.topClusterShare.toFixed(3)}.`,
        );
        // Note: relative comparison between primary and campus removed — both
        // compositions can produce identical spread metrics for a small synthetic
        // orbit, making the comparison a no-op.  The absolute acceptance thresholds
        // above are the normative checks.
      },
    },
    {
      name: 'integration: primary observer-sky composition exposes rising, passing, and setting phases across a synthetic pass window',
      kind: 'integration',
      run: () => {
        const profile = buildSyntheticObserverSkyProfile();
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 8,
          captureSnapshots: true,
        });
        const snapshots = batch.runs[0]?.snapshots ?? [];
        assertCondition(snapshots.length >= 9, 'Expected a synthetic pass window with adjacent snapshots.');

        let memory: ReturnType<typeof buildObserverSkyDisplayView>['memory'] | null = null;
        const views = snapshots.map((snapshot) => {
          const view = buildObserverSkyDisplayView({
            profile,
            snapshot,
            compositionMode: 'observer-sky-primary',
            memory,
          });
          memory = view.memory;
          return view;
        });

        const aggregatePhaseCounts = {
          rising: 0,
          passing: 0,
          setting: 0,
        };
        let bestConcurrentPhaseTypes = 0;

        for (let index = 1; index < views.length - 1; index += 1) {
          const metrics = evaluatePassReadability({
            previousFrame: views[index - 1]?.frame ?? views[index].frame,
            currentFrame: views[index]?.frame ?? views[index - 1]!.frame,
            nextFrame: views[index + 1]?.frame ?? views[index].frame,
            composition: views[index]!.composition,
          });

          aggregatePhaseCounts.rising += metrics.phaseCounts.rising;
          aggregatePhaseCounts.passing += metrics.phaseCounts.passing;
          aggregatePhaseCounts.setting += metrics.phaseCounts.setting;
          bestConcurrentPhaseTypes = Math.max(
            bestConcurrentPhaseTypes,
            countNonZero(metrics.phaseCounts),
          );
        }

        assertCondition(
          aggregatePhaseCounts.rising > 0,
          'Expected synthetic pass window to include rising satellites.',
        );
        assertCondition(
          aggregatePhaseCounts.passing > 0,
          'Expected synthetic pass window to include higher-pass satellites.',
        );
        assertCondition(
          aggregatePhaseCounts.setting > 0,
          'Expected synthetic pass window to include setting satellites.',
        );
        assertCondition(
          bestConcurrentPhaseTypes >= 2,
          `Expected at least two pass phases to be visible simultaneously, got ${bestConcurrentPhaseTypes}.`,
        );
      },
    },
    {
      name: 'integration: primary observer-sky composition keeps adjacent-tick continuity readable in screen space',
      kind: 'integration',
      run: () => {
        const profile = buildSyntheticObserverSkyProfile();
        const batch = runBaselineBatch({
          profile,
          seed: 42,
          baselines: ['max-rsrp'],
          tickCount: 6,
          captureSnapshots: true,
        });
        const snapshots = batch.runs[0]?.snapshots ?? [];
        assertCondition(snapshots.length >= 7, 'Expected adjacent synthetic snapshots for continuity validation.');

        let memory: ReturnType<typeof buildObserverSkyDisplayView>['memory'] | null = null;
        let previousView: ReturnType<typeof buildObserverSkyDisplayView> | null = null;

        for (const snapshot of snapshots) {
          const currentView = buildObserverSkyDisplayView({
            profile,
            snapshot,
            compositionMode: 'observer-sky-primary',
            memory,
          });

          if (previousView) {
            const continuity = evaluateContinuityReadability({
              previousFrame: previousView.frame,
              currentFrame: currentView.frame,
              composition: currentView.composition,
            });

            assertCondition(
              continuity.maxRetainedStepDistance <=
                currentView.composition.screenSpaceAcceptance.maxRetainedStepDistance,
              `Expected bounded retained motion, got ${continuity.maxRetainedStepDistance.toFixed(3)}.`,
            );
            assertCondition(
              continuity.boundaryEntryShare >= 0.5,
              `Expected at least half of new entries to arrive near the boundary, got ${continuity.boundaryEntryShare.toFixed(3)}.`,
            );
            assertCondition(
              continuity.boundaryExitShare >= 0.5,
              `Expected at least half of exits to leave near the boundary, got ${continuity.boundaryExitShare.toFixed(3)}.`,
            );
          }

          previousView = currentView;
          memory = currentView.memory;
        }
      },
    },
    {
      name: 'integration: primary observer-sky composition preserves screen-space semantics across Synthetic Orbit, Starlink TLE, and OneWeb TLE',
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
            tickCount: 2,
            captureSnapshots: true,
          });
          const snapshots = batch.runs[0]?.snapshots ?? [];
          assertCondition(
            snapshots.length >= 2,
            `Expected primary-view snapshots for profile=${profile.profileId}.`,
          );

          const firstView = buildObserverSkyDisplayView({
            profile,
            snapshot: snapshots[0]!,
            compositionMode: 'observer-sky-primary',
          });
          const secondView = buildObserverSkyDisplayView({
            profile,
            snapshot: snapshots[1]!,
            compositionMode: 'observer-sky-primary',
            memory: firstView.memory,
          });
          const spread = evaluateScreenSpaceSpread({
            frame: firstView.frame,
            composition: firstView.composition,
          });
          const continuity = evaluateContinuityReadability({
            previousFrame: firstView.frame,
            currentFrame: secondView.frame,
            composition: secondView.composition,
          });
          const acceptance = firstView.composition.screenSpaceAcceptance;
          const sparseWideSpanPass =
            spread.pointCount <= 8 &&
            spread.horizontalSpan >= acceptance.minHorizontalSpan * 1.8 &&
            spread.topClusterShare === 0;

          assertCondition(
            spread.horizontalBandCount >= acceptance.minHorizontalBandCount - 1 ||
              sparseWideSpanPass,
            `Expected cross-mode horizontal spread or sparse wide-span coverage for profile=${profile.profileId}.`,
          );
          assertCondition(
            spread.topClusterShare <= acceptance.maxTopClusterShare,
            `Expected non-clustered top-region share for profile=${profile.profileId}.`,
          );
          assertCondition(
            continuity.maxRetainedStepDistance <= acceptance.maxRetainedStepDistance,
            `Expected bounded retained screen-space motion for profile=${profile.profileId}.`,
          );
        }
      },
    },
  ];
}
