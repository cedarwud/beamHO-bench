# beamHO-bench — Baseline Parameter Envelope SDD (Closure-Tracked Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Define a paper-agnostic baseline parameter envelope pack for the common initial environment, so new algorithms are always compared under the same auditable parameter tiers.

The package focuses on environment completeness and reproducibility, not new handover policy invention.

---

## 2. Scope Boundary

In scope:
1. canonical parameter-envelope definition for baseline sensitivity tiers.
2. deterministic validation-suite coverage for envelope tiers.
3. benchmark workflow linkage for envelope metadata/export visibility.
4. docs/status/index synchronization for active-pending lifecycle.

Out of scope:
1. new handover algorithms (`RSMA`/soft-HO/new RL policy runtime paths).
2. KPI formula changes or acceptance-threshold rewrites.
3. multi-orbit runtime expansion (`LEO+MEO+GEO`).
4. paper-specific custom branches that break common baseline comparability.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Canonical Envelope Coverage

The envelope SHALL include at least these baseline axes:
1. minimum elevation threshold tiers (`10/20/35 deg`).
2. UE load tiers (`50/100` minimum, with optional stress extension kept bounded).
3. UE mobility tiers (`0/3/30/60 km/h`) aligned with existing scenario taxonomy.
4. dual-mode profile compatibility (`paper-baseline`, `real-trace`) via canonical profiles.

### 3.2 Deterministic Contract

1. fixed tuple inputs SHALL yield identical envelope artifact digests.
2. case IDs and tuple digests SHALL be stable and non-empty.
3. case ordering SHALL be deterministic and auditable.

### 3.3 Validation/Governance Contract

1. new envelope validation IDs SHALL be declared in validation definitions with no ID collision.
2. `npm run test:sim` and `npm run validate:val-suite` SHALL remain green at each step.
3. `npm run validate:stage` SHALL pass before closure.
4. matrix/document consistency checks SHALL remain intact.

### 3.4 Constraint Preservation

1. active scope SHALL remain `LEO-only`.
2. full-fidelity benchmark defaults SHALL remain unchanged.
3. no hidden KPI-impacting constants SHALL be introduced.
4. deferred scope governance (`RSMA`/soft-HO/multi-orbit/large-scale DRL) SHALL remain active.

---

## 4. Validation Gates (Pass/Fail)

1. Gate BPE-1: envelope coverage
2. required tier axes are present and machine-checkable.
3. Gate BPE-2: deterministic artifact contract
4. repeated runs with fixed tuple produce identical digests.
5. Gate BPE-3: validation-suite compatibility
6. new envelope validation IDs are resolvable and pass gate checks.
7. Gate BPE-4: stage safety
8. full `validate:stage` remains green with refreshed artifacts.

---

## 5. Delivery Breakdown

1. D1: implement baseline envelope definition module and artifact schema.
2. D2: add integration tests for determinism and tier coverage.
3. D3: add validation-suite definitions/checks for envelope pack.
4. D4: sync workflow/docs/status/index references.
5. D5: closure report and lifecycle convergence.

---

## 6. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode support (`paper-baseline` + `real-trace`).
3. full-fidelity default path for benchmark-claim workflows.
4. no hidden KPI-impacting constants.
5. reproducible artifacts and stage-gate enforceability.
6. deferred-scope governance remains active.

---

## 7. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Evidence |
|---|---|---|
| D1 baseline envelope definition module | Implemented | `src/sim/bench/baseline-parameter-envelope.ts` |
| D2 deterministic/coverage integration tests | Implemented | `src/sim/tests/integration-cases-baseline-parameter-envelope.ts`, integration registry wiring |
| D3 validation-suite envelope contract | Implemented | `src/sim/bench/baseline-parameter-envelope-pack.ts`, `src/sim/bench/validation-definitions.ts`, `scripts/validate-validation-suite.mjs`, `sdd/completed/beamHO-bench-validation-matrix.md` |
| D4 docs/status/index sync | Implemented | `README.md`, `docs/zh-TW/04-testing-and-validation.md`, `sdd/README.md`, `sdd/pending/README.md`, implementation-status sync |
| D5 closure and lifecycle convergence | Implemented | `sdd/completed/beamHO-bench-baseline-parameter-envelope-closure.md`, pending/completed index and implementation-status lifecycle sync |

---

## 8. Closure Reference

1. `sdd/completed/beamHO-bench-baseline-parameter-envelope-closure.md`
