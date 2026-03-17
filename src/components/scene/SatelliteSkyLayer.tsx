/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-pass-conversion-sdd.md
 * - ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
 * - ASSUME-TRAJECTORY-CACHE-PRECOMPUTE
 *
 * Notes:
 * - Renders satellite GLB models on the observer-sky dome.
 * - Positions come from pre-computed trajectory cache (cubic interpolated).
 * - Slots are assigned per-pass (not per-tick) for stable tracking.
 * - Satellites naturally enter/exit from the horizon following real orbits.
 * - View-only: no writes back to simulation or handover contracts.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { ConnectionLines } from '@/components/sim/ConnectionLines';
import type { SatelliteGeometryState, UEState } from '@/sim/types';
import type { TrajectoryCache, TrajectoryPosition } from '@/sim/orbit/trajectory-cache';
import type { ObserverSkyCompositionConfig } from '@/viz/satellite/view-composition';
import { projectArcPosition } from '@/viz/satellite/pass-trajectory-conversion';

interface SatelliteSkyLayerProps {
  profile: PaperProfile;
  satellites: readonly SatelliteGeometryState[];
  ues: readonly UEState[];
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
  renderMode?: unknown;
  trajectoryCache?: TrajectoryCache;
}

interface SlotEntry {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

/** Each slot tracks one pass (not one satellite — a satellite can have multiple passes). */
interface SlotState {
  /** Pass index from trajectory cache, or -1 if empty. */
  passIdx: number;
  /** NORAD ID of the satellite in this slot. */
  noradId: number;
  smoothPos: THREE.Vector3;
  opacity: number;
  /** Ticks since this slot was assigned. Used to lerp new entries from boundary. */
  age: number;
}

// Must be >= max concurrent active passes (~60-70 for Starlink over NTPU)
// so every pass gets a slot immediately at low elevation. If slots < passes,
// late-assigned passes appear mid-sky — the core visual defect.
const DEFAULT_DISPLAY_COUNT = 80;
/** Elevation band over which opacity ramps from semi-transparent to full. */
const FADE_IN_BAND_DEG = 5;

// ── SatelliteFleet: trajectory-playback rendering ──

function SatelliteFleet({
  glbModelPath,
  glbModelScale,
  trajCacheRef,
  simTimeRef,
  playbackRateRef,
  uesRef,
  minElevationDeg,
  displayCount,
  renderPositionsRef,
}: {
  glbModelPath: string;
  glbModelScale: number;
  trajCacheRef: React.RefObject<TrajectoryCache | undefined>;
  simTimeRef: React.RefObject<number>;
  playbackRateRef: React.RefObject<number>;
  uesRef: React.RefObject<readonly UEState[]>;
  minElevationDeg: number;
  displayCount: number;
  renderPositionsRef: React.MutableRefObject<Map<number, [number, number, number]>>;
}) {
  const containerRef = useRef<THREE.Group>(null);
  const slotsRef = useRef<SlotEntry[]>([]);
  const statesRef = useRef<SlotState[]>([]);
  // Continuous time accumulator: advances every frame using delta × playbackRate,
  // syncs to engine tick time periodically to avoid drift.
  const continuousTimeRef = useRef(0);
  const lastSyncTimeRef = useRef(0);
  /** First frame flag: satellites already in the sky at t=0 should show immediately. */
  const firstFrameRef = useRef(true);

  // ── GLB loading + slot creation ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const s of slotsRef.current) {
      for (const m of s.materials) m.dispose();
      container.remove(s.group);
    }
    slotsRef.current = [];
    statesRef.current = [];

    let aborted = false;
    const loader = new GLTFLoader();

