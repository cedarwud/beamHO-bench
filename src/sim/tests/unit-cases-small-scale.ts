import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { computeSmallScaleFadingDb } from '@/sim/channel/small-scale';
import { assertAlmostEqual, assertCondition } from './helpers';
import type { SimTestCase } from './types';

const FIXED_CONTEXT = {
  ueId: 17,
  satId: 3,
  beamId: 312,
  rangeKm: 835.75,
  elevationDeg: 41.2,
} as const;

export function buildSmallScaleUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: small-scale none model returns zero fading',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'none',
          },
        });
        const fading = computeSmallScaleFadingDb(profile, FIXED_CONTEXT);

        assertAlmostEqual(fading, 0, 1e-12);
      },
    },
    {
      name: 'unit: shadowed-rician small-scale fading is deterministic for fixed context',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'shadowed-rician',
          },
        });

        const first = computeSmallScaleFadingDb(profile, FIXED_CONTEXT);
        const second = computeSmallScaleFadingDb(profile, FIXED_CONTEXT);

        assertCondition(Number.isFinite(first), 'Expected finite fading value for shadowed-rician model.');
        assertAlmostEqual(first, second, 1e-12);
      },
    },
    {
      name: 'unit: loo small-scale fading is deterministic for fixed context',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          channel: {
            smallScaleModel: 'loo',
          },
        });

        const first = computeSmallScaleFadingDb(profile, FIXED_CONTEXT);
        const second = computeSmallScaleFadingDb(profile, FIXED_CONTEXT);

        assertCondition(Number.isFinite(first), 'Expected finite fading value for loo model.');
        assertAlmostEqual(first, second, 1e-12);
      },
    },
  ];
}
