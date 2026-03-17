import {
  applySatelliteDisplayContinuity,
  buildSatelliteDisplayContinuityMemory,
} from '@/viz/satellite/display-continuity';
import { buildSatelliteDisplayFrame } from '@/viz/satellite/display-adapter';
import { buildSatelliteDisplayCandidates } from '@/viz/satellite/display-selection';
import { classifySatelliteVisibilityZone } from '@/viz/satellite/visibility-zones';
import type { SatelliteState } from '@/sim/types';
import { assertCondition, createInvisibleSatellite } from './helpers';
import type { SimTestCase } from './types';

export function buildObserverSkyViewUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: observer-sky visibility zones follow hidden/ghost/active elevation semantics',
      kind: 'unit',
      run: () => {
        const minElevationDeg = 10;
        const hidden = classifySatelliteVisibilityZone(-0.1, minElevationDeg);
        const ghost = classifySatelliteVisibilityZone(5, minElevationDeg);
        const active = classifySatelliteVisibilityZone(10, minElevationDeg);

        assertCondition(hidden.zone === 'hidden', 'Expected elevation below 0 deg to be hidden.');
        assertCondition(
          ghost.zone === 'ghost',
          'Expected elevation between horizon and theta_min to be ghost.',
        );
        assertCondition(
          active.zone === 'active',
          'Expected elevation at or above theta_min to be active.',
        );
      },
    },
    {
      name: 'unit: observer-sky display selection is deterministic and filters hidden satellites before render assembly',
      kind: 'unit',
      run: () => {
        const satellites: SatelliteState[] = [
          {
            ...createInvisibleSatellite(),
            id: 20,
            positionWorld: [0, 0.6, 6],
            azimuthDeg: 35,
            elevationDeg: 4,
            rangeKm: 10,
          },
          {
            ...createInvisibleSatellite(),
            id: 10,
            positionWorld: [0, 3.6, 6],
            azimuthDeg: 15,
            elevationDeg: 25,
            rangeKm: 12,
          },
          {
            ...createInvisibleSatellite(),
            id: 30,
            positionWorld: [0, -0.2, 6],
            azimuthDeg: 220,
            elevationDeg: -3,
            rangeKm: 14,
          },
        ];
        const config = {
          areaWidthKm: 12,
          areaHeightKm: 12,
          minElevationDeg: 10,
        } as const;

        const selected = buildSatelliteDisplayCandidates({
          satellites,
          config: {
            minElevationDeg: config.minElevationDeg,
          },
        });
        const first = buildSatelliteDisplayFrame({
          satellites: selected,
          config,
        });
        const second = buildSatelliteDisplayFrame({
          satellites: selected,
          config,
        });

        assertCondition(first.satellites.length === 2, 'Expected hidden satellites to be filtered.');
        assertCondition(
          first.satellites[0]?.satelliteId === 10 && first.satellites[0]?.zone === 'active',
          'Expected active satellites to sort ahead of ghost satellites.',
        );
        assertCondition(
          first.satellites[1]?.satelliteId === 20 && first.satellites[1]?.zone === 'ghost',
          'Expected above-horizon but below-theta_min satellite to be ghost-rendered.',
        );
        assertCondition(
          first.satellites.every((satellite) =>
            satellite.renderPosition.every((value) => Number.isFinite(value)),
          ),
          'Expected observer-sky display adapter to emit finite render positions.',
        );
        assertCondition(
          JSON.stringify(first.satellites) === JSON.stringify(second.satellites),
          'Expected deterministic observer-sky display adapter output for the same inputs.',
        );
      },
    },
    {
      name: 'unit: observer-sky display selection preserves boundary and higher-pass layering under a bounded budget',
      kind: 'unit',
      run: () => {
        const selected = buildSatelliteDisplayCandidates({
          satellites: [
            {
              ...createInvisibleSatellite(),
              id: 101,
              azimuthDeg: 300,
              elevationDeg: 14,
              rangeKm: 16,
            },
            {
              ...createInvisibleSatellite(),
              id: 102,
              azimuthDeg: 28,
              elevationDeg: 17,
              rangeKm: 18,
            },
            {
              ...createInvisibleSatellite(),
              id: 103,
              azimuthDeg: 82,
              elevationDeg: 34,
              rangeKm: 11,
            },
            {
              ...createInvisibleSatellite(),
              id: 104,
              azimuthDeg: 180,
              elevationDeg: 52,
              rangeKm: 9,
            },
            {
              ...createInvisibleSatellite(),
              id: 105,
              azimuthDeg: 232,
              elevationDeg: 38,
              rangeKm: 10,
            },
          ],
          config: {
            minElevationDeg: 10,
            displayBudget: 4,
            phaseLowElevationDeg: 24,
            phaseHighElevationDeg: 46,
          },
        });

        assertCondition(
          selected.length === 5,
          'Expected all above-horizon candidates to remain rankable before continuity truncation.',
        );
        assertCondition(
          selected[0]?.phase === 'high-pass' &&
            selected[1]?.phase === 'mid-pass' &&
            selected[2]?.phase === 'mid-pass' &&
            selected[3]?.phase === 'boundary-ingress',
          'Expected ranked candidates to prioritise high-pass and mid-pass layers (readable arcs) ahead of boundary picks.',
        );
      },
    },
    {
      name: 'unit: observer-sky continuity retains prior members while allowing bounded replacement',
      kind: 'unit',
      run: () => {
        const firstTickSatellites: SatelliteState[] = [
          {
            ...createInvisibleSatellite(),
            id: 1,
            azimuthDeg: 10,
            elevationDeg: 42,
            rangeKm: 9,
          },
          {
            ...createInvisibleSatellite(),
            id: 2,
            azimuthDeg: 110,
            elevationDeg: 36,
            rangeKm: 10,
          },
          {
            ...createInvisibleSatellite(),
            id: 3,
            azimuthDeg: 220,
            elevationDeg: 31,
            rangeKm: 11,
          },
          {
            ...createInvisibleSatellite(),
            id: 4,
            azimuthDeg: 300,
            elevationDeg: 28,
            rangeKm: 12,
          },
        ];
        const secondTickSatellites: SatelliteState[] = [
          {
            ...createInvisibleSatellite(),
            id: 1,
            azimuthDeg: 12,
            elevationDeg: 41,
            rangeKm: 9,
          },
          {
            ...createInvisibleSatellite(),
            id: 2,
            azimuthDeg: 112,
            elevationDeg: 34,
            rangeKm: 10,
          },
          {
            ...createInvisibleSatellite(),
            id: 3,
            azimuthDeg: 225,
            elevationDeg: 30,
            rangeKm: 11,
          },
          {
            ...createInvisibleSatellite(),
            id: 9,
            azimuthDeg: 305,
            elevationDeg: 52,
            rangeKm: 8,
          },
          {
            ...createInvisibleSatellite(),
            id: 11,
            azimuthDeg: 40,
            elevationDeg: 18,
            rangeKm: 14,
          },
        ];

        const firstSelection = applySatelliteDisplayContinuity({
          candidates: buildSatelliteDisplayCandidates({
            satellites: firstTickSatellites,
            config: {
              minElevationDeg: 10,
              displayBudget: 4,
            },
          }),
          displayBudget: 4,
          sequenceKey: 'test-sequence',
          tick: 0,
          timeSec: 0,
        });
        const continuityMemory = buildSatelliteDisplayContinuityMemory({
          sequenceKey: 'test-sequence',
          tick: 0,
          timeSec: 0,
          selectedIds: firstSelection.selectedIds,
        });

        const secondSelection = applySatelliteDisplayContinuity({
          candidates: buildSatelliteDisplayCandidates({
            satellites: secondTickSatellites,
            config: {
              minElevationDeg: 10,
              displayBudget: 4,
            },
          }),
          displayBudget: 4,
          sequenceKey: 'test-sequence',
          tick: 1,
          timeSec: 1,
          memory: continuityMemory,
        });

        assertCondition(
          secondSelection.retainedIds.length >= 3,
          'Expected observer-sky continuity to retain most still-visible satellites across adjacent ticks.',
        );
        assertCondition(
          secondSelection.selectedIds.includes(9),
          'Expected bounded replacement to admit a new higher-pass satellite when budget pressure exists.',
        );
        assertCondition(
          secondSelection.droppedIds.length <= 1,
          'Expected adjacent-tick display churn to remain bounded.',
        );
      },
    },
  ];
}
