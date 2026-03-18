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
  rosterBudgetRef,
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
  rosterBudgetRef: React.RefObject<number>;
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
  /** First frame flag: warm-start at WARM_START_SEC so the sky is pre-populated. */
  const firstFrameRef = useRef(true);
  // VISUAL-ONLY: scene opens as if it has been running for this many seconds,
  // so satellites are already distributed across the sky instead of all entering
  // from edges simultaneously.
  const WARM_START_SEC = 300;
  /** Track lowest elevation at which each pass was first observed (passIndex → deg).
   *  Only passes first seen near the horizon are eligible for slot assignment,
   *  preventing mid-sky pop-in. Cleared on trajectory loop reset. */
  const firstSeenElevRef = useRef(new Map<number, number>());

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
    // VISUAL-ONLY: loop before the end of the replay window to avoid
    // sparse pass data near the boundary causing interpolation artifacts.
    const LOOP_END_SEC = 5500;
    const loopLen = Math.min(cache.replayDurationSec, LOOP_END_SEC) - WARM_START_SEC;
    // Map engine time into [WARM_START_SEC .. WARM_START_SEC + loopLen) seamlessly.
    // This ensures the sky is always pre-populated (never starts at t=0 where
    // no satellites have entered yet).
    const mappedTime = loopLen > 0
      ? WARM_START_SEC + (engineTime % loopLen)
      : engineTime;
    // When engine tick updates, sync continuous time to the mapped value.
    if (engineTime !== lastSyncTimeRef.current) {
      // Detect loop wrap: mapped time jumped backwards → new loop iteration.
      const prevMapped = continuousTimeRef.current;
      if (mappedTime < prevMapped - 60) {
        // Loop boundary crossed — reset slot assignments so warm-start
        // re-populates the sky with satellites already mid-pass.
        firstFrameRef.current = true;
        firstSeenElevRef.current.clear();
        for (const st of states) {
          st.passIdx = -1;
          st.noradId = -1;
          st.opacity = 0;
          st.age = 0;
        }
      }
      continuousTimeRef.current = mappedTime;
      lastSyncTimeRef.current = engineTime;
    } else {
      // Between ticks: advance continuously using frame delta × playback rate.
      continuousTimeRef.current += delta * rate;
      // Clamp to avoid overshooting into sparse data region.
      const maxTime = WARM_START_SEC + loopLen;
      if (continuousTimeRef.current >= maxTime) {
        continuousTimeRef.current = maxTime - 1;
      }
    }
    const timeSec = continuousTimeRef.current;

    // ── 1. Get all active passes at current time from trajectory cache ──
    const allPasses = cache.getActiveAt(timeSec);

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
    allPasses.sort((a, b) => {
      const ap = priorityIds.has(a.noradId) ? 1 : 0;
      const bp = priorityIds.has(b.noradId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const peakDiff = b.passMaxElevDeg - a.passMaxElevDeg;
      if (Math.abs(peakDiff) > 5) return peakDiff;
      return b.elevationDeg - a.elevationDeg;
    });

    // ── 3b. Cap to sidebar roster budget (activeSatellitesInWindow) ──
    // Sort first, then trim — keeps high-elevation + priority satellites.
    const rosterBudget = rosterBudgetRef.current;
    const activePasses = allPasses.length <= rosterBudget
      ? allPasses
      : allPasses.slice(0, rosterBudget);

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

    // ── 5. Fill empty slots with temporal-spatial stagger ──
    // Stagger entries: max 2 new satellites per 45° azimuth sector per frame.
    // Same orbital plane satellites have similar azimuths and cross the
    // threshold together — without staggering they all appear at once.
    // This stagger applies to ALL frames including the first frame.
    const SECTOR_SIZE = 45;
    const MAX_NEW_PER_SECTOR = 3;
    const sectorNewCount = new Map<number, number>();

    // Track first-seen elevation for each pass.  Only passes first observed
    // near the horizon (< ENTRY_ELEV_THRESHOLD) are eligible for slot
    // assignment — this guarantees every satellite enters from the scene edge
    // with a low-elevation fade-in, never popping in mid-sky.
    const ENTRY_ELEV_THRESHOLD = 20; // VISUAL-ONLY: max first-seen elevation for entry
    const firstSeen = firstSeenElevRef.current;
    for (const p of activePasses) {
      if (!firstSeen.has(p.passIndex)) {
        firstSeen.set(p.passIndex, p.elevationDeg);
      }
    }
    // Prune passes that are no longer active
    for (const pid of firstSeen.keys()) {
      if (!passByIdx.has(pid)) firstSeen.delete(pid);
    }

    // VISUAL-ONLY: max current elevation for slot assignment.  Even if a pass
    // was first seen near the horizon, we only assign it while it's still near
    // the edge so the user sees it enter from outside, not pop in mid-sky.
    const MAX_CURRENT_ELEV_FOR_ENTRY = 12;

    const isFirstFrame = firstFrameRef.current;
    const unassigned = activePasses.filter((p) => {
      if (assignedPassIds.has(p.passIndex)) return false;
      if (p.elevationDeg < -2) return false;
      // First frame (warm-start): accept all above-horizon passes so the sky
      // is pre-populated — these are satellites that would have entered earlier.
      if (isFirstFrame) return true;
      // Must have been first seen near horizon AND still be near the edge
      if ((firstSeen.get(p.passIndex) ?? 90) >= ENTRY_ELEV_THRESHOLD) return false;
      return p.elevationDeg < MAX_CURRENT_ELEV_FOR_ENTRY;
    });

    // Balance across screen quadrants and azimuth sectors (orbital plane proxy).
    // Scene: Z+ = bottom (toward camera), Z- = top, X- = left, X+ = right
    const quadCounts = [0, 0, 0, 0]; // TL, TR, BL, BR
    const azSectorSlotCount = new Map<number, number>(); // 20° az bin → slot count
    const AZ_DIVERSITY_BIN = 20;
    const MAX_PER_AZ_BIN = 4; // max slots per 20° azimuth bin
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

        // Stagger: limit new entries per azimuth sector (skip on first frame warm-start)
        if (!isFirstFrame && (sectorNewCount.get(sector) ?? 0) >= MAX_NEW_PER_SECTOR) continue;

        // Balance: skip if this quadrant or azimuth bin is over-represented
        // (skip balance checks on first frame warm-start — accept all).
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
        // Warm-start: satellites already in sky appear immediately at full opacity
        st.age = isFirstFrame ? 999 : 0;
        st.opacity = isFirstFrame ? 1 : 0;
        const [px, py, pz] = projectArcPosition(p.azimuthDeg, p.elevationDeg);
        st.smoothPos.set(px, py, pz);
        assignedPassIds.add(p.passIndex);
        sectorNewCount.set(sector, (sectorNewCount.get(sector) ?? 0) + 1);
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

      // Opacity based on elevation — VISUAL-ONLY fade ramp.
      // New entries must spend MIN_VISIBLE_AGE frames invisible so the user
      // sees them move from the dome edge before they become visible.
      const MIN_VISIBLE_AGE = 8; // VISUAL-ONLY: frames before satellite can be seen
      let targetOpacity: number;
      if (st.age < MIN_VISIBLE_AGE || tp.elevationDeg < 0) {
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
      st.opacity += (targetOpacity - st.opacity) * 0.12;

      slot.group.visible = st.opacity > 0.03;
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
  const rosterBudgetRef = useRef(
    profile.constellation.activeSatellitesInWindow ??
    profile.constellation.satellitesPerPlane ?? 55,
  );
  rosterBudgetRef.current =
    profile.constellation.activeSatellitesInWindow ??
    profile.constellation.satellitesPerPlane ?? 55;

  // VISUAL-ONLY: rendering slot budget is separate from simulation active window.
  // Use DEFAULT_DISPLAY_COUNT (80) so every concurrent pass gets a slot,
  // preventing mid-sky appearance from late slot assignment.
  const displayCount = DEFAULT_DISPLAY_COUNT;

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
        rosterBudgetRef={rosterBudgetRef}
        minElevationDeg={profile.constellation.minElevationDeg}
        displayCount={displayCount}
        renderPositionsRef={renderPositionsRef}
      />
    </>
  );
}
