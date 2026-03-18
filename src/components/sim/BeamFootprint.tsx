/**
 * BeamFootprint — beam cone + ground footprint visualization.
 * SDD: beamHO-bench-beam-layout-sdd §5.3-§5.5
 *
 * Renders a translucent cone from each satellite's sky position to its ground
 * beam cluster center, plus concentric gain-ring footprints on the ground.
 * Colors keyed by HO state; scheduler coupled mode dims sleep beams.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SatelliteState, UEState } from '@/sim/types';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { GainModel } from '@/config/paper-profiles/types';
import { DoubleSide } from 'three';
import { resolveBeamFootprintBands } from './beam-footprint-gain';

interface BeamFootprintProps {
  satellites: SatelliteState[];
  gainModel: GainModel;
  ues: readonly UEState[];
  beamScheduler?: BeamSchedulerSnapshot;
  /** Ref to satellite render positions (NORAD ID → [x,y,z]), updated each frame by SatelliteSkyLayer. */
  renderPositionsRef: React.RefObject<Map<number, [number, number, number]>>;
}

/** Beam key for lookup maps */
function bk(satId: number, beamId: number): string {
  return `${satId}:${beamId}`;
}

// HO-state colors (SDD §5.4)
const COLOR_SERVING = '#4ade80';   // green
const COLOR_SECONDARY = '#fbbf24'; // amber
const COLOR_CHO_PREPARED = '#22d3ee'; // cyan
const COLOR_VISIBLE = '#38bdf8';   // blue (default)
const COLOR_INVISIBLE = '#64748b'; // slate

const SLEEP_OPACITY_SCALE = 0.3;
// VISUAL-ONLY: max satellites to render beam cones for (performance budget)
const MAX_DISPLAY_SATELLITES = 5;
// VISUAL-ONLY: Y offset above ground to prevent z-fighting with NTPU scene model
const GROUND_Y_OFFSET = 2;
// VISUAL-ONLY: opacity multiplier to make footprints visible against ground texture
const GROUND_OPACITY_BOOST = 3;
// VISUAL-ONLY: cone opacity
const CONE_OPACITY = 0.12;
// VISUAL-ONLY: number of radial segments for cone geometry
const CONE_SEGMENTS = 24;

/**
 * Imperative cone meshes — one per displayed satellite.
 * Updated each frame from renderPositionsRef so cones track satellite movement.
 */
function BeamCones({
  displaySatellites,
  hoColorMap,
  renderPositionsRef,
}: {
  displaySatellites: SatelliteState[];
  hoColorMap: Map<string, string>;
  renderPositionsRef: React.RefObject<Map<number, [number, number, number]>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const poolRef = useRef<THREE.Mesh[]>([]);

  // Shared geometry — unit cone, scaled per frame
  const coneGeo = useMemo(() => new THREE.ConeGeometry(1, 1, CONE_SEGMENTS, 1, true), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const renderPositions = renderPositionsRef.current;

    // Hide all
    for (const mesh of poolRef.current) {
      mesh.visible = false;
    }

    let idx = 0;
    for (const sat of displaySatellites) {
      const skyPos = renderPositions.get(sat.id);
      if (!skyPos) continue;

      // Ground center = average of beam centers
      const beams = sat.beams;
      if (beams.length === 0) continue;
      let gx = 0, gz = 0;
      for (const b of beams) {
        gx += b.centerWorld[0];
        gz += b.centerWorld[2];
      }
      gx /= beams.length;
      gz /= beams.length;
      const groundY = GROUND_Y_OFFSET;

      // Midpoint
      const mx = (skyPos[0] + gx) / 2;
      const my = (skyPos[1] + groundY) / 2;
      const mz = (skyPos[2] + gz) / 2;

      // Height = distance from sky to ground
      const dx = skyPos[0] - gx;
      const dy = skyPos[1] - groundY;
      const dz = skyPos[2] - gz;
      const height = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (height < 1) continue;

      // Cone radius at base = approximate beam cluster radius
      const maxR = beams.reduce((max, b) => {
        const bx = b.centerWorld[0] - gx;
        const bz = b.centerWorld[2] - gz;
        return Math.max(max, Math.sqrt(bx * bx + bz * bz) + b.radiusWorld);
      }, beams[0].radiusWorld);

      // Pick color: use serving beam color if any, else default
      let color = COLOR_VISIBLE;
      for (const b of beams) {
        const c = hoColorMap.get(bk(sat.id, b.beamId));
        if (c === COLOR_SERVING) { color = c; break; }
        if (c) color = c;
      }

      // Get or create mesh
      let mesh = poolRef.current[idx];
      if (!mesh) {
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        mesh = new THREE.Mesh(coneGeo, mat);
        group.add(mesh);
        poolRef.current.push(mesh);
      }

      mesh.visible = true;
      mesh.position.set(mx, my, mz);
      mesh.scale.set(maxR, height, maxR);

      // Orient cone: default points up (+Y). We need it to point from sky → ground.
      const dir = new THREE.Vector3(gx - skyPos[0], groundY - skyPos[1], gz - skyPos[2]).normalize();
      const up = new THREE.Vector3(0, -1, 0); // cone tip is -Y after default
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      mesh.quaternion.copy(quat);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(color);
      mat.opacity = CONE_OPACITY;

      idx++;
    }
  });

  return <group ref={groupRef} />;
}

