# beamHO-bench — Observer Sky View Frontend SDD (Closure-Tracked Pending)

**Version:** 0.1.0  
**Date:** 2026-03-12  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Define a research-oriented frontend rendering pipeline for satellite motion so `paper-baseline` and `real-trace` profiles are displayed as observer-centric LEO passes instead of generic 3D objects hovering above the campus scene.

This package exists because the current frontend path does not clearly express the academic visibility semantics discussed in the paper set:
1. satellite passes are observer-relative rise-pass-set events.
2. service visibility is governed by minimum elevation `theta_min`, not arbitrary scene placement.
3. frontend display state must be separated from simulation/runtime state.

This package supersedes the generic PTB D5 wording "frontend GLB movement coupling" with a more precise frontend target: observer-sky visualization with explicit visibility zones and clear module ownership.

---

## 2. Scope Boundary

In scope:
1. define an observer-centric sky-view display model for `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE`.
2. define visibility-zone semantics:
   - below horizon: hidden
   - `0 deg <= elevation < theta_min`: ghost / semi-transparent
   - `elevation >= theta_min`: active visible pass
3. define file/module responsibilities for frontend satellite rendering, projection, interpolation, and display-window selection.
4. remove view-specific leakage from simulation contracts where feasible in this phase.
5. provide lifecycle synchronization so active pending truth is explicit before code rewrite begins.

Out of scope:
1. handover baseline logic, KPI formulas, or scheduler behavior changes.
2. TLE ingestion, SGP4 propagation, or synthetic orbit backend replacement.
3. multi-orbit (`LEO/MEO/GEO`) unified runtime path.
4. RSMA / soft-HO / broad DRL runtime activation.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Observer-Centric Pass Semantics

1. All three constellation modes SHALL follow the same observer-centric semantic model:
   - a satellite enters from a horizon-side direction,
   - traverses a visible sky arc,
   - and exits toward another horizon-side direction.
2. The displayed direction of travel SHALL be derived from orbit/TLE geometry, not from arbitrary scene drift.
3. `theta_min` SHALL remain the service-visibility threshold for research view semantics.
4. Research view SHALL distinguish service-visible satellites from merely above-horizon satellites.

### 3.2 Visibility Zones

1. Frontend display SHALL support three explicit zones:
   - `hidden`: `elevation < 0 deg`
   - `ghost`: `0 deg <= elevation < theta_min`
   - `active`: `elevation >= theta_min`
2. `ghost` satellites SHALL not be treated as active service candidates in frontend labeling or state overlays.
3. `ghost` rendering MAY be disabled in a later simplified presentation mode, but research mode default SHALL keep the zone distinction explicit.

### 3.3 Simulation / Visualization Separation

1. `SimSnapshot` and `SatelliteState` SHALL remain primarily physical/runtime contracts, not visualization contracts.
2. View-only coordinates, opacity state, and display-window heuristics SHALL not be owned by orbit/scenario backend modules unless explicitly justified by KPI-impacting runtime needs.
3. Frontend display state SHALL be derived from snapshot fields such as:
   - `positionEcef`
   - `azimuthDeg`
   - `elevationDeg`
   - `rangeKm`
   - `visible`
4. Display-window selection for rendering SHALL not alter HO candidate sets, scheduler behavior, or KPI outputs.

### 3.4 File Responsibility Split

1. Orbit/scenario modules SHALL be limited to physical/runtime state:
   - `src/sim/scenarios/common/synthetic-orbit.ts`
   - `src/sim/scenarios/case9-analytic.ts`
   - `src/sim/scenarios/real-trace.ts`
2. A dedicated frontend/view adapter layer SHALL own:
   - observer-sky projection
   - visibility-zone classification
   - display-window budgeting
   - interpolation inputs for rendering
3. The intended file split for the rewrite SHALL be:
   - `src/viz/satellite/types.ts`
   - `src/viz/satellite/visibility-zones.ts`
   - `src/viz/satellite/observer-sky-projection.ts`
   - `src/viz/satellite/display-adapter.ts`
   - `src/components/scene/SatelliteSkyLayer.tsx`
