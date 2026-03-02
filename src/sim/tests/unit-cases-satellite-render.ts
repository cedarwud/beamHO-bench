import { resolveSatelliteRenderDecision } from '@/components/sim/satellite-render-mode';
import { assertCondition } from './helpers';
import type { SimTestCase } from './types';

export function buildSatelliteRenderUnitCases(): SimTestCase[] {
  return [
    {
      name: 'unit: satellite render decision falls back to primitive when glb not ready',
      kind: 'unit',
      run: () => {
        const loading = resolveSatelliteRenderDecision('glb', 'loading');
        const errored = resolveSatelliteRenderDecision('glb', 'error');
        const idle = resolveSatelliteRenderDecision('glb', 'idle');

        assertCondition(
          loading.effectiveMode === 'primitive' && loading.reason === 'glb-loading-fallback',
          'Expected loading GLB to fallback to primitive mode.',
        );
        assertCondition(
          errored.effectiveMode === 'primitive' && errored.reason === 'glb-error-fallback',
          'Expected GLB load error to fallback to primitive mode.',
        );
        assertCondition(
          idle.effectiveMode === 'primitive' && idle.reason === 'glb-idle-fallback',
          'Expected idle GLB state to fallback to primitive mode.',
        );
      },
    },
    {
      name: 'unit: satellite render decision uses glb when asset is ready',
      kind: 'unit',
      run: () => {
        const glbReady = resolveSatelliteRenderDecision('glb', 'ready');
        const forcedPrimitive = resolveSatelliteRenderDecision('primitive', 'ready');

        assertCondition(
          glbReady.effectiveMode === 'glb' && glbReady.reason === 'glb-ready',
          'Expected ready GLB state to use glb render mode.',
        );
        assertCondition(
          forcedPrimitive.effectiveMode === 'primitive' &&
            forcedPrimitive.reason === 'requested-primitive',
          'Expected explicit primitive request to stay in primitive mode.',
        );
      },
    },
  ];
}
