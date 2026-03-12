# beamHO-bench — Observer Sky God-View Composition SDD

**Version:** 0.1.0  
**Date:** 2026-03-12  
**Status:** Active Pending

---

## 1. Purpose

Define the final corrective frontend package for observer-sky rendering so the default on-screen experience matches the agreed visual acceptance standard in:
1. `docs/zh-TW/07-observer-sky-visual-acceptance.md`

This package exists because two prior packages completed lower-layer corrections but still left the final visual result unsatisfactory:
1. `beamHO-bench-observer-sky-view-sdd.md`
   - fixed ownership split and visibility-zone semantics
2. `beamHO-bench-observer-sky-visual-correction-sdd.md`
   - fixed broader physical pool, display/candidate separation, and bounded continuity

However, the current frontend still fails the intended user-facing acceptance because:
1. the main view is still effectively a campus third-person composition,
2. the screen-space result still clusters satellites near the center-top of the scene,
3. current tests over-weight proxy metrics (`azimuth sector`, `determinism`, `bounded churn`) and under-specify the final visual contract.

This package defines the missing composition layer:
1. keep a god-view camera if desired,
2. but make that camera and scene composition explicitly serve observer-centric sky-pass readability.

---

## 2. Scope Boundary

In scope:
1. define the primary accepted frontend view mode for satellite observation.
2. preserve god-view compatibility while making observer-centric sky-pass motion readable in screen space.
3. define screen-space acceptance criteria for:
   - non-clustered spread
   - rise/pass/set readability
   - temporal and spatial staggering
   - bounded visible-set churn
4. define how the main accepted view differs from the auxiliary campus third-person view.
5. add deterministic and manual acceptance evidence tied to the final visual result.

Out of scope:
1. handover KPI formulas, scheduler logic, or baseline policy changes.
2. replacing TLE ingestion, SGP4 propagation, or synthetic orbit kinematics.
3. redesigning the NTPU ground scene for purely artistic reasons.
4. multi-orbit (`LEO/MEO/GEO`) expansion.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 View Semantics

1. The frontend SHALL distinguish:
   - `camera perspective`
   - `satellite motion semantics`
2. The primary accepted view MAY remain a god-view / top-level scene camera.
3. The primary accepted view SHALL still present satellites as observer-centric sky passes over the fixed NTPU observer.
4. A campus third-person hero shot SHALL NOT be treated as the primary acceptance view for observer-sky correctness.

### 3.2 Primary View Mode

1. A dedicated primary observer-sky composition mode SHALL exist for validation and normal frontend use.
2. This mode SHALL allow the user to perceive:
   - entry direction near a horizon side,
   - traversal through the visible sky,
   - exit direction toward another side,
   - distinction between `ghost` and `active`.
3. If a secondary campus-wide view is preserved, it SHALL be explicitly auxiliary and SHALL not replace the primary accepted observer-sky composition.
4. `MainScene` SHALL wire the primary composition mode explicitly instead of relying on the current generic campus camera defaults.

### 3.3 Screen-Space Spread

1. The final rendered positions in the primary view SHALL not collapse into a narrow center-top cluster when multiple above-horizon satellites are available.
2. Acceptance SHALL consider screen-space spread, not only azimuth-sector diversity in world-space selection.
3. The primary view SHALL preserve both:
   - azimuth diversity
   - elevation-layer readability
4. A solution that passes sector-count tests but still looks like "a cluster in the middle" SHALL be considered failing.

### 3.4 Temporal and Spatial Staggering

1. Simultaneously visible satellites SHALL appear staggered in time and space when physical geometry supports it.
2. The frontend SHALL make it visually understandable that:
   - some satellites are rising,
   - some are in higher-elevation pass phases,
   - some are nearing exit.
3. The display policy SHALL not create the impression that all visible satellites move synchronously as one pack.

### 3.5 Continuity and Replacement

