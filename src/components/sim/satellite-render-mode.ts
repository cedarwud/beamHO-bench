export type SatelliteRenderMode = 'primitive' | 'glb';

export type SatelliteGlbLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface SatelliteRenderDecision {
  requestedMode: SatelliteRenderMode;
  effectiveMode: SatelliteRenderMode;
  reason:
    | 'requested-primitive'
    | 'glb-ready'
    | 'glb-loading-fallback'
    | 'glb-error-fallback'
    | 'glb-idle-fallback';
}

export function resolveSatelliteRenderDecision(
  requestedMode: SatelliteRenderMode,
  glbLoadState: SatelliteGlbLoadState,
): SatelliteRenderDecision {
  if (requestedMode === 'primitive') {
    return {
      requestedMode,
      effectiveMode: 'primitive',
      reason: 'requested-primitive',
    };
  }

  if (glbLoadState === 'ready') {
    return {
      requestedMode,
      effectiveMode: 'glb',
      reason: 'glb-ready',
    };
  }

  if (glbLoadState === 'error') {
    return {
      requestedMode,
      effectiveMode: 'primitive',
      reason: 'glb-error-fallback',
    };
  }

  if (glbLoadState === 'loading') {
    return {
      requestedMode,
      effectiveMode: 'primitive',
      reason: 'glb-loading-fallback',
    };
  }

  return {
    requestedMode,
    effectiveMode: 'primitive',
    reason: 'glb-idle-fallback',
  };
}