    loader.load(
      glbModelPath,
      (gltf) => { if (!aborted) build(container, gltf.scene); },
      undefined,
      (err) => {
        if (aborted) return;
        console.warn('[SatelliteFleet] GLB load failed, using sphere', err);
        const fallback = new THREE.Group();
        fallback.add(new THREE.Mesh(
          new THREE.SphereGeometry(6, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x7ee0ff, transparent: true }),
        ));
        build(container, fallback);
      },
    );

    function build(parent: THREE.Group, source: THREE.Group) {
      for (let i = 0; i < displayCount; i++) {
        const group = new THREE.Group();
        group.visible = false;
        const clone = source.clone(true);
        const mats: THREE.MeshStandardMaterial[] = [];
        clone.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            const applyMat = (m: THREE.Material) => {
              const c = m.clone() as THREE.MeshStandardMaterial;
              c.transparent = true;
              mats.push(c);
              return c;
            };
            mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map(applyMat)
              : applyMat(mesh.material);
          }
        });
        clone.scale.setScalar(glbModelScale);
        group.add(clone);
        parent.add(group);
        slotsRef.current.push({ group, materials: mats });
        statesRef.current.push({
          passIdx: -1,
          noradId: -1,
          smoothPos: new THREE.Vector3(),
          opacity: 0,
          age: 0,
        });
      }
    }

    return () => {
      aborted = true;
      const c = containerRef.current;
      for (const s of slotsRef.current) {
        for (const m of s.materials) m.dispose();
        if (c) c.remove(s.group);
      }
      slotsRef.current = [];
      statesRef.current = [];
    };
  }, [glbModelPath, glbModelScale, displayCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-frame update: pure trajectory playback ──
  useFrame((_state, delta) => {
    const slots = slotsRef.current;
    const states = statesRef.current;
    if (slots.length === 0) return;

    const cache = trajCacheRef.current;
    if (!cache) {
      for (let i = 0; i < slots.length; i++) slots[i].group.visible = false;
      return;
    }

    // ── Continuous time: advance every frame, sync to engine tick periodically ──
    const engineTime = simTimeRef.current;
    const rate = playbackRateRef.current;
    // When engine tick updates (engineTime changed), sync our continuous time
    if (engineTime !== lastSyncTimeRef.current) {
      continuousTimeRef.current = engineTime;
      lastSyncTimeRef.current = engineTime;
    } else {
      // Between ticks: advance continuously using frame delta × playback rate
      continuousTimeRef.current += delta * rate;
    }
    // Loop trajectory: when reaching the end, reset to beginning.
    const rawTimeSec = continuousTimeRef.current;
    const windowSec = cache.windowDurationSec;
    if (windowSec > 0 && rawTimeSec >= windowSec) {
      continuousTimeRef.current = 0;
      firstFrameRef.current = true;
      // Clear all slot assignments so satellites re-enter naturally
      for (const st of states) {
        st.passIdx = -1;
        st.noradId = -1;
        st.opacity = 0;
        st.age = 0;
      }
    }
    const timeSec = continuousTimeRef.current;

    // ── 1. Get all active passes at current time from trajectory cache ──
    const activePasses = cache.getActiveAt(timeSec);

    // ── 2. Priority IDs (serving / secondary / CHO-prepared) ──
    const priorityIds = new Set<number>();
    for (const ue of uesRef.current) {
      if (ue.servingSatId != null) priorityIds.add(ue.servingSatId);
      if (ue.secondarySatId != null) priorityIds.add(ue.secondarySatId);
      if (ue.choPreparedSatId != null) priorityIds.add(ue.choPreparedSatId);
    }

    // ── 3. Sort: priority first, then by pass peak elevation, then current ──
    // Peak elevation first: passes that traverse the high sky (near zenith)
    // get slots over low-skimming passes — keeps the scene center populated.
    // Current elevation as tiebreaker within similar peak groups.
    activePasses.sort((a, b) => {
      const ap = priorityIds.has(a.noradId) ? 1 : 0;
      const bp = priorityIds.has(b.noradId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const peakDiff = b.passMaxElevDeg - a.passMaxElevDeg;
      if (Math.abs(peakDiff) > 5) return peakDiff;
      return b.elevationDeg - a.elevationDeg;
    });

    // Build lookup: passIndex → TrajectoryPosition
    const passByIdx = new Map<number, TrajectoryPosition>();
    for (const p of activePasses) passByIdx.set(p.passIndex, p);

    // ── 4. Sticky slot assignment: keep existing pass assignments if still active ──
    const assignedPassIds = new Set<number>();
    const slotsToFill: number[] = [];

    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      if (st.passIdx < 0) {
        slotsToFill.push(i);
        continue;
      }
      // Check if this pass is still active
      if (passByIdx.has(st.passIdx)) {
        assignedPassIds.add(st.passIdx);
      } else {
        // Pass ended — release slot (satellite naturally left the sky)
        st.passIdx = -1;
        st.noradId = -1;
        st.opacity = 0;
        st.age = 0;
        slotsToFill.push(i);
      }
    }

    // ── 5. Fill empty slots ──
    // Stagger entries: max 1 new satellite per 45° azimuth sector per frame.
    // Same orbital plane satellites have similar azimuths and cross the
    // threshold together — without staggering they all appear at once.
    const SECTOR_SIZE = 45;
    const sectorsUsedThisFrame = new Set<number>();
    const isFirstFrame = firstFrameRef.current;

    // Only assign passes that are still near the horizon (el < 8°).
    // Passes already at high elevation missed their entry window —
    // skip them so satellites never appear mid-sky.
    // Exception: first frame shows all existing satellites.
    const MAX_ENTRY_ELEV = 8;
    const unassigned = activePasses.filter(
      (p) => !assignedPassIds.has(p.passIndex) && p.elevationDeg > -2
        && (isFirstFrame || p.elevationDeg < MAX_ENTRY_ELEV),
    );

    // Balance across screen quadrants and azimuth sectors (orbital plane proxy).
    // Scene: Z+ = bottom (toward camera), Z- = top, X- = left, X+ = right
    const quadCounts = [0, 0, 0, 0]; // TL, TR, BL, BR
    const azSectorSlotCount = new Map<number, number>(); // 20° az bin → slot count
    const AZ_DIVERSITY_BIN = 20;
    const MAX_PER_AZ_BIN = 2; // max 2 slots per 20° azimuth bin
    for (const st of states) {
      if (st.passIdx < 0) continue;
      const tp = passByIdx.get(st.passIdx);
      if (!tp) continue;
      const [sx, , sz] = projectArcPosition(tp.azimuthDeg, tp.elevationDeg);
      const qi = (sz < 0 ? 0 : 2) + (sx >= 0 ? 1 : 0);
      quadCounts[qi]++;
      const azBin = Math.floor(((tp.azimuthDeg % 360) + 360) % 360 / AZ_DIVERSITY_BIN);
      azSectorSlotCount.set(azBin, (azSectorSlotCount.get(azBin) ?? 0) + 1);
    }

    let nextUnassigned = 0;
    for (const slotIdx of slotsToFill) {
      // Find next pass that's in a sector not yet used this frame
      let assigned = false;
      while (nextUnassigned < unassigned.length) {
        const p = unassigned[nextUnassigned++];
        const sector = Math.floor(((p.azimuthDeg % 360) + 360) % 360 / SECTOR_SIZE);

        // First frame: skip staggering (show all existing satellites)
        if (!isFirstFrame && sectorsUsedThisFrame.has(sector)) continue;

        // Balance: skip if this quadrant or azimuth bin is over-represented.
        if (!isFirstFrame) {
          const [sx, , sz] = projectArcPosition(p.azimuthDeg, p.elevationDeg);
          const qi = (sz < 0 ? 0 : 2) + (sx >= 0 ? 1 : 0);
          const maxPerQuad = Math.ceil(states.length / 4) + 1;
          if (quadCounts[qi] >= maxPerQuad) continue;
          // Orbital plane diversity: max 2 slots per 20° azimuth bin
          const azBin = Math.floor(((p.azimuthDeg % 360) + 360) % 360 / AZ_DIVERSITY_BIN);
          if ((azSectorSlotCount.get(azBin) ?? 0) >= MAX_PER_AZ_BIN) continue;
        }

        const st = states[slotIdx];
        st.passIdx = p.passIndex;
        st.noradId = p.noradId;
        st.age = 0;
        st.opacity = (isFirstFrame && p.elevationDeg > 3) ? 1 : 0;
        const [px, py, pz] = projectArcPosition(p.azimuthDeg, p.elevationDeg);
        st.smoothPos.set(px, py, pz);
        assignedPassIds.add(p.passIndex);
        sectorsUsedThisFrame.add(sector);
        // Update balance counters
        const [qx, , qz] = projectArcPosition(p.azimuthDeg, p.elevationDeg);
        quadCounts[(qz < 0 ? 0 : 2) + (qx >= 0 ? 1 : 0)]++;
        const assignedAzBin = Math.floor(((p.azimuthDeg % 360) + 360) % 360 / AZ_DIVERSITY_BIN);
        azSectorSlotCount.set(assignedAzBin, (azSectorSlotCount.get(assignedAzBin) ?? 0) + 1);
        assigned = true;
        break;
      }
      if (!assigned) break;
    }

    firstFrameRef.current = false;

    // ── 6. Render all slots ──
    const positionsById = new Map<number, [number, number, number]>();

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const st = states[i];

      if (st.passIdx < 0) {
        slot.group.visible = false;
        continue;
      }

      const tp = passByIdx.get(st.passIdx);
      if (!tp) {
        slot.group.visible = false;
        continue;
      }

      // Position from trajectory cache (already cubic-interpolated)
      const [tx, ty, tz] = projectArcPosition(tp.azimuthDeg, tp.elevationDeg);
      st.smoothPos.set(tx, ty, tz);
      st.age++;

      // Opacity based on elevation
      let targetOpacity: number;
      if (tp.elevationDeg < 0) {
        targetOpacity = 0;
      } else if (tp.elevationDeg < minElevationDeg) {
        const frac = tp.elevationDeg / Math.max(1, minElevationDeg);
        targetOpacity = 0.3 * frac;
      } else if (tp.elevationDeg < minElevationDeg + FADE_IN_BAND_DEG) {
        const frac = (tp.elevationDeg - minElevationDeg) / FADE_IN_BAND_DEG;
        targetOpacity = 0.3 + 0.7 * frac;
      } else {
        targetOpacity = 1.0;
      }
      st.opacity += (targetOpacity - st.opacity) * 0.15;

      slot.group.visible = st.opacity > 0.01;
      slot.group.position.copy(st.smoothPos);
      for (const m of slot.materials) m.opacity = st.opacity;

      if (st.opacity > 0.01) {
        positionsById.set(st.noradId, [st.smoothPos.x, st.smoothPos.y, st.smoothPos.z]);
      }
    }

    renderPositionsRef.current = positionsById;
  });

  return <group ref={containerRef} />;
}