1. Display continuity SHALL remain frontend-owned.
2. Bounded churn SHALL remain required, but acceptance SHALL be defined by perceived continuity in the primary view, not only retained-ID count.
3. A satellite disappearing and another appearing at a distant location in a way that reads as a jump SHALL fail acceptance unless it corresponds to an explicit and explainable pass boundary.
4. Continuity policy SHALL remain independent from HO candidate limiting and KPI logic.

### 3.6 File Responsibility Split

1. This package SHALL preserve the existing `viz/satellite/*` ownership split.
2. A dedicated composition helper layer SHALL be introduced or clarified for the primary accepted view, for example:
   - `src/viz/satellite/view-composition.ts`
   - `src/viz/satellite/screen-space-acceptance.ts`
3. `observer-sky-projection.ts` SHALL remain a pure projection helper; it SHALL not become the place where camera/view-mode policy is hidden.
4. `MainScene.tsx` SHALL explicitly select the primary accepted view mode and pass the necessary composition config into `SatelliteSkyLayer`.
5. `SatelliteSkyLayer.tsx` SHALL remain the scene boundary for display-state composition and SHALL not leak view policy back into runtime modules.

---

## 4. Acceptance Contract

This package SHALL treat `docs/zh-TW/07-observer-sky-visual-acceptance.md` as the normative acceptance reference.

Minimum required acceptance dimensions:
1. `screen-space spread`
   - satellites are not visually collapsed near the same center-top region
2. `rise/pass/set readability`
   - entry, active pass, and exit phases can be visually distinguished
3. `temporal/spatial staggering`
   - the sky shows naturally staggered passes rather than synchronous pack motion
4. `display/candidate separation`
   - candidate limit changes do not collapse visible sky composition
5. `bounded continuity`
   - adjacent-tick composition changes do not read as arbitrary jumps

The package SHALL include:
1. automated checks for measurable parts of the contract
2. an explicit manual acceptance checklist for the final visual result

---

## 5. Validation Gates (Pass/Fail)

1. Gate OSGC-1: primary composition mode exists
   - a dedicated accepted observer-sky god-view composition is wired and distinct from the generic campus third-person view.
2. Gate OSGC-2: screen-space spread
   - default `Synthetic Orbit` no longer renders the visible set as a center-top cluster in the primary accepted view.
3. Gate OSGC-3: pass readability
   - in the primary accepted view, satellites can be distinguished as rising / higher-pass / exiting rather than appearing as a rotating pack.
4. Gate OSGC-4: continuity readability
   - adjacent ticks do not visually read as arbitrary teleport/replacement jumps in the accepted view.
5. Gate OSGC-5: cross-mode consistency
   - `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE` all preserve the same visual semantics in the primary accepted view.
6. Gate OSGC-6: stage safety
   - `npm run validate:stage` passes with refreshed artifacts.

---

## 6. Delivery Breakdown

1. D1: align terminology and acceptance source of truth with `docs/zh-TW/07-observer-sky-visual-acceptance.md`.
2. D2: define the primary accepted god-view observer-sky composition contract and file ownership.
3. D3: implement composition/view-mode logic so the accepted view is distinct from the generic campus third-person framing.
4. D4: implement screen-space spread/readability checks and, if needed, composition-specific render placement adjustments that preserve physical semantics.
5. D5: add deterministic tests plus a documented manual acceptance checklist tied to the final visual contract.
6. D6: synchronize lifecycle docs only after the primary accepted view actually passes both automated and human acceptance.

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. research-first semantics over decorative scene motion.
4. no hidden KPI-impacting constants.
5. meaningful module splitting by responsibility boundary.
6. deterministic validation and stage-gate freshness requirements.
7. no external black-box simulator dependency.

---

## 8. Lifecycle Note

1. `beamHO-bench-observer-sky-view-sdd.md` remains closure-tracked for ownership split and visibility-zone semantics.
2. `beamHO-bench-observer-sky-visual-correction-sdd.md` remains closure-tracked for broader physical pool, display/candidate separation, and continuity policy.
3. This package reopens frontend work specifically for primary-view composition and final visual acceptance.
4. Implementation status SHALL treat this file as the active pending truth until completion evidence exists.
