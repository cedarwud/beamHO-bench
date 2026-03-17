import { loadPaperProfile } from '@/config/paper-profiles/loader';
import type { LinkSample } from '@/sim/channel/link-budget';
import { resolveChoDecision } from '@/sim/handover/baseline-cho-mcho';
import { sampleKey } from '@/sim/handover/baseline-helpers';
import type { UeTriggerMemory } from '@/sim/handover/baseline-types';
import type { BeamState, SatelliteState } from '@/sim/types';
import { assertCondition, createBaseUe, createInvisibleSatellite } from './helpers';
import type { SimTestCase } from './types';

function createBeam(
  beamId: number,
  centerX: number,
  centerZ: number,
  radiusWorld = 10,
): BeamState {
  return {
    beamId,
    centerLatLon: [0, 0],
    centerWorld: [centerX, 0, centerZ],
    radiusKm: 10,
    radiusWorld,
    connectedUeIds: [],
  };
}

export function buildTimerChoUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: timer-cho prepared countdown exposes geometry fields in full fidelity',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('starlink-like', {
          constellation: {
            satelliteSpeedKmps: 1,
          },
          handover: {
            params: {
              a4ThresholdDbm: -140,
              a3OffsetDb: -10,
              homDb: 0,
              mtsSec: 0,
              timerAlphaOptions: [1],
            },
          },
        });

        const ue = createBaseUe({
          id: 21,
          speedKmph: 0,
          positionWorld: [0, 0, 0],
          servingSatId: 1,
          servingBeamId: 11,
        });
        const links: LinkSample[] = [
          { satId: 1, beamId: 11, rsrpDbm: -90, sinrDb: 5 },
          { satId: 2, beamId: 21, rsrpDbm: -80, sinrDb: 8 },
        ];
        const servingSample = links[0];
        const bestSample = links[1];
        const beamByKey = new Map<string, BeamState>([
          [sampleKey(1, 11), createBeam(11, 0, 0, 30)],
          [sampleKey(2, 21), createBeam(21, 5, 0, 30)],
        ]);
        const satById = new Map<number, SatelliteState>([
          [1, { ...createInvisibleSatellite(), id: 1, visible: true, elevationDeg: 40 }],
          [2, { ...createInvisibleSatellite(), id: 2, visible: true, elevationDeg: 55 }],
        ]);
        const memory: UeTriggerMemory = {};

        const first = resolveChoDecision({
          profile,
          ue,
          links,
          servingSample,
          bestSample,
          memory,
          timeStepSec: 1,
          beamByKey,
          satById,
        });

        assertCondition(
          first.selected?.satId === servingSample.satId &&
            first.selected?.beamId === servingSample.beamId,
          'Expected first timer-cho decision to hold serving link during preparation.',
        );
        assertCondition(first.triggerEvent === false, 'Expected no immediate handover trigger in prepare stage.');
        assertCondition(Boolean(first.prepared), 'Expected prepared metadata in timer-cho prepare stage.');

        const firstPrepared = first.prepared as NonNullable<typeof first.prepared>;
        assertCondition(
          (firstPrepared.targetMs ?? 0) > firstPrepared.elapsedMs,
          'Expected timer target to exceed elapsed time in prepare stage.',
        );
        assertCondition(
          (firstPrepared.remainingMs ?? 0) > 0,
          'Expected positive remaining countdown in prepare stage.',
        );
        assertCondition(
          Number.isFinite(firstPrepared.targetDistanceKm) && (firstPrepared.targetDistanceKm ?? -1) >= 0,
          'Expected finite non-negative targetDistanceKm in prepare metadata.',
        );
        assertCondition(
          firstPrepared.targetElevationDeg === 55,
          'Expected targetElevationDeg to match target satellite elevation.',
        );
        assertCondition(
          Number.isFinite(firstPrepared.timeToThresholdSec) && (firstPrepared.timeToThresholdSec ?? 0) > 0,
          'Expected positive timeToThresholdSec in prepare metadata.',
        );

        const second = resolveChoDecision({
          profile,
          ue,
          links,
          servingSample,
          bestSample,
          memory,
          timeStepSec: 1,
          beamByKey,
          satById,
        });

        assertCondition(Boolean(second.prepared), 'Expected prepared metadata to persist across consecutive ticks.');
        const secondPrepared = second.prepared as NonNullable<typeof second.prepared>;
        assertCondition(
          secondPrepared.elapsedMs > firstPrepared.elapsedMs,
          'Expected elapsed countdown to increase on consecutive prepare ticks.',
        );
        assertCondition(
          (secondPrepared.remainingMs ?? Number.POSITIVE_INFINITY) <
            (firstPrepared.remainingMs ?? Number.NEGATIVE_INFINITY),
          'Expected remaining countdown to decrease on consecutive prepare ticks.',
        );
      },
    },
  ];
}
