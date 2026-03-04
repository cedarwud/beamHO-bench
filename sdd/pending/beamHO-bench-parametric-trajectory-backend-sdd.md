# beamHO-bench — Parametric Trajectory Backend SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-04  
**Status:** Active Pending / Backend Implemented (Frontend GLB Coupling Pending)

---

## 1. Purpose

Define a paper-anchored parametric trajectory backend for `paper-baseline` mode so orbit movement can be configured by discrete research tiers rather than fixed legacy linear drift.

This package explicitly separates:
1. backend kinematics + parameter governance (implemented in current phase)
2. frontend GLB movement coupling and visualization controls (next phase)

---

## 2. Scope Boundary

In scope (current phase):
1. add synthetic trajectory backend module for paper-baseline scenario.
2. expose trajectory-relevant research parameters with paper-tier discrete options.
3. add parameter consistency coupling across trajectory and existing constellation controls.
4. provide deterministic integration tests and stage-gate validation evidence.

Out of scope (deferred to next phase):
1. direct GLB motion binding and timeline UI visualization for new trajectory states.
2. multi-orbit (`LEO/MEO/GEO`) unified runtime path.
3. RSMA/soft-HO runtime activation.
4. external simulator dependency (STK/ns-3/MATLAB mandatory coupling).

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Trajectory Backend Contract

1. Paper-baseline synthetic mode SHALL support `linear-drift` and `walker-circular`.
2. `walker-circular` SHALL be deterministic for fixed tuple (`profile + selection + seed`).
3. Parametric orbit state SHALL produce satellite position/azimuth/elevation/range fields through existing `SimSnapshot` contracts.

### 3.2 Research Parameter Discretization

1. Trajectory controls SHALL use bounded discrete values anchored to paper/common tiers:
2. `constellation.syntheticTrajectoryModel`: `linear-drift`, `walker-circular`.
3. `constellation.inclinationDeg`: `53`, `87.9`, `90`.
4. `constellation.orbitalPlanes`: `1`, `18`, `24`.
5. `constellation.satellitesPerPlane`: `7`, `40`, `66`.
6. Existing controls (`altitudeKm`, `activeSatellitesInWindow`) SHALL remain compatible.

### 3.3 Cross-Parameter Coupling

1. Active-window capacity SHALL be clamped by effective constellation capacity (`orbitalPlanes * satellitesPerPlane`) in consistency layer.
2. Altitude-derived speed/footprint coupling SHALL remain active for paper-baseline path.
3. Hidden walker-only controls SHALL not leak into linear-drift runtime override path.

### 3.4 Traceability and Assumption Governance

1. New trajectory assumptions SHALL be registered in source catalog (`ASSUME-*`).
2. Profile/source-map traceability SHALL include new KPI-impacting trajectory fields.
3. Export assumptions text SHALL identify the active synthetic trajectory model in paper-baseline mode.

---

## 4. Validation Gates (Pass/Fail)

1. Gate PTB-1: backend determinism
2. same tuple yields same walker-circular kinematic signature.
3. Gate PTB-2: trajectory control visibility governance
4. walker-only controls are hidden in linear mode and shown in walker mode.
5. Gate PTB-3: consistency coupling enforcement
6. active-window clamp and legacy consistency guards remain deterministic.
7. Gate PTB-4: stage safety
8. `npm run validate:stage` passes.

---

## 5. Delivery Breakdown

1. D1: profile/schema/source-catalog contract extension for synthetic trajectory mode.
2. D2: scenario backend implementation (`walker-circular` synthetic orbit path).
3. D3: research parameter catalog/discrete tiers + consistency coupling updates.
4. D4: integration tests and stage-gate verification.
5. D5: frontend GLB movement coupling and visualization pipeline (pending).

---

## 6. Implementation Progress Backfill

As of 2026-03-04:

| Delivery | Status | Evidence |
|---|---|---|
| D1 profile/schema/source contract extension | Implemented | `src/config/paper-profiles/types.ts`, `paper-profile.schema.json`, `case9-default.json`, `case9-default.sources.json`, `paper-sources.json` |
| D2 synthetic trajectory backend | Implemented | `src/sim/scenarios/common/synthetic-orbit.ts`, `src/sim/scenarios/case9-analytic.ts` |
| D3 research parameter tiers + coupling | Implemented | `src/config/research-parameters/types.ts`, `catalog.ts`, `consistency.ts` |
| D4 tests and gate verification | Implemented | `src/sim/tests/integration-cases-research-parameters.ts`, `integration-cases-trajectory-parameters.ts`, `npm run validate:stage` pass |
| D5 frontend GLB movement coupling | Pending | next phase (bind trajectory state to satellite GLB render path) |

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. real-trace Starlink/OneWeb TLE workflow unchanged.
4. full-fidelity default research path preserved.
5. no hidden KPI-impacting constants outside profile/assumption governance.
6. deterministic run outputs and traceable source/assumption mapping.