4. `src/components/sim/SatelliteModel.tsx` SHALL remain a renderer for model instances, not the owner of orbit semantics.
5. `src/components/sim/ConnectionLines.tsx` SHALL consume already-resolved display positions from the view layer when rendered in observer-sky mode.
6. `src/components/scene/MainScene.tsx` SHALL only choose view mode / wiring and SHALL not embed satellite-preset semantics beyond profile selection defaults.

### 3.5 Determinism and Traceability

1. The display adapter SHALL be deterministic for the same snapshot + frontend view configuration.
2. Any new `ASSUME-*` introduced for visibility-zone or display-budget policy SHALL be registered and validation-covered in the same change set.
3. No hidden KPI-impacting constants SHALL be introduced in the rewrite.

---

## 4. Data Contract Target

The rewrite SHALL introduce a display-only contract separate from `SatelliteState`, for example:

```ts
interface SatelliteDisplayState {
  satelliteId: number;
  zone: 'ghost' | 'active';
  renderPosition: [number, number, number];
  azimuthDeg: number;
  elevationDeg: number;
  opacity: number;
  modelScale?: number;
}
```

Required rules:
1. `SatelliteDisplayState` SHALL be derived after simulation snapshot creation.
2. `hidden` satellites SHALL not produce render instances.
3. Display adapter output SHALL be bounded by a frontend display budget if needed for performance, but the budget policy SHALL remain outside simulation core.

---

## 5. Deletion / Supersession Target

This package is expected to retire or replace the following frontend-specific path pieces during implementation:
1. `renderPositionWorld` as a long-term field in `SatelliteState`
2. scenario-owned frontend sticky-window state
3. generic sky-dome projection coupled directly inside orbit backend
4. ambiguous "GLB coupling" implementation language that does not define observer-sky semantics

These items SHALL not be removed blindly before replacement code exists; replacement and cleanup must happen in the same implementation phase.

---

## 6. Validation Gates (Pass/Fail)

1. Gate OSV-1: observer-sky semantics
   - synthetic and real-trace snapshots produce display states consistent with `hidden/ghost/active` zone rules.
2. Gate OSV-2: separation contract
   - view-only fields are no longer required in core simulation snapshot contract.
3. Gate OSV-3: deterministic display adapter
   - same snapshot + same config yields identical display state ordering and positions.
4. Gate OSV-4: profile parity
   - `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE` all render as observer-centric passes with the same zone semantics.
5. Gate OSV-5: stage safety
   - `npm run validate:stage` passes after rewrite and cleanup.

---

## 7. Delivery Breakdown

1. D1: define frontend-view architecture, module boundaries, and supersession mapping from current render path.
2. D2: implement pure visibility-zone + observer-sky projection + display-adapter helpers.
3. D3: integrate `SatelliteSkyLayer` and keep `SatelliteModel` renderer-only.
4. D4: wire parity for `Synthetic Orbit` and `real-trace` modes, including line/overlay compatibility decisions.
5. D5: remove superseded render-only fields/helpers and synchronize pending/completed/status lifecycle docs.

Current implementation snapshot (2026-03-12):
1. D1 implemented: `viz/satellite/*` and `SatelliteSkyLayer` establish the frontend display-layer ownership split.
2. D2 implemented: visibility-zone classification, observer-sky projection, and deterministic display-adapter helpers are in code.
3. D3 implemented: `SatelliteModel` is renderer-only and `ConnectionLines` consumes display-layer-resolved render positions.
4. D4 implemented: synthetic / Starlink TLE / OneWeb TLE parity is covered by observer-sky integration tests.
5. D5 implemented: superseded frontend-only simulation fields/path pieces are retired and lifecycle docs are synchronized.

---

## 8. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. research-first semantics over purely decorative 3D motion.
4. meaningful module splitting by responsibility boundary.
5. stage-gate freshness and deterministic output requirements.
6. traceable assumptions and no hidden KPI-impacting constants.

---

## 9. Closure Reference

1. `sdd/completed/beamHO-bench-observer-sky-view-closure.md`