// ── Public component ──

export function SatelliteSkyLayer({
  profile,
  satellites,
  ues,
  glbModelPath,
  glbModelScale,
  snapshotTimeSec,
  showServingLinks = true,
  showSecondaryLinks = true,
  showPreparedLinks = true,
  playbackRate = 1,
  trajectoryCache,
}: SatelliteSkyLayerProps) {
  const trajCacheRef = useRef(trajectoryCache);
  trajCacheRef.current = trajectoryCache;
  const simTimeRef = useRef(snapshotTimeSec);
  simTimeRef.current = snapshotTimeSec;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  const uesRef = useRef(ues);
  uesRef.current = ues;

  const displayCount =
    profile.constellation.activeSatellitesInWindow ?? DEFAULT_DISPLAY_COUNT;

  const renderPositionsRef = useRef<Map<number, [number, number, number]>>(new Map());

  const activeSatIds = useMemo(
    () => new Set(satellites.map((s) => s.id)),
    [satellites],
  );

  return (
    <>
      <ConnectionLines
        satelliteRenderPositions={renderPositionsRef.current}
        activeSatelliteIds={activeSatIds}
        ues={ues}
        showServing={showServingLinks}
        showSecondary={showSecondaryLinks}
        showPrepared={showPreparedLinks}
      />
      <SatelliteFleet
        glbModelPath={glbModelPath}
        glbModelScale={glbModelScale}
        trajCacheRef={trajCacheRef}
        simTimeRef={simTimeRef}
        playbackRateRef={playbackRateRef}
        uesRef={uesRef}
        minElevationDeg={profile.constellation.minElevationDeg}
        displayCount={displayCount}
        renderPositionsRef={renderPositionsRef}
      />
    </>
  );
}
