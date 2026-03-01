/**
 * Provenance:
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 *
 * Implementation note:
 * - `VITE_ORBIT_PROPAGATOR=sgp4` enables true SGP4 propagation through
 *   `satellite.js` over local TLE-derived OMM fixtures.
 * - Kepler propagation remains as deterministic fallback for robustness.
 */

export type {
  OrbitCatalog,
  OrbitElement,
  OrbitPoint,
  OrbitPropagationEngine,
  ObserverContext,
  Provider,
  TopocentricPoint,
} from './types';

export { loadOrbitCatalog } from './catalog';
export { propagateOrbitElement } from './propagation';
export { computeTopocentricPoint, createObserverContext, geoToWorldXZ } from './topocentric';