export function BeamFootprint({
  satellites, gainModel, ues, beamScheduler, renderPositionsRef,
}: BeamFootprintProps) {
  // Build per-beam color lookup from UE serving state
  const hoColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    for (const ue of ues) {
      if (ue.choPreparedSatId != null && ue.choPreparedBeamId != null) {
        const key = bk(ue.choPreparedSatId, ue.choPreparedBeamId);
        if (!colorMap.has(key)) colorMap.set(key, COLOR_CHO_PREPARED);
      }
      if (ue.secondarySatId != null && ue.secondaryBeamId != null) {
        colorMap.set(bk(ue.secondarySatId, ue.secondaryBeamId), COLOR_SECONDARY);
      }
      if (ue.servingSatId != null && ue.servingBeamId != null) {
        colorMap.set(bk(ue.servingSatId, ue.servingBeamId), COLOR_SERVING);
      }
    }
    return colorMap;
  }, [ues]);

  // Build sleep-beam set from scheduler (coupled mode only)
  const sleepBeams = useMemo(() => {
    if (beamScheduler?.summary.mode !== 'coupled') return null;
    const set = new Set<string>();
    for (const state of beamScheduler.states) {
      if (state.powerClass === 'sleep') {
        set.add(bk(state.satId, state.beamId));
      }
    }
    return set;
  }, [beamScheduler]);

  // Show beams for top-N visible satellites by elevation (performance budget).
  const displaySatellites = useMemo(() => {
    const hoSatIds = new Set<number>();
    for (const [key] of hoColorMap) {
      hoSatIds.add(Number(key.split(':')[0]));
    }
    const visible = satellites
      .filter((s) => s.visible)
      .sort((a, b) => b.elevationDeg - a.elevationDeg);
    const result: SatelliteState[] = [];
    const added = new Set<number>();
    for (const s of visible) {
      if (hoSatIds.has(s.id)) { result.push(s); added.add(s.id); }
    }
    for (const s of visible) {
      if (result.length >= MAX_DISPLAY_SATELLITES) break;
      if (!added.has(s.id)) { result.push(s); added.add(s.id); }
    }
    return result;
  }, [satellites, hoColorMap]);

  return (
    <>
      {/* Cones from satellite sky positions to ground */}
      <BeamCones
        displaySatellites={displaySatellites}
        hoColorMap={hoColorMap}
        renderPositionsRef={renderPositionsRef}
      />
      {/* Ground footprint rings */}
      {displaySatellites.flatMap((satellite) =>
        satellite.beams.map((beam) => {
          const key = bk(satellite.id, beam.beamId);
          const bandColor = hoColorMap.get(key)
            ?? (satellite.visible ? COLOR_VISIBLE : COLOR_INVISIBLE);
          const isSleep = sleepBeams?.has(key) ?? false;

          return (
            <group
              key={key}
              position={[beam.centerWorld[0], beam.centerWorld[1] + GROUND_Y_OFFSET, beam.centerWorld[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {resolveBeamFootprintBands(gainModel, satellite.visible).map((band, bandIndex) => {
                const innerRadius = beam.radiusWorld * band.innerRadiusRatio;
                const outerRadius = beam.radiusWorld * band.outerRadiusRatio;
                const baseOpacity = Math.min(band.opacity * GROUND_OPACITY_BOOST, 0.6);
                const opacity = isSleep ? baseOpacity * SLEEP_OPACITY_SCALE : baseOpacity;

                return (
                  <mesh key={bandIndex} receiveShadow>
                    {band.innerRadiusRatio <= 0 ? (
                      <circleGeometry args={[outerRadius, 40]} />
                    ) : (
                      <ringGeometry args={[innerRadius, outerRadius, 40]} />
                    )}
                    <meshBasicMaterial
                      color={bandColor}
                      transparent
                      opacity={opacity}
                      side={DoubleSide}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        }),
      )}
    </>
  );
}
