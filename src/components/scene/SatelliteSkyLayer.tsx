import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { ConnectionLines } from '@/components/sim/ConnectionLines';
import type { SatelliteRenderMode } from '@/components/sim/satellite-render-mode';
import type { SatelliteState, UEState } from '@/sim/types';
import type { ObserverSkyCompositionConfig } from '@/viz/satellite/view-composition';

interface SatelliteSkyLayerProps {
  profile: PaperProfile;
  satellites: readonly SatelliteState[];
  ues: readonly UEState[];
  renderMode: SatelliteRenderMode;
  glbModelPath: string;
  glbModelScale: number;
  composition: ObserverSkyCompositionConfig;
  continuitySequenceKey: string;
  snapshotTick: number;
  snapshotTimeSec: number;
  showServingLinks?: boolean;
  showSecondaryLinks?: boolean;
  showPreparedLinks?: boolean;
  playbackRate?: number;
}

/**
 * Orbital slot definition for a single satellite pass.
 *
 * Based on paper data (3GPP NTN, Session Duration Between Handovers in Dense LEO):
 * - LEO 600km altitude, orbital period ~96 min
 * - Pass duration (above horizon): 1-5 min per satellite
 * - 6-8 satellites monitored simultaneously at ≥10° elevation
 */
interface OrbitalSlot {
  azimuthRad: number;
  startOffsetSec: number;
  passDurationSec: number;
  peakElevationDeg: number;
}

// Source: synthetic-orbit.ts:23-24 (same constants used by backend)
const EARTH_MU_KM3_PER_SEC2 = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;
const REFERENCE_ALTITUDE_KM = 600;

// Realistic horizon-to-horizon pass durations at 600km (seconds).
// Source: orbital geometry T_pass ≈ (2/π) × T_orbit × arccos(cos(θ_max)/cos(θ_min))
// T_orbit at 600km ≈ 5760s. Higher peak elevation → longer visible pass.
// Interleaved high→low so high-elevation passes are spread across stagger offsets.
const BASE_PASS_DURATIONS = [780, 620, 760, 640, 740, 660, 720, 650, 770, 610, 700, 670, 690, 680, 750, 630];
const PEAK_ELEVATIONS = [82, 38, 78, 42, 75, 45, 70, 40, 80, 35, 68, 48, 65, 52, 62, 55];
const BASE_STAGGER_SEC = 50;

/**
 * Altitude scaling factor for pass duration using Kepler's third law.
 *
 * Source: synthetic-orbit.ts:119 — n = sqrt(μ / a³), T = 2π/n
 * Ratio = T(alt) / T(600km) = (a/a_ref)^(3/2)
 *
 * Results: 550km → 0.989x, 600km → 1.0x, 1200km → 1.132x
 */
function altitudeScale(altitudeKm: number): number {
  const aRef = EARTH_RADIUS_KM + REFERENCE_ALTITUDE_KM;
  const a = EARTH_RADIUS_KM + altitudeKm;
  return Math.pow(a / aRef, 1.5);
}

/**
 * Generate orbital slots grouped by orbital planes.
 *
 * Source: Walker-circular pattern from synthetic-orbit.ts:226
 *   raanRad = (2π × planeIndex) / orbitalPlanes
 * Satellites in the same plane share the same azimuth direction (parallel arcs).
 * Different planes are RAAN-spaced for even sky coverage.
 */
function generateSlots(
  count: number,
  altitudeKm: number,
  orbitalPlanes: number = 3,
): { slots: OrbitalSlot[]; cycleDuration: number } {
  const scale = altitudeScale(altitudeKm);
  const avgPass = 700 * scale;
  const gapSec = Math.max(60, avgPass * 0.15);
  const slots: OrbitalSlot[] = [];
  const referencePeriod = BASE_PASS_DURATIONS[0] * scale + gapSec;
  const numPlanes = Math.max(1, Math.min(orbitalPlanes, count));
  const TWO_PI = Math.PI * 2;

  for (let i = 0; i < count; i++) {
    const planeIndex = i % numPlanes;
    // Source: synthetic-orbit.ts:226 — RAAN spacing per plane
    const planeAzimuth = (TWO_PI * planeIndex) / numPlanes;
    // Small offset within plane so satellites in the same plane don't overlap
    const inPlaneIndex = Math.floor(i / numPlanes);
    const inPlaneOffset = (inPlaneIndex * 0.15); // slight azimuth spread within plane
    const passDuration = BASE_PASS_DURATIONS[i % BASE_PASS_DURATIONS.length] * scale;

    slots.push({
      azimuthRad: (planeAzimuth + inPlaneOffset) % TWO_PI,
      startOffsetSec: (i / count) * referencePeriod,
      passDurationSec: passDuration,
      peakElevationDeg: PEAK_ELEVATIONS[i % PEAK_ELEVATIONS.length],
    });
  }
  const cycleDuration = Math.max(...slots.map((s) => s.startOffsetSec + s.passDurationSec));
  return { slots, cycleDuration };
}

/**
 * All satellites managed in a single component with one useFrame callback.
 * GLB loaded once → cloned N times with independent materials.
 * Rebuilds when slotCount changes.
 */
