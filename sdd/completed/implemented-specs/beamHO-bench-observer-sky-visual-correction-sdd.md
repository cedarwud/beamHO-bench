# beamHO-bench — Observer Sky Visual Correction SDD

**Version:** 0.1.0  
**Date:** 2026-03-12  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Define a corrective frontend package for observer-sky rendering so the actual on-screen satellite motion matches the intended research semantics discussed during review:
1. satellites should appear as observer-centric rise-pass-set events, not a clustered top-N cloud above scene center.
2. display-set selection must be separated from HO candidate limiting.
3. adjacent ticks should preserve display membership continuity unless a real pass enters/exits or a bounded budget decision requires replacement.

This package exists because the prior observer-sky rewrite (`beamHO-bench-observer-sky-view-sdd.md`) completed the ownership split and visibility-zone model, but did not define or validate the visual acceptance criteria required by the current frontend goal:
1. sky coverage across the visible dome,
2. stable display membership across time,
3. no abrupt replacement-driven jumps in the default `Synthetic Orbit` experience.

This package builds on the completed OSV architecture split rather than replacing it.

---

## 2. Scope Boundary

In scope:
1. define a research-oriented display-set policy separate from HO candidate limiting.
2. correct `Synthetic Orbit` frontend behavior so observer-sky motion is distributed across the visible dome rather than dominated by high-elevation top-N selection.
3. define continuity rules so display membership does not churn abruptly between adjacent ticks.
4. preserve the `hidden / ghost / active` semantics introduced by the prior OSV package.
5. apply the same frontend display semantics to `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE`.
6. add deterministic validation gates for sky coverage, membership continuity, and display/candidate separation.

Out of scope:
1. handover KPI formulas, baseline decision logic, or scheduler policy redesign.
2. replacement of TLE ingestion, SGP4 propagation, or synthetic orbit kinematics formulas.
3. multi-orbit (`LEO/MEO/GEO`) expansion.
4. campus scene art redesign unrelated to observer-sky pass correctness.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Display Set vs HO Candidate Set

1. Frontend display selection SHALL be independent from `handover.params.candidateSatelliteLimit`.
2. Restricting HO candidates SHALL not, by itself, reduce the number of satellites available to the observer-sky display layer.
3. The display layer SHALL consume a physical satellite pool that is broader than the HO candidate subset whenever more above-horizon satellites are available.
4. Any display budget SHALL be enforced in the frontend/view policy layer, not by reusing HO candidate truncation.

### 3.2 Observer-Sky Pass Semantics

1. All three constellation modes SHALL render satellites as observer-centric passes:
   - below horizon: hidden
   - `0 deg <= elevation < theta_min`: ghost
   - `elevation >= theta_min`: active
2. A satellite SHALL enter the display from a horizon-side azimuth direction and leave toward a horizon-side direction derived from physical geometry, not arbitrary scene drift.
3. The default research view SHALL keep the `ghost` zone enabled.
4. `ghost` satellites SHALL not be treated as active service-visible satellites in overlays or link selection.

### 3.3 Sky Coverage Policy

1. Display selection SHALL prefer broad azimuth coverage across the visible sky before applying pure elevation ranking.
2. When enough above-horizon satellites exist, the display layer SHALL avoid collapsing the full budget into a narrow central cluster near the zenith.
3. Coverage policy SHALL be deterministic for the same snapshot and frontend configuration.
4. Any new coverage heuristic or sector rule SHALL be registered through `ASSUME-*` governance if it can affect what the user sees in research mode.

### 3.4 Membership Continuity Policy

1. The display layer SHALL preserve existing on-screen satellites across adjacent ticks when they remain above horizon and still satisfy bounded display-policy criteria.
2. One-tick churn SHALL be treated as a bug unless caused by:
   - a satellite dropping below horizon,
   - a satellite rising above horizon into the display budget under the configured coverage/continuity policy,
   - or a deterministic budget replacement required by explicit policy.
3. Continuity state SHALL live in the frontend/view package, not in orbit/scenario runtime modules.
4. Display continuity SHALL not affect HO KPIs, scheduler outputs, or runtime baseline decisions.

### 3.5 Simulation / Visualization Contract

1. Runtime scenario modules SHALL remain responsible for physical satellite state only.
2. View-only membership memory, sky-coverage ranking, and display budgeting SHALL not be owned by:
   - `src/sim/scenarios/common/synthetic-orbit.ts`
   - `src/sim/scenarios/case9-analytic.ts`
   - `src/sim/scenarios/real-trace.ts`
