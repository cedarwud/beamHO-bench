# beamHO-bench — Observer Sky Pass Conversion Layer SDD

**Version:** 0.1.0
**Date:** 2026-03-13
**Status:** Active Pending

Trigger evidence (2026-03-13):
1. Direct frontend review (`Synthetic Orbit`, `Observer Sky Primary`, 16 satellites) still shows satellites clustered in a center-top band with pack-replacement motion instead of readable rise/pass/set arcs.
2. Single-satellite debug (`Synthetic Orbit`, 1 satellite) confirms the problem is not selection budget — even one satellite slides along a low-altitude strip and exits frame within ~10 seconds, never producing a readable full sky pass.
3. Root-cause analysis identifies a missing architectural layer: the current pipeline converts geometry directly to render points without an intermediate semantic layer that tracks per-satellite pass trajectory.
4. Three prior packages (OSV, OSVC, OSGC) fixed ownership, separation, and composition infrastructure correctly — those decisions are preserved.

---

## 1. Purpose

Add a source-agnostic, view-only visual pass conversion layer between the display pool and the renderer, so that each satellite's on-screen motion reads as a continuous observer-centric sky pass (rise → pass → set).

This package exists because:
1. `beamHO-bench-observer-sky-view-sdd.md` fixed ownership split and visibility-zone semantics.
2. `beamHO-bench-observer-sky-visual-correction-sdd.md` fixed display/candidate separation and bounded continuity.
3. `beamHO-bench-observer-sky-god-view-composition-sdd.md` fixed primary composition mode, camera rig, and screen-space acceptance infrastructure.
4. The live screen still fails `docs/zh-TW/07-observer-sky-visual-acceptance.md` because the pipeline lacks a layer that converts per-tick geometry snapshots into persistent, trajectory-aware visual actors.

What the prior packages did NOT address:
1. Per-satellite persistent trajectory state across ticks.
2. Explicit entry boundary → traverse corridor → exit boundary path planning.
3. Camera elevation too flat (≈3.4°) compressing the sky hemisphere into a horizon strip.
4. Projection formula (`centerRetentionRatio`) pulling all satellites toward center regardless of azimuth.

---

## 2. Scope Boundary

In scope:
1. New visual pass conversion layer (3 modules) between display pool and renderer.
2. Camera rig correction — raise effective viewing angle so the sky hemisphere is readable.
3. Projection semantics correction — replace center-dome mapping with observer-sky hemisphere mapping.
4. Replacement of `visual-actors.ts` and `pass-lane-layout.ts` whose responsibilities are subsumed by the new layer.
5. Refactoring of `display-selection.ts` to fix logic errors and align phase semantics with the new layer.
6. Validation on both Synthetic and TLE sources.

Out of scope:
1. Handover KPI formulas, SINR calculation, beam scheduling logic.
2. Replacing TLE ingestion, SGP4 propagation, or synthetic orbit kinematics.
3. Redesigning the NTPU ground scene for aesthetics.
4. `SatelliteModel.tsx` hook extraction (deferred — functional as-is).
5. Multi-orbit (LEO/MEO/GEO) expansion.

---

## 3. Architectural Change

### 3.1 Current Pipeline (Problem)

```
orbit geometry → display-selection → observer-sky-projection → renderer
                                      (per-tick point)
```

Each tick independently computes a render point. No satellite has trajectory memory. Result: pack replacement, jump-to-position, center clustering.

### 3.2 Target Pipeline (Solution)

```
orbit geometry → display-selection → visual pass conversion layer → renderer
                                      ├─ pass-composition-state
                                      ├─ pass-motion-policy
                                      └─ pass-trajectory-conversion
```

The new layer sits between selection and rendering. It:
1. Maintains persistent per-satellite actor state across ticks.
2. Determines entry boundary, traverse corridor, and exit boundary for each actor.
3. Converts physical geometry into a visual trajectory target that the renderer interpolates toward.

### 3.3 Conversion Layer Input Contract

Source-agnostic. Both Synthetic and TLE produce the same fields:

