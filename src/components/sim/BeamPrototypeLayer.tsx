/**
 * Provenance: Ported from leo-simulator SatelliteBeams.tsx + EarthFixedCells.tsx
 * Renders beam cones from satellite dome position to ground hex pattern.
 * Uses useFrame to read renderPositionsRef so cones track the satellite model.
 * VISUAL-ONLY: does not affect simulation, SINR, or handover logic.
 */
import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PaperProfile } from '@/config/paper-profiles/types';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { SatelliteState } from '@/sim/types';
import { resolveSceneFocusServingBeam } from '@/viz/satellite/beam-visual-selection';
import { buildHexOffsets, axialToWorld } from '@/sim/scenarios/common/beam-layout';

interface BeamPrototypeLayerProps {
  profile: PaperProfile;
  satellites: SatelliteState[];
  beamScheduler?: BeamSchedulerSnapshot;
  renderPositionsRef: RefObject<Map<number, [number, number, number]>>;
  focusWorldXz: readonly [number, number];
}

// ── VISUAL-ONLY constants (ported from leo-simulator) ──
const VISUAL_CONE_RADIUS = 48; // VISUAL-ONLY: matches leo-sim cell.radius * 0.6
const VISUAL_CONE_SEGMENTS = 8; // VISUAL-ONLY: low-poly cone
const VISUAL_HEX_SPACING = 110; // VISUAL-ONLY: hex cell spacing in dome units
const VISUAL_GROUND_Y = 0; // VISUAL-ONLY: beam ground level
const SERVING_OPACITY = 0.35; // VISUAL-ONLY: matches leo-simulator
const CANDIDATE_OPACITY = 0.12; // VISUAL-ONLY: matches leo-simulator
const CONE_BASE_HEIGHT = 100; // Geometry base height, scaled in useFrame

function bk(satId: number, beamId: number): string {
  return `${satId}:${beamId}`;
}

function getPolarizationColor(beamId: number): THREE.Color {
  return beamId % 2 === 1 ? new THREE.Color('#ff8844') : new THREE.Color('#44aaff');
}

function buildVisualHexPositions(count: number): Array<[number, number]> {
  return buildHexOffsets(count).map(([q, r]) => axialToWorld(q, r, VISUAL_HEX_SPACING));
}

export function BeamPrototypeLayer({
  satellites,
  beamScheduler,
  renderPositionsRef,
  focusWorldXz,
}: BeamPrototypeLayerProps) {
  const servingSelection = useMemo(
    () => resolveSceneFocusServingBeam(satellites, focusWorldXz),
    [satellites, focusWorldXz],
  );

  const sleepBeamSet = useMemo(() => {
    if (beamScheduler?.summary.mode !== 'coupled') return null;
    const set = new Set<string>();
    for (const state of beamScheduler.states) {
      if (state.powerClass === 'sleep') set.add(bk(state.satId, state.beamId));
    }
    return set;
  }, [beamScheduler]);

  const servingSat = useMemo(
    () =>
      servingSelection
        ? satellites.find((s) => s.id === servingSelection.satId) ?? null
        : null,
    [satellites, servingSelection],
  );

  const beamCount = servingSat?.beams.length ?? 0;
  const hexPositions = useMemo(() => buildVisualHexPositions(beamCount), [beamCount]);

  const groupRef = useRef<THREE.Group>(null);
  const coneRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Scratch vectors reused each frame
  const _apex = useRef(new THREE.Vector3());
  const _ground = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _mid = useRef(new THREE.Vector3());
  const _quat = useRef(new THREE.Quaternion());
  const _upVec = new THREE.Vector3(0, 1, 0);

  useFrame(() => {
    if (!groupRef.current || !servingSat || !servingSelection) return;

    const map = renderPositionsRef.current;
    const domePos = map?.get(servingSat.id);
    if (import.meta.env.DEV && Math.random() < 0.01) {
      console.log(`[BeamProto:useFrame] mapSize=${map?.size ?? 'null'}, satId=${servingSat.id}, domePos=${domePos ? JSON.stringify(domePos) : 'null'}`);
    }
    if (!domePos) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    _apex.current.set(domePos[0], domePos[1], domePos[2]);

    for (let i = 0; i < coneRefs.current.length; i++) {
      const cone = coneRefs.current[i];
      if (!cone) continue;

      if (i >= beamCount) {
        cone.visible = false;
        continue;
      }

      const beam = servingSat.beams[i];
      const isSleep = sleepBeamSet?.has(bk(servingSat.id, beam.beamId)) ?? false;
      if (isSleep) {
        cone.visible = false;
        continue;
      }

      const [hx, hz] = hexPositions[i] ?? [0, 0];
      _ground.current.set(domePos[0] + hx, VISUAL_GROUND_Y, domePos[2] + hz);

      const dist = _apex.current.distanceTo(_ground.current);
      _dir.current.copy(_apex.current).sub(_ground.current).normalize();
      _mid.current.copy(_apex.current).add(_ground.current).multiplyScalar(0.5);
      _quat.current.setFromUnitVectors(_upVec, _dir.current);

      cone.visible = true;
      cone.position.copy(_mid.current);
      cone.quaternion.copy(_quat.current);
      // Scale cone height to match actual distance
      cone.scale.set(1, dist / CONE_BASE_HEIGHT, 1);
    }
  });

  if (!servingSat || !servingSelection) return null;

  return (
    <group ref={groupRef} name="beam-prototype-layer">
      {servingSat.beams.map((beam, i) => {
        const isServing = beam.beamId === servingSelection.beamId;
        const color = getPolarizationColor(beam.beamId);

        return (
          <mesh
            key={bk(servingSat.id, beam.beamId)}
            ref={(el) => { coneRefs.current[i] = el; }}
            renderOrder={6}
            visible={false}
          >
            <coneGeometry args={[VISUAL_CONE_RADIUS, CONE_BASE_HEIGHT, VISUAL_CONE_SEGMENTS, 1, true]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={isServing ? SERVING_OPACITY : CANDIDATE_OPACITY}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
