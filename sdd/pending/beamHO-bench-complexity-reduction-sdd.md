# beamHO-bench — Complexity Reduction & Maintainability SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Active Pending

---

## 1. Purpose

Define a bounded refactor package to reduce project complexity without changing simulation behavior, KPI semantics, or benchmark conclusions.

Primary goals:
1. reduce comprehension cost for developers.
2. keep all existing research outputs reproducible.
3. preserve stage-gate safety while improving maintainability.

---

## 2. Scope Boundary

In scope:
1. structural refactor and module responsibility cleanup.
2. test-suite entry decomposition and readability improvements.
3. SDD/status/document synchronization cleanup for single-source status reading.
4. validation/run workflow ergonomics that do not alter benchmark logic.

Out of scope:
1. new handover algorithms or policy logic.
2. new KPI definitions, formula changes, or acceptance-threshold changes.
3. profile default changes (`case9-default`, `starlink-like`, `oneweb-like`).
4. new runtime scope activation (`RSMA`/soft-HO/multi-orbit/large-scale DRL).

Hard rule:
1. behavior must remain equivalent for fixed tuple (`profile + seed + overrides + baseline`).

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Behavior Preservation

1. Refactor changes SHALL NOT alter simulation outputs intentionally.
2. Existing validation IDs SHALL remain stable unless explicitly versioned in same change set.
3. Any accidental output drift detected by validation gates SHALL block merge.

### 3.2 Structural Maintainability

1. Files above warning threshold (`>500` lines) SHALL be split by responsibility where practical.
2. Split strategy SHALL be semantic (e.g., registry/helpers/group modules), not mechanical line splitting.
3. Refactor SHALL avoid circular dependency introduction.

### 3.3 Verification Contract

Each delivery step SHALL provide:
1. `npm run test:sim` pass.
2. `npm run validate:val-suite` pass.
3. `npm run validate:stage` pass before package closure.
4. refreshed artifacts in `dist/` as required by `PROJECT_CONSTRAINTS.md`.

### 3.4 Documentation/Status Hygiene

1. Active pending status SHALL be reflected in `sdd/README.md`, `sdd/pending/README.md`, and implementation status.
2. Closure SHALL include one completed closure report linked back to this pending SDD.
3. Deprecated or duplicate status text SHALL be removed when consolidation is complete.

---

## 4. Validation Gates (Pass/Fail)

1. Gate CR-1: behavioral parity
2. deterministic replay/integration checks remain green after each refactor step.
3. Gate CR-2: structure improvement
4. targeted oversized/overloaded modules are split with clearer boundaries.
5. Gate CR-3: governance parity
6. all policy/rigor/repo gates remain green.
7. Gate CR-4: docs consistency
8. pending/completed/status indexes remain synchronized.

---

## 5. Delivery Breakdown

1. D1: decompose `src/sim/tests/integration-cases.ts` into clearer registry/assembly modules.
2. D2: reduce validation-definition coupling complexity while preserving ID stability and gate checks.
3. D3: introduce explicit day-to-day vs milestone validation command guidance (without weakening hard stage gate).
4. D4: remove stale/duplicated SDD status statements; keep one authoritative implementation status flow.
5. D5: finalize closure report with parity evidence and architecture review note.

---

## 6. Initial Risk Assessment

1. Risk: refactor drift in validation ordering or registration.
2. Mitigation: deterministic integration checks and suite-level ID coverage checks.
3. Risk: accidental script behavior changes.
4. Mitigation: keep command names stable; only additive ergonomics allowed.
5. Risk: documentation drift after structural changes.
6. Mitigation: same-change-set updates for `sdd/README`, pending index, and implementation status.

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode support (`paper-baseline`, `real-trace`).
3. full-fidelity default path for benchmark-claim workflows.
4. no hidden KPI-impacting constants introduced by refactor.
5. stage-gate enforceability and artifact freshness requirements.
6. deferred-scope governance remains active (`RSMA`/soft-HO/multi-orbit/large-scale DRL inactive).

---

## 8. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Evidence |
|---|---|---|
| D1 decompose integration test entry assembly | Implemented | extracted real-trace artifact trio into `src/sim/tests/integration-cases-real-trace-artifacts.ts`, and slimmed `src/sim/tests/integration-cases.ts` to registry assembly (`368` lines) |
| D2 validation-definition coupling simplification | Pending | - |
| D3 day-to-day vs milestone validation workflow guidance | Pending | - |
| D4 SDD/status consolidation cleanup | Pending | - |
| D5 closure + architecture review note | Pending | - |