| Field | Type | Source |
|-------|------|--------|
| `satelliteId` | `string` | all modes |
| `azimuthDeg` | `number` | topocentric |
| `elevationDeg` | `number` | topocentric |
| `rangeKm` | `number` | topocentric |
| `positionWorld` | `[number,number,number]` | scene transform |
| `visible` | `boolean` | visibility zone |
| `timeSec` | `number` | simulation clock |

### 3.4 Conversion Layer Output Contract

| Field | Type | Purpose |
|-------|------|---------|
| `satelliteId` | `string` | identity |
| `lifecycle` | `'entering' \| 'tracked' \| 'exiting'` | actor lifecycle |
| `phase` | `'ingress' \| 'mid-pass' \| 'high-pass' \| 'egress'` | pass phase |
| `entryBoundary` | `{ azimuthDeg, elevationDeg }` | where actor entered sky |
| `exitBoundary` | `{ azimuthDeg, elevationDeg }` | predicted exit boundary |
| `visualLane` | `number` | assigned corridor index |
| `visualTargetPosition` | `[number,number,number]` | converted render target |
| `motionSourcePosition` | `[number,number,number]` | interpolation origin |
| `screenSpaceContinuityHint` | `number` | priority for continuity |

---

## 4. Normative Requirements (MUST/SHALL)

### 4.1 Visual Pass Conversion Layer

1. The conversion layer SHALL be view-only. It SHALL NOT write back to runtime contracts, handover state, or simulation data.
2. Each satellite entering the display set SHALL be assigned a persistent visual actor that survives across ticks until the satellite exits the visible sky.
3. Each visual actor SHALL have an explicit lifecycle: `entering` → `tracked` → `exiting`.
4. Each visual actor SHALL have a determined entry boundary and predicted exit boundary based on its orbital motion trend.
5. The conversion layer SHALL assign each actor a visual corridor (lane) so that simultaneous passes are spatially separated.
6. The conversion layer SHALL be source-agnostic: Synthetic and TLE inputs use the same interface and logic.

### 4.2 Camera Rig

1. The primary Observer Sky camera SHALL have sufficient elevation angle (target ≥ 15°) to present the sky hemisphere as a readable dome, not a horizon strip.
2. Camera parameters SHALL be defined in `view-composition.ts` and consumed by `ObserverSkyCameraRig.tsx`.
3. The camera change SHALL NOT affect simulation data or handover calculations.

### 4.3 Projection Semantics

1. `observer-sky-projection.ts` SHALL map azimuth/elevation to observer-sky hemisphere positions where:
   - Low elevation (near horizon) → near boundary/edge of view
   - High elevation (near zenith) → near center/top of dome
   - Full 360° azimuth → full horizontal spread
2. The `centerRetentionRatio` parameter SHALL be removed or reduced to zero.
3. `depthCompressionRatio` SHALL be adjusted so that front-back separation is readable.
4. Projection SHALL remain a pure mathematical function with no side effects.

### 4.4 Module Replacement

1. `visual-actors.ts` SHALL be replaced by `pass-composition-state.ts`. The old file SHALL be deleted after migration.
2. `pass-lane-layout.ts` SHALL be replaced by `pass-motion-policy.ts` and `pass-trajectory-conversion.ts`. The old file SHALL be deleted after migration.
3. `display-pipeline.ts` SHALL be updated to orchestrate the new layer instead of the old modules.

### 4.5 Display Selection Alignment

1. `display-selection.ts` SHALL fix the known logic error (line ~70: phase comparison returning 0 when phases differ).
2. Phase determination SHALL use actual elevation trend (rising vs falling) instead of `sin(azimuth)` proxy.
3. Selection SHALL preserve phase diversity: budget allocation SHALL reserve slots for ingress, mid-pass, high-pass, and egress when geometry supports it.

### 4.6 Source Agnostic

1. Synthetic Orbit, Starlink TLE, and OneWeb TLE SHALL all pass through the same conversion layer.
2. Differences between modes SHALL only be in upstream geometry (density, direction, frequency), never in frontend display semantics.