function SatelliteFleet({
  glbModelPath,
  glbModelScale,
  playbackRate,
  minElevationDeg,
  slotCount,
  altitudeKm,
  orbitalPlanes,
}: {
  glbModelPath: string;
  glbModelScale: number;
  playbackRate: number;
  minElevationDeg: number;
  slotCount: number;
  altitudeKm: number;
  orbitalPlanes: number;
}) {
  const containerRef = useRef<THREE.Group>(null);
  const slotsRef = useRef<{ group: THREE.Group; materials: THREE.Material[] }[]>([]);
  const orbitRef = useRef<{ slots: OrbitalSlot[]; cycleDuration: number }>(generateSlots(slotCount, altitudeKm, orbitalPlanes));
  const simTimeRef = useRef(0);
  const lastClockRef = useRef(0);
  const { invalidate } = useThree();

  // Recompute orbital slots when count or altitude changes
  const orbit = useMemo(() => generateSlots(slotCount, altitudeKm, orbitalPlanes), [slotCount, altitudeKm, orbitalPlanes]);
  orbitRef.current = orbit;

  // Set initial simTime to mid-cycle on first render
  useEffect(() => {
    simTimeRef.current = orbit.cycleDuration * 0.4;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build/rebuild Three.js groups when slotCount or model changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Cleanup previous
    for (const entry of slotsRef.current) {
      for (const mat of entry.materials) mat.dispose();
      container.remove(entry.group);
    }
    slotsRef.current = [];

    const count = orbit.slots.length;
    const loader = new GLTFLoader();

    loader.load(
      glbModelPath,
      (gltf) => {
        const sourceScene = gltf.scene;
        const entries: { group: THREE.Group; materials: THREE.Material[] }[] = [];

        for (let i = 0; i < count; i++) {
          const group = new THREE.Group();
          group.visible = false;

          const clone = sourceScene.clone(true);
          const mats: THREE.Material[] = [];

          clone.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.castShadow = false;
              mesh.receiveShadow = false;
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map((m) => {
                  const c = m.clone();
                  c.transparent = true;
                  mats.push(c);
                  return c;
                });
              } else {
                const c = mesh.material.clone();
                c.transparent = true;
                mats.push(c);
                mesh.material = c;
              }
            }
          });

          clone.scale.setScalar(glbModelScale);
          group.add(clone);
          container.add(group);
          entries.push({ group, materials: mats });
        }

        slotsRef.current = entries;
        invalidate();
      },
      undefined,
      (err) => {
        console.warn('[SatelliteFleet] GLB load failed, using primitives', err);
        const geo = new THREE.SphereGeometry(6, 8, 6);
        const entries: { group: THREE.Group; materials: THREE.Material[] }[] = [];

        for (let i = 0; i < count; i++) {
          const mat = new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true });
          const mesh = new THREE.Mesh(geo, mat);
          const group = new THREE.Group();
          group.visible = false;
          group.add(mesh);
          container.add(group);
          entries.push({ group, materials: [mat] });
        }

        slotsRef.current = entries;
        invalidate();
      },
    );

    return () => {
      for (const entry of slotsRef.current) {
        for (const mat of entry.materials) mat.dispose();
        container.remove(entry.group);
      }
      slotsRef.current = [];
    };
  }, [glbModelPath, glbModelScale, orbit, invalidate]);

  useFrame((state) => {
    const entries = slotsRef.current;
    const { slots, cycleDuration } = orbitRef.current;
    if (entries.length === 0 || entries.length !== slots.length) return;

    const dt = state.clock.elapsedTime - lastClockRef.current;
    lastClockRef.current = state.clock.elapsedTime;
    simTimeRef.current += dt * playbackRate;

    const simTime = simTimeRef.current;
    const keplerScale = altitudeScale(altitudeKm);
    const visualAltScale = altitudeKm / REFERENCE_ALTITUDE_KM;
    const ghostHeightThreshold = 400 * visualAltScale * (minElevationDeg / 90);
    // Gap matches generateSlots
    const avgPass = 700 * keplerScale;
    const gapSec = Math.max(60, avgPass * 0.15);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const entry = entries[i];
      // Each satellite cycles independently: period = its own pass + gap
      const period = slot.passDurationSec + gapSec;
      // Offset simTime by the slot's stagger, then modulo its own period
      const shifted = simTime - slot.startOffsetSec;
      const localTime = ((shifted % period) + period) % period;

      if (localTime > slot.passDurationSec) {
        entry.group.visible = false;
        continue;
      }

      entry.group.visible = true;
      const progress = localTime / slot.passDurationSec;
      const angle = progress * Math.PI;

      // Higher altitude → visually larger arc (farther, higher dome)
      const baseRadius = 900 * visualAltScale;
      const heightRadius = 400 * visualAltScale * (slot.peakElevationDeg / 90);
      const currentY = heightRadius * Math.sin(angle);

      entry.group.position.set(
        baseRadius * Math.cos(angle) * Math.cos(slot.azimuthRad),
        currentY,
        baseRadius * Math.cos(angle) * Math.sin(slot.azimuthRad),
      );

      const opacity = currentY < ghostHeightThreshold ? 0.3 : 1.0;
      for (const mat of entry.materials) {
        mat.opacity = opacity;
      }
    }
  });

  return <group ref={containerRef} />;
}

export function SatelliteSkyLayer({
  profile,
  ues,
  glbModelPath,
  glbModelScale,
  playbackRate = 1,
  showServingLinks = true,
  showSecondaryLinks = true,
  showPreparedLinks = true,
}: SatelliteSkyLayerProps) {
  const slotCount = profile.constellation.activeSatellitesInWindow
    ?? profile.constellation.satellitesPerPlane
    ?? 8;

  return (
    <>
      <ConnectionLines
        satelliteRenderPositions={new Map()}
        ues={ues}
        showServing={showServingLinks}
        showSecondary={showSecondaryLinks}
        showPrepared={showPreparedLinks}
      />
      <SatelliteFleet
        glbModelPath={glbModelPath}
        glbModelScale={glbModelScale}
        playbackRate={playbackRate}
        minElevationDeg={profile.constellation.minElevationDeg}
        slotCount={slotCount}
        altitudeKm={profile.constellation.altitudeKm}
        orbitalPlanes={profile.constellation.orbitalPlanes}
      />
    </>
  );
}
