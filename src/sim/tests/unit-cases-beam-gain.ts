/**
 * Provenance:
 * - PAP-2023-BHFREQREUSE §III-A
 * - ASSUME-BEAM-GAIN-FLOOR-DB
 *
 * Notes:
 * - Unit tests for beam antenna gain functions in beam-gain.ts.
 */

import { computeBeamGainDb, computeOffAxisDeg, BEAM_GAIN_FLOOR_DB } from '@/sim/channel/beam-gain';
import { assertAlmostEqual, assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildBeamGainUnitCases(): SimTestCase[] {
  const BEAMWIDTH_3DB = 2.5; // degrees, typical LEO satellite beam

  return [
    {
      name: 'unit: beam gain at boresight is 0 dB for bessel-j1',
      kind: 'unit',
      run: () => {
        const gain = computeBeamGainDb(0, BEAMWIDTH_3DB, 'bessel-j1');
        assertAlmostEqual(gain, 0, 0.001);
      },
    },
    {
      name: 'unit: beam gain at boresight is 0 dB for bessel-j1-j3',
      kind: 'unit',
      run: () => {
        const gain = computeBeamGainDb(0, BEAMWIDTH_3DB, 'bessel-j1-j3');
        assertAlmostEqual(gain, 0, 0.001);
      },
    },
    {
      name: 'unit: beam gain at 3dB beamwidth is approximately -3 dB for bessel-j1',
      kind: 'unit',
      run: () => {
        const gain = computeBeamGainDb(BEAMWIDTH_3DB, BEAMWIDTH_3DB, 'bessel-j1');
        // The 3dB point of [2·J₁(u)/u]² at u = 2.07123 should give ≈ -3 dB
        assertCondition(
          gain > -3.5 && gain < -2.5,
          `Expected gain ≈ -3 dB at 3dB beamwidth, got ${gain.toFixed(3)} dB`,
        );
      },
    },
    {
      name: 'unit: beam gain is monotonically decreasing from 0 to 3dB beamwidth for bessel-j1',
      kind: 'unit',
      run: () => {
        let prev = computeBeamGainDb(0, BEAMWIDTH_3DB, 'bessel-j1');
        for (let i = 1; i <= 10; i++) {
          const angle = (BEAMWIDTH_3DB * i) / 10;
          const current = computeBeamGainDb(angle, BEAMWIDTH_3DB, 'bessel-j1');
          assertCondition(
            current <= prev + 1e-9,
            `Gain not monotonically decreasing at ${angle.toFixed(2)}°: ${current.toFixed(3)} > ${prev.toFixed(3)}`,
          );
          prev = current;
        }
      },
    },
    {
      name: 'unit: beam gain respects floor at -20 dB',
      kind: 'unit',
      run: () => {
        // At a large off-axis angle the gain should be clamped to floor
        const gain = computeBeamGainDb(BEAMWIDTH_3DB * 5, BEAMWIDTH_3DB, 'bessel-j1');
        assertCondition(
          gain >= BEAM_GAIN_FLOOR_DB - 0.001,
          `Gain ${gain.toFixed(3)} below floor ${BEAM_GAIN_FLOOR_DB}`,
        );
      },
    },
    {
      name: 'unit: flat gain model always returns 0 dB',
      kind: 'unit',
      run: () => {
        assertAlmostEqual(computeBeamGainDb(0, BEAMWIDTH_3DB, 'flat'), 0);
        assertAlmostEqual(computeBeamGainDb(5, BEAMWIDTH_3DB, 'flat'), 0);
      },
    },
    {
      name: 'unit: bessel-j1-j3 has lower sidelobes than bessel-j1',
      kind: 'unit',
      run: () => {
        // At ~2x the beamwidth (first sidelobe region), j1-j3 should be lower
        const angle = BEAMWIDTH_3DB * 2.5;
        const j1Gain = computeBeamGainDb(angle, BEAMWIDTH_3DB, 'bessel-j1');
        const j1j3Gain = computeBeamGainDb(angle, BEAMWIDTH_3DB, 'bessel-j1-j3');
        assertCondition(
          j1j3Gain <= j1Gain + 0.1,
          `Expected bessel-j1-j3 sidelobes ≤ bessel-j1 at ${angle}°: j1=${j1Gain.toFixed(2)}, j1-j3=${j1j3Gain.toFixed(2)}`,
        );
      },
    },
    {
      name: 'unit: computeOffAxisDeg basic geometry',
      kind: 'unit',
      run: () => {
        // atan(1) = 45°
        assertAlmostEqual(computeOffAxisDeg(550, 550), 45, 0.01);
        // At distance 0, off-axis = 0
        assertAlmostEqual(computeOffAxisDeg(0, 550), 0);
      },
    },
  ];
}