---

## 5. New Module Design

### 5.1 `src/viz/satellite/pass-composition-state.ts`

Responsibility: Manage per-satellite persistent visual actor state.

Core behaviors:
1. Create actor when satellite first enters display set.
2. Record entry boundary (azimuth, elevation at first appearance).
3. Track lifecycle transitions: entering → tracked → exiting.
4. Detect exit condition (elevation dropping below threshold, or satellite removed from display set).
5. Predict exit boundary from motion trend.
6. Remove actor after exit animation completes.
7. Carry state across ticks via frame-to-frame memory (Map keyed by satelliteId).

### 5.2 `src/viz/satellite/pass-motion-policy.ts`

Responsibility: Decide per-actor spatial assignment.

Core behaviors:
1. Determine pass phase (ingress / mid-pass / high-pass / egress) from elevation and elevation trend.
2. Assign visual lane index to separate simultaneous passes spatially.
3. Resolve entry anchor position (screen-edge region corresponding to entry azimuth).
4. Resolve exit anchor position (screen-edge region corresponding to predicted exit azimuth).
5. Lane assignment SHALL consider existing occupied lanes to minimize overlap.

### 5.3 `src/viz/satellite/pass-trajectory-conversion.ts`

Responsibility: Convert physical geometry + policy decisions into visual render targets.

Core behaviors:
1. For `entering` actors: interpolate from entry anchor toward first corridor position.
2. For `tracked` actors: compute corridor-aware visual target from current azimuth/elevation using corrected projection.
3. For `exiting` actors: interpolate from last corridor position toward exit anchor.
4. Output `visualTargetPosition` and `motionSourcePosition` for renderer consumption.
5. Apply lane offset to avoid visual overlap between simultaneous passes.

---

## 6. Files Changed

### New files:
1. `src/viz/satellite/pass-composition-state.ts`
2. `src/viz/satellite/pass-motion-policy.ts`
3. `src/viz/satellite/pass-trajectory-conversion.ts`

### Modified files:
1. `src/viz/satellite/observer-sky-projection.ts` — remove centerRetentionRatio, fix hemisphere mapping
2. `src/viz/satellite/display-selection.ts` — fix logic error, align phase semantics
3. `src/viz/satellite/display-pipeline.ts` — wire new conversion layer
4. `src/viz/satellite/view-composition.ts` — update camera rig parameters
5. `src/viz/satellite/types.ts` — add conversion layer types
6. `src/components/scene/SatelliteSkyLayer.tsx` — consume new pipeline output

### Deleted files:
1. `src/viz/satellite/visual-actors.ts` — replaced by pass-composition-state.ts
2. `src/viz/satellite/pass-lane-layout.ts` — replaced by pass-motion-policy.ts + pass-trajectory-conversion.ts

### Unchanged files:
1. `src/viz/satellite/display-continuity.ts` — keep as-is
2. `src/viz/satellite/screen-space-acceptance.ts` — keep as-is
3. `src/viz/satellite/visibility-zones.ts` — keep as-is
4. `src/viz/satellite/display-adapter.ts` — keep as-is
5. `src/components/scene/ObserverSkyCameraRig.tsx` — keep as-is (reads from view-composition)
6. `src/components/sim/SatelliteModel.tsx` — keep as-is (renderer-only, consumes new output)

---

## 7. Acceptance Contract

Normative reference:
1. `docs/zh-TW/07-observer-sky-visual-acceptance.md`

This package MUST satisfy:
1. §3: Satellites appear from horizon boundary, traverse visible sky, exit toward another boundary. No mid-sky spawn/despawn.
2. §4: Each satellite is a continuous moving object along its own arc. No position-swapping or jump-to-point.
3. §5: Simultaneous satellites show time/space staggering from constellation geometry, not visual randomization.
4. §6: Display set is broader than HO candidate set. `candidateSatelliteLimit` does not collapse the visible sky.
5. §7: Primary view clearly shows entry direction, low-elevation zone, active zone, exit direction. Not a center-top cluster.
6. §8: Synthetic, Starlink TLE, OneWeb TLE share the same display semantics.
7. §9: None of the failure conditions listed in §9 remain present.

