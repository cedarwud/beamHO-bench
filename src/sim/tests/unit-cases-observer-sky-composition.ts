import {
  evaluateContinuityReadability,
  evaluatePassReadability,
  evaluateScreenSpaceSpread,
  projectSatelliteFrameToScreenSpace,
} from '@/viz/satellite/screen-space-acceptance';
import type { SatelliteDisplayFrame, SatelliteDisplayState } from '@/viz/satellite/types';
import { getObserverSkyComposition } from '@/viz/satellite/view-composition';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

function createDisplayState(
  satelliteId: number,
  renderPosition: [number, number, number],
  elevationDeg: number,
): SatelliteDisplayState {
  return {
    satelliteId,
    zone: elevationDeg >= 10 ? 'active' : 'ghost',
    renderPosition,
    azimuthDeg: 0,
    elevationDeg,
    rangeKm: 800,
    opacity: elevationDeg >= 10 ? 1 : 0.35,
  };
}

function createFrame(
  satellites: SatelliteDisplayState[],
): SatelliteDisplayFrame {
  return {
    satellites,
    renderPositionsById: new Map(
      satellites.map((satellite) => [satellite.satelliteId, satellite.renderPosition]),
    ),
  };
}

export function buildObserverSkyCompositionUnitCases(): SimTestCase[] {
  const composition = getObserverSkyComposition('observer-sky-primary');

  return [
    {
      name: 'unit: observer-sky primary composition screen projection is deterministic for the same frame',
      kind: 'unit',
      run: () => {
        const frame = createFrame([
          createDisplayState(1, [-140, 40, 180], 18),
          createDisplayState(2, [0, 120, 120], 55),
          createDisplayState(3, [145, 45, 185], 16),
        ]);
        const first = projectSatelliteFrameToScreenSpace({
          frame,
          composition,
        });
        const second = projectSatelliteFrameToScreenSpace({
          frame,
          composition,
        });

        assertCondition(
          JSON.stringify(first) === JSON.stringify(second),
          'Expected deterministic screen-space projection for the same composition/frame tuple.',
        );
      },
    },
    {
      name: 'unit: observer-sky screen-space spread helper distinguishes broad sky spread from center-top clustering',
      kind: 'unit',
      run: () => {
        const broadFrame = createFrame([
          createDisplayState(1, [-180, 35, 180], 15),
          createDisplayState(2, [-60, 90, 170], 30),
          createDisplayState(3, [0, 145, 150], 52),
          createDisplayState(4, [90, 95, 150], 33),
          createDisplayState(5, [185, 38, 170], 14),
        ]);
        const clusteredFrame = createFrame([
          createDisplayState(1, [-20, 160, 110], 52),
          createDisplayState(2, [-8, 155, 120], 49),
          createDisplayState(3, [5, 150, 115], 48),
          createDisplayState(4, [15, 158, 112], 51),
        ]);
        const broadMetrics = evaluateScreenSpaceSpread({
          frame: broadFrame,
          composition,
        });
        const clusteredMetrics = evaluateScreenSpaceSpread({
          frame: clusteredFrame,
          composition,
        });

        assertCondition(
          broadMetrics.horizontalSpan > clusteredMetrics.horizontalSpan,
          'Expected broad frame to span more horizontal screen space than a center-top cluster.',
        );
        assertCondition(
          broadMetrics.horizontalBandCount > clusteredMetrics.horizontalBandCount &&
            broadMetrics.verticalBandCount >= clusteredMetrics.verticalBandCount,
          'Expected broad frame to occupy more screen-space bands than a center-top cluster.',
        );
      },
    },
    {
      name: 'unit: observer-sky pass readability helper classifies rising, passing, and setting satellites',
      kind: 'unit',
      run: () => {
        const previousFrame = createFrame([
          createDisplayState(1, [-150, 40, 200], 14),
          createDisplayState(2, [0, 130, 150], 54),
          createDisplayState(3, [150, 55, 200], 26),
        ]);
        const currentFrame = createFrame([
          createDisplayState(1, [-120, 55, 190], 24),
          createDisplayState(2, [0, 145, 145], 60),
          createDisplayState(3, [135, 40, 195], 18),
        ]);
        const nextFrame = createFrame([
          createDisplayState(1, [-95, 70, 175], 34),
          createDisplayState(2, [0, 135, 145], 53),
          createDisplayState(3, [120, 28, 185], 10),
        ]);
        const metrics = evaluatePassReadability({
          previousFrame,
          currentFrame,
          nextFrame,
          composition,
        });

        assertCondition(
          metrics.phaseCounts.rising >= 1,
          'Expected at least one rising satellite.',
        );
        assertCondition(
          metrics.phaseCounts.passing >= 1,
          'Expected at least one passing satellite.',
        );
        assertCondition(
          metrics.phaseCounts.setting >= 1,
          'Expected at least one setting satellite.',
        );
      },
    },
    {
      name: 'unit: observer-sky continuity readability favors boundary entry and bounded retained motion',
      kind: 'unit',
      run: () => {
        const previousFrame = createFrame([
          createDisplayState(1, [-120, 65, 180], 24),
          createDisplayState(2, [0, 142, 145], 58),
        ]);
        const currentFrame = createFrame([
          createDisplayState(1, [-112, 70, 176], 28),
          createDisplayState(3, [190, 25, 170], 12),
        ]);
        const metrics = evaluateContinuityReadability({
          previousFrame,
          currentFrame,
          composition,
        });

        assertCondition(
          metrics.retainedCount === 1,
          'Expected one retained satellite in continuity sample.',
        );
        assertCondition(
          metrics.maxRetainedStepDistance < composition.screenSpaceAcceptance.maxRetainedStepDistance,
          'Expected retained motion to stay bounded in screen space.',
        );
        assertCondition(
          metrics.boundaryEntryShare === 1,
          'Expected new entry to appear from a boundary-like region.',
        );
      },
    },
  ];
}