3. If a broader physical satellite pool is required for display correctness, that pool SHALL be exposed as a physical/runtime contract with clear semantics, not as ad hoc render-only fields.
4. `MainScene` SHALL continue to do view wiring only and SHALL not embed synthetic display heuristics.

### 3.6 File Responsibility Split

1. The corrective implementation SHALL keep the existing OSV split and extend it with explicit display-policy helpers.
2. The intended responsibility layout SHALL be:
   - `src/viz/satellite/types.ts` for display-layer contracts only
   - `src/viz/satellite/visibility-zones.ts` for hidden/ghost/active classification
   - `src/viz/satellite/observer-sky-projection.ts` for pure azimuth/elevation projection
   - `src/viz/satellite/display-selection.ts` for sky-coverage and budget policy
   - `src/viz/satellite/display-continuity.ts` for membership retention / bounded churn policy
   - `src/viz/satellite/display-adapter.ts` for final display-state assembly
   - `src/components/scene/SatelliteSkyLayer.tsx` for React-side wiring of the corrective display policy
3. `src/components/sim/SatelliteModel.tsx` SHALL remain renderer-only.
4. `src/components/sim/ConnectionLines.tsx` SHALL consume already-resolved display positions and SHALL not own selection policy.

---

## 4. Data Contract Target

The corrective package SHALL make the distinction between physical pool, display set, and HO candidate subset explicit.

Minimum target model:

```ts
interface SatelliteDisplaySelectionInput {
  satellites: readonly SatelliteState[];
  minElevationDeg: number;
  displayBudget?: number;
}

interface SatelliteDisplaySelectionState {
  selectedIds: number[];
  droppedIds: number[];
  retainedIds: number[];
}
```

Required rules:
1. `satellites` in the display-selection input SHALL represent a physical pool, not an already-HO-limited list.
2. Display continuity memory SHALL be maintained after snapshot creation.
3. Hidden satellites SHALL not generate render instances.
4. Any physical-pool broadening SHALL remain deterministic and traceable.

---

## 5. Validation Gates (Pass/Fail)

1. Gate OSVC-1: display/candidate separation
   - reducing `candidateSatelliteLimit` does not collapse observer-sky display membership when broader above-horizon physical satellites remain available.
2. Gate OSVC-2: sky coverage
   - default `Synthetic Orbit` display output spans multiple azimuth sectors when enough above-horizon satellites exist.
3. Gate OSVC-3: membership continuity
   - adjacent-tick display churn remains bounded under the default synthetic profile; full-window replacement between consecutive ticks is forbidden.
4. Gate OSVC-4: cross-mode pass semantics
   - `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE` all preserve hidden/ghost/active rules under the corrective display policy.
5. Gate OSVC-5: stage safety
   - `npm run validate:stage` passes with refreshed artifacts after the corrective package lands.

---

## 6. Delivery Breakdown

1. D1: define corrective architecture and explicit supersession boundary relative to prior OSV closure.
2. D2: implement deterministic display-selection and continuity helpers in `src/viz/satellite/*`.
3. D3: broaden or decouple the physical satellite pool used by the display layer so frontend selection is not HO-candidate-limited.
4. D4: integrate `SatelliteSkyLayer` with the corrective display policy and retire superseded top-N visual assumptions.
5. D5: add deterministic tests and stage-gate evidence for coverage, continuity, and display/candidate separation.
6. D6: synchronize lifecycle docs and mark the corrective package closure only after visual acceptance criteria are actually satisfied.

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. research-first frontend semantics over decorative 3D motion.
4. no hidden KPI-impacting constants; any new display-policy assumptions must be traceable.
5. meaningful module splitting by responsibility boundary.
6. deterministic outputs and stage-gate freshness requirements.
7. no broad external simulator dependency.

---

## 8. Lifecycle Note

1. `beamHO-bench-observer-sky-view-sdd.md` remains closure-tracked for the completed ownership split and visibility-zone rewrite.
2. This corrective package reopens frontend observer-sky work specifically for visual acceptance gaps that remained after OSV closure.
3. D1~D6 are complete as of 2026-03-12 with closure evidence recorded in `sdd/completed/beamHO-bench-observer-sky-visual-correction-closure.md`.
4. This file remains under `sdd/pending/` as closure-tracked history; it is no longer the active pending truth.