---

## 8. Validation Gates (Pass/Fail)

1. Gate OSPC-1: Single satellite full pass
   - Synthetic/1 satellite shows a complete rise → traverse → set arc lasting a reasonable duration in the primary view.
2. Gate OSPC-2: Multi-satellite spatial separation
   - Synthetic/16 satellites shows passes distributed across the sky hemisphere, not concentrated in one band.
3. Gate OSPC-3: Continuous motion
   - No satellite exhibits jump-to-position or pack-replacement behavior across 30 seconds of observation.
4. Gate OSPC-4: Phase readability
   - In the primary view, ingress/mid-pass/high-pass/egress phases are visually distinguishable.
5. Gate OSPC-5: Display/candidate separation
   - Changing `candidateSatelliteLimit` does not collapse the visible display set.
6. Gate OSPC-6: Cross-mode consistency
   - Starlink TLE and OneWeb TLE produce the same visual semantics as Synthetic (with different geometry).
7. Gate OSPC-7: Stage safety
   - `npm run lint`, `npm run test:sim`, `npm run build`, `npm run validate:stage` all pass.
8. Gate OSPC-8: Manual acceptance
   - Direct frontend review confirms the primary view no longer reads as center-top cluster, horizon-strip band, or pack replacement.

---

## 9. Delivery Breakdown

1. D1: Freeze this SDD scope. Delete old `visual-actors.ts` and `pass-lane-layout.ts` references from pipeline.
2. D2: Correct camera rig in `view-composition.ts` and projection semantics in `observer-sky-projection.ts`.
3. D3: Implement `pass-composition-state.ts` — persistent actor lifecycle management.
4. D4: Implement `pass-motion-policy.ts` — phase determination, lane assignment, entry/exit boundary resolution.
5. D5: Implement `pass-trajectory-conversion.ts` — geometry-to-visual-target conversion with corridor awareness.
6. D6: Wire new layer into `display-pipeline.ts` and update `types.ts`.
7. D7: Fix `display-selection.ts` logic error and align phase semantics.
8. D8: Validate single-satellite full pass (Gate OSPC-1).
9. D9: Validate multi-satellite separation and cross-mode (Gates OSPC-2 through OSPC-6).
10. D10: Run stage safety (Gate OSPC-7) and manual acceptance (Gate OSPC-8).

Verification order:
1. Synthetic / 1 satellite — prove single pass arc works
2. Synthetic / 16 satellites — prove spatial separation and staggering
3. Starlink TLE — prove real-trace compatibility
4. OneWeb TLE — prove cross-constellation consistency
5. Stage safety — prove no regression
6. Manual acceptance — prove visual result

---

## 10. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope.
2. Fixed NTPU observer coordinates.
3. Dual-mode support (`paper-baseline` + `real-trace`).
4. Research-first semantics over decorative animation.
5. No hidden KPI-impacting constants.
6. Deterministic validation and stage-gate freshness.
7. View-only conversion layer — no write-back to simulation or handover contracts.

---

## 11. Lifecycle Note

1. `beamHO-bench-observer-sky-view-sdd.md` remains closure-tracked for ownership split and visibility-zone semantics.
2. `beamHO-bench-observer-sky-visual-correction-sdd.md` remains closure-tracked for display/candidate separation and bounded continuity.
3. `beamHO-bench-observer-sky-god-view-composition-sdd.md` remains closure-tracked for primary composition mode and screen-space acceptance infrastructure.
4. The deleted `beamHO-bench-observer-sky-projection-selection-correction-sdd.md` is superseded by this document. Its diagnosis was correct but its solution (parameter-level correction without a conversion layer) was insufficient.
5. `sdd/completed/beamHO-bench-implementation-status.md` SHALL treat this file as the active pending truth until completion evidence exists.
