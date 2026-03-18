/**
 * Provenance:
 * - PAP-2023-BHFREQREUSE §III-A (Bessel beam pattern visualization)
 * - ASSUME-BEAM-GAIN-FLOOR-DB
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
 *
 * Notes:
 * - Renders beam footprints on observer-sky dome for serving + candidate satellites.
 * - View-only: no writes back to simulation or handover contracts.
 * - Uses resolveBeamFootprintBands for gain-model-aware concentric ring rendering.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GainModel } from '@/config/paper-profiles/types';
import type { UEState } from '@/sim/types';
import { resolveBeamFootprintBands } from '@/components/sim/beam-footprint-gain';
import { projectArcPosition } from '@/viz/satellite/pass-trajectory-conversion';

interface BeamSkyLayerProps {
  /** Ref to render positions by NORAD ID, updated each frame by SatelliteSkyLayer. */
  renderPositionsRef: React.RefObject<Map<number, [number, number, number]>>;
  ues: readonly UEState[];
  gainModel: GainModel;
  /** Angular beam radius in degrees (beamwidth3dBDeg). */
  beamAngularRadiusDeg: number;
}

// VISUAL-ONLY: beam disc base radius on dome (world units per degree of beam angular radius)
const BEAM_SCALE_WORLD_PER_DEG = 12;
// VISUAL-ONLY: max beams to render (performance budget)
const MAX_BEAM_DISCS = 30;

const SERVING_COLOR = new THREE.Color(0x38bdf8); // blue
const CANDIDATE_COLOR = new THREE.Color(0xfbbf24); // amber

export function BeamSkyLayer({
  renderPositionsRef,
  ues,
  gainModel,
  beamAngularRadiusDeg,
}: BeamSkyLayerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Collect serving + candidate satellite IDs
  const qualifyingIds = useMemo(() => {
    const serving = new Set<number>();
    const candidates = new Set<number>();
    for (const ue of ues) {
      if (ue.servingSatId != null) serving.add(ue.servingSatId);
      if (ue.secondarySatId != null) candidates.add(ue.secondarySatId);
      if (ue.choPreparedSatId != null) candidates.add(ue.choPreparedSatId);
    }
    return { serving, candidates };
  }, [ues]);

  const bands = useMemo(
    () => resolveBeamFootprintBands(gainModel, true),
    [gainModel],
  );

  const discRadius = beamAngularRadiusDeg * BEAM_SCALE_WORLD_PER_DEG;

  // Build ring geometries once
  const ringGeometries = useMemo(() => {
    return bands.map((band) => {
      const inner = band.innerRadiusRatio * discRadius;
      const outer = band.outerRadiusRatio * discRadius;
      return new THREE.RingGeometry(inner, outer, 32);
    });
  }, [bands, discRadius]);

  // Pool of mesh groups
  const poolRef = useRef<THREE.Group[]>([]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Hide all existing
    for (const child of poolRef.current) {
      child.visible = false;
    }

    const { serving, candidates } = qualifyingIds;
    const renderPositions = renderPositionsRef.current;
    let rendered = 0;

    for (const [noradId, pos] of renderPositions) {
      if (rendered >= MAX_BEAM_DISCS) break;
      const isServing = serving.has(noradId);
      const isCandidate = candidates.has(noradId);
      if (!isServing && !isCandidate) continue;

      // Get or create pool entry
      let poolEntry = poolRef.current[rendered];
      if (!poolEntry) {
        poolEntry = new THREE.Group();
        for (let b = 0; b < bands.length; b++) {
          const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(ringGeometries[b], mat);
          mesh.rotation.x = -Math.PI / 2; // lay flat on XZ plane
          poolEntry.add(mesh);
        }
        group.add(poolEntry);
        poolRef.current.push(poolEntry);
      }

      poolEntry.visible = true;
      poolEntry.position.set(pos[0], pos[1] - 5, pos[2]); // slightly below satellite

      const color = isServing ? SERVING_COLOR : CANDIDATE_COLOR;
      for (let b = 0; b < bands.length; b++) {
        const mesh = poolEntry.children[b] as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.copy(color);
        mat.opacity = bands[b].opacity * 0.6; // VISUAL-ONLY: scaled down for subtlety
        // Update geometry if disc radius changed
        if (mesh.geometry !== ringGeometries[b]) {
          mesh.geometry = ringGeometries[b];
        }
      }

      rendered++;
    }
  });

  return <group ref={groupRef} />;
}
