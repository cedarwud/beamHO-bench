import { resolveBeamFootprintBands } from '@/components/sim/beam-footprint-gain';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildGainModelUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: beam footprint visualization switches by gain model',
      kind: 'unit',
      run: () => {
        const flatBands = resolveBeamFootprintBands('flat', true);
        const besselBands = resolveBeamFootprintBands('bessel-j1', true);

        assertCondition(flatBands.length >= 2, 'Expected at least two bands for flat gain model.');
        assertCondition(
          besselBands.length > flatBands.length,
          'Expected bessel-j1 gain model to render richer radial band structure than flat model.',
        );
        assertCondition(
          flatBands[0].opacity !== besselBands[0].opacity ||
            flatBands[flatBands.length - 1].opacity !== besselBands[besselBands.length - 1].opacity,
          'Expected gain-model switch to produce distinct opacity profile.',
        );
        assertCondition(
          besselBands[0].outerRadiusRatio < 0.5,
          'Expected bessel-j1 first lobe to occupy a compact center area.',
        );
      },
    },
  ];
}
