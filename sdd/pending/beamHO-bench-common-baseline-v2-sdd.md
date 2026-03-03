# beamHO-bench — Common Baseline v2 Validation Pack SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Active Pending (D1~D3 implemented, D4 pending closure sync)

---

## 1. Purpose

Define a bounded, paper-agnostic validation pack to strengthen the common baseline environment without introducing paper-specific runtime branches.

The package focuses on four reproducible validation dimensions:
1. propagation realism tiers.
2. protocol/RLF timing sensitivity tiers.
3. CHO/MC geometry-time parameter tiers.
4. stress-load tiers.

---

## 2. Scope Boundary

1. This package adds validation-suite definitions and related guardrails only.
2. No new baseline algorithm is introduced.
3. No RSMA/soft-HO/multi-orbit runtime path is introduced.
4. No large-scale DRL training/runtime stack is introduced.
5. Existing canonical profile IDs remain unchanged.
6. Cases remain CI/stage-bounded (`tickCount <= 180`).

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Validation Group Coverage

System SHALL define these validation IDs:
1. `VAL-CB2-PROPAGATION-REALISM-SWEEP` (4 cases)
2. `VAL-CB2-PROTOCOL-RLF-TIMING-SWEEP` (3 cases)
3. `VAL-CB2-CHO-MC-GEOMETRY-SWEEP` (3 cases)
4. `VAL-CB2-STRESS-LOAD-SWEEP` (3 cases)

### 3.2 Determinism and Boundedness

1. Validation pack generation SHALL be deterministic for fixed source and runtime tuple.
2. Every case SHALL have non-empty baseline set.
3. Every case SHALL satisfy `tickCount <= 180`.

### 3.3 Definition/Document Consistency

1. Required IDs in `sdd/completed/beamHO-bench-validation-matrix.md` section 5 SHALL align with validation definitions.
2. Consistency check SHALL remain enforced by `scripts/validate-validation-suite.mjs`.
3. Enforcement SHALL support modularized definition sources under `src/sim/bench`.

### 3.4 Validation Safety

1. `npm run test:sim` SHALL pass with new integration coverage.
2. `npm run validate:val-suite` SHALL pass with all required IDs resolvable.
3. `npm run validate:stage` SHALL remain green.

---

## 4. Validation Gates (Pass/Fail)

1. Gate CB2-1: all four `VAL-CB2-*` groups are present with expected case counts.
2. Gate CB2-2: integration test confirms deterministic and bounded pack generation.
3. Gate CB2-3: matrix-definition alignment check passes under modularized source scan.
4. Gate CB2-4: stage gate remains green with refreshed artifacts.

---

## 5. Delivery Breakdown

1. D1: implement `common-baseline-pack` validation definition module.
2. D2: wire definitions into validation suite and integration case registry.
3. D3: sync validation matrix IDs and update validation-alignment guard for modular definitions.
4. D4: closure sync (pending/completed/readme/status backfill and final closure report).

---

## 6. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Commit | Evidence |
|---|---|---|---|
| D1 common baseline v2 definition pack | Implemented | `0fceba1` | `src/sim/bench/common-baseline-pack.ts` |
| D2 suite wiring + integration coverage | Implemented | `0fceba1` | `src/sim/bench/validation-definitions.ts`, `src/sim/tests/integration-cases-common-baseline-pack.ts`, `src/sim/tests/integration-cases.ts` |
| D3 matrix/alignment-gate sync | Implemented | `0fceba1` | `sdd/completed/beamHO-bench-validation-matrix.md`, `scripts/validate-validation-suite.mjs` |
| D4 closure/report synchronization | Pending | - | to be finalized after next milestone package decision |

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`) with no mode removal.
3. full-fidelity default research path.
4. no hidden KPI-impacting constants.
5. traceable, deterministic validation and artifact outputs.
6. no deferred-scope runtime activation (`RSMA`/soft-HO/multi-orbit/large-scale DRL).
7. stage-gate enforceability (`validate:stage`) and matrix-definition consistency checks.

