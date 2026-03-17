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
        const profile = loadPaperProfile('starlink-like', {
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
        const profile = loadPaperProfile('starlink-like', {
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
        const profile = loadPaperProfile('starlink-like', {
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
    {
      name: 'unit: small-scale realism options keep legacy-compatible output when disabled',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('starlink-like', {
          channel: {
            smallScaleModel: 'shadowed-rician',
            smallScaleParams: {
              temporalCorrelation: {
                enabled: false,
                coefficient: 0.85,
              },
              dopplerAware: {
                enabled: false,
                velocityScale: 1,
                speedOfLightMps: 299792458,
              },
            },
          },
        });

        const first = computeSmallScaleFadingDb(profile, {
          ...FIXED_CONTEXT,
          ueSpeedKmph: 60,
          tick: 0,
          timeSec: 0,
          timeStepSec: 1,
        });
        const second = computeSmallScaleFadingDb(profile, {
          ...FIXED_CONTEXT,
          ueSpeedKmph: 60,
          tick: 100,
          timeSec: 100,
          timeStepSec: 1,
        });

        assertAlmostEqual(first, second, 1e-12);
      },
    },
    {
      name: 'unit: temporal correlation and doppler-aware options are deterministic and time-varying when enabled',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('starlink-like', {
          channel: {
            smallScaleModel: 'shadowed-rician',
            smallScaleParams: {
              temporalCorrelation: {
                enabled: true,
                coefficient: 0.85,
              },
              dopplerAware: {
                enabled: true,
                velocityScale: 1,
                speedOfLightMps: 299792458,
              },
            },
          },
        });

        const atT20 = computeSmallScaleFadingDb(profile, {
          ...FIXED_CONTEXT,
          ueSpeedKmph: 60,
          tick: 20,
          timeSec: 20,
          timeStepSec: 1,
        });
        const atT20Replay = computeSmallScaleFadingDb(profile, {
          ...FIXED_CONTEXT,
          ueSpeedKmph: 60,
          tick: 20,
          timeSec: 20,
          timeStepSec: 1,
        });
        const atT21 = computeSmallScaleFadingDb(profile, {
          ...FIXED_CONTEXT,
          ueSpeedKmph: 60,
          tick: 21,
          timeSec: 21,
          timeStepSec: 1,
        });

        assertCondition(Number.isFinite(atT20), 'Expected finite fading value at t=20.');
        assertAlmostEqual(atT20, atT20Replay, 1e-12);
        assertCondition(
          atT20 !== atT21,
          'Expected realism-enabled fading to vary with time index for fixed link tuple.',
        );
      },
    },
  ];
}
