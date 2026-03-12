import { buildSatelliteDisplayFrame } from '@/viz/satellite/display-adapter';
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
      name: 'unit: observer-sky display adapter is deterministic and filters hidden satellites',
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

        const first = buildSatelliteDisplayFrame({
          satellites,
          config,
        });
        const second = buildSatelliteDisplayFrame({
          satellites,
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
  ];
}
