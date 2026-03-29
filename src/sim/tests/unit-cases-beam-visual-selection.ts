import type { SatelliteState } from '@/sim/types';
import { resolveSceneFocusServingBeam } from '@/viz/satellite/beam-visual-selection';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function createSatellite(
  id: number,
  elevationDeg: number,
  beamDefs: Array<{ beamId: number; centerX: number; centerZ: number; radiusWorld: number }>,
): SatelliteState {
  return {
    id,
    positionEcef: [0, 0, 0],
    positionWorld: [0, 120, 0],
    positionLla: { lat: 0, lon: 0, altKm: 600 },
    azimuthDeg: 0,
    elevationDeg,
    rangeKm: 120,
    visible: true,
    beams: beamDefs.map((beam) => ({
      beamId: beam.beamId,
      centerLatLon: [0, 0],
      centerWorld: [beam.centerX, 0, beam.centerZ],
      radiusKm: 10,
      radiusWorld: beam.radiusWorld,
      connectedUeIds: [],
    })),
  };
}

export function buildBeamVisualSelectionUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: scene-focus serving beam requires footprint containment',
      kind: 'unit',
      run: () => {
        const selection = resolveSceneFocusServingBeam(
          [
            createSatellite(10, 70, [{ beamId: 1001, centerX: 40, centerZ: 0, radiusWorld: 10 }]),
            createSatellite(11, 60, [{ beamId: 1101, centerX: -35, centerZ: 0, radiusWorld: 10 }]),
          ],
          [0, 0],
        );

        assertCondition(selection === null, 'No scene-focus serving beam should be selected when no beam covers the focus point.');
      },
    },
    {
      name: 'unit: scene-focus serving beam picks closest covering beam',
      kind: 'unit',
      run: () => {
        const selection = resolveSceneFocusServingBeam(
          [
            createSatellite(20, 55, [{ beamId: 2001, centerX: 4, centerZ: 0, radiusWorld: 10 }]),
            createSatellite(21, 75, [{ beamId: 2101, centerX: 1, centerZ: 0, radiusWorld: 10 }]),
          ],
          [0, 0],
        );

        assertCondition(selection !== null, 'Expected a scene-focus serving beam when coverage exists.');
        assertCondition(
          selection?.satId === 21 && selection?.beamId === 2101,
          'Scene-focus serving beam should prefer the covering beam closest to the focus point.',
        );
      },
    },
  ];
}
