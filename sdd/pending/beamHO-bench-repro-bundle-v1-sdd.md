# beamHO-bench — Repro Bundle v1 SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Active Pending

---

## 1. Purpose

Define a paper-agnostic reproducibility bundle that packages canonical baseline outputs into one deterministic artifact set for audit, rerun, and appendix-ready sharing.

Bundle v1 targets common baseline reproducibility by composing:
1. cross-mode benchmark artifact (`case9-default`, `starlink-like`, `oneweb-like`).
2. baseline-parameter-envelope artifact (elevation/load/mobility tiers).
3. digest-linked manifest for one-command regeneration.

---

## 2. Scope Boundary

In scope:
1. deterministic `repro-bundle-v1` artifact schema and digest contract.
2. one-command export workflow for local/CI reproducibility package generation.
3. integration and validation contract checks for bundle determinism and coverage.
4. docs/status/index synchronization and closure lifecycle convergence.

Out of scope:
1. new handover baseline algorithms or policy runtime behaviors.
2. KPI formula changes or acceptance-threshold changes.
3. profile default rewrites for canonical profiles.
4. deferred runtime-scope activation (`RSMA`/soft-HO/multi-orbit/large-scale DRL).

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Bundle Composition Contract

1. bundle SHALL include cross-mode run artifact and baseline-envelope artifact.
2. bundle SHALL expose stable `tupleDigest` and `artifactDigest` fields.
3. bundle SHALL include canonical profile coverage metadata (`case9-default`, `starlink-like`, `oneweb-like`).

### 3.2 Deterministic Repro Contract

1. fixed tuple inputs SHALL regenerate identical bundle payload digests.
2. manifest digest SHALL be traceable to component digests.
3. case ordering and component ordering SHALL be deterministic.

### 3.3 Workflow & Validation Contract

1. repository SHALL provide one command to export reproducibility bundle artifacts.
2. integration tests SHALL validate deterministic regeneration and schema coherence.
3. validation-suite script SHALL include bundle contract guard.
4. `npm run test:sim`, `npm run validate:val-suite`, and final `npm run validate:stage` SHALL pass.

### 3.4 Constraint Preservation

1. keep LEO-only active scope and fixed NTPU default coordinate.
2. keep full-fidelity default benchmark path unchanged.
3. introduce no hidden KPI-impacting constants.
4. keep deferred-scope governance active.

---

## 4. Validation Gates (Pass/Fail)

1. Gate RB1-1: component coverage
2. bundle includes required canonical cross-mode and baseline-envelope components.
3. Gate RB1-2: deterministic digest contract
4. fixed tuple rerun yields identical tuple/artifact digests.
5. Gate RB1-3: workflow validity
6. one-command export writes expected bundle files and coherent digest links.
7. Gate RB1-4: stage safety
8. `validate:stage` remains green with refreshed artifacts.

---

## 5. Delivery Breakdown

1. D1: implement `repro-bundle-v1` artifact module and export script.
2. D2: add integration tests and registry wiring for deterministic coverage.
3. D3: extend validation-suite contract guard for repro bundle.
4. D4: sync docs/status/index workflow references.
5. D5: closure report and lifecycle convergence.

---

## 6. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode support (`paper-baseline` + `real-trace`).
3. full-fidelity default benchmark path.
4. no hidden KPI-impacting constants.
5. deterministic artifact generation and stage-gate enforceability.
6. deferred-scope governance remains active.

---

## 7. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Evidence |
|---|---|---|
| D1 repro bundle module + export script | Implemented | `src/sim/bench/repro-bundle-v1.ts`, `scripts/run-repro-bundle-v1.mjs`, `package.json` (`bundle:repro-v1`) |
| D2 deterministic/coverage integration tests | Pending | - |
| D3 validation-suite contract guard | Pending | - |
| D4 docs/status/index sync | Pending | - |
| D5 closure and lifecycle convergence | Pending | - |
