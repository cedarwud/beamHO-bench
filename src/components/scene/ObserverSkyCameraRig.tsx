import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { ObserverSkyCompositionConfig } from '@/viz/satellite/view-composition';

/**
 * Provenance:
 * - docs/zh-TW/07-observer-sky-visual-acceptance.md (Section 7)
 * - sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md (Section 3.1, 3.2, 3.6)
 *
 * Notes:
 * - Camera framing is explicitly selected by MainScene rather than inherited
 *   from generic campus defaults.
 */
export function ObserverSkyCameraRig({
  composition,
}: {
  composition: ObserverSkyCompositionConfig;
}) {
  return (
    <>
      <PerspectiveCamera
        key={`${composition.modeId}-camera`}
        makeDefault
        position={composition.camera.position}
        fov={composition.camera.fov}
        near={composition.camera.near}
        far={composition.camera.far}
      />
      <OrbitControls
        key={`${composition.modeId}-controls`}
        makeDefault
        target={composition.camera.target}
        enableDamping={composition.controls.enableDamping}
        dampingFactor={composition.controls.dampingFactor}
        minDistance={composition.controls.minDistance}
        maxDistance={composition.controls.maxDistance}
        minPolarAngle={composition.controls.minPolarAngle}
        maxPolarAngle={composition.controls.maxPolarAngle}
      />
    </>
  );
}
