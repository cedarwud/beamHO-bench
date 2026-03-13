# beamHO-bench — Core/Extension Governance SDD (Closure-Tracked Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Reduce system-level complexity for paper-reproduction readiness by separating:
1. core validation scope (mandatory stage gate)
2. extension validation scope (opt-in/nightly research checks)

This package also closes two enforcement gaps in `PROJECT_CONSTRAINTS.md`:
1. stage artifact freshness enforcement.
2. runtime override source-map traceability enforcement.

---

## 2. Scope Boundary

In scope:
1. add `core/all` execution scope to validation-suite pipeline.
2. update stage gate to run core scope and enforce artifact freshness.
3. add automated source-map coverage checks for validation runtime overrides.
4. synchronize matrix/docs/status references.

Out of scope:
1. new baseline algorithm design.
2. RSMA/soft-HO runtime activation.
3. multi-orbit runtime activation.
4. large-scale DRL training/runtime introduction.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Validation Scope Governance

1. System SHALL support validation execution scopes: `core`, `all`.
2. `core` SHALL exclude extension groups (`VAL-RL-*`, `VAL-JBH-*`, `VAL-BG-*`).
3. `all` SHALL include both core and extension groups.
4. `validate:stage` SHALL run `core` scope only.

### 3.2 Matrix and Gate Consistency

1. Validation matrix SHALL split required IDs into `core` and `extension` subsections.
2. validation-suite alignment guard SHALL validate matrix-definition consistency per selected scope.

### 3.3 Artifact Freshness Enforcement

1. stage gate SHALL verify required artifacts exist and are freshly generated in current run.
2. freshness rule SHALL enforce `mtime > stage_start_time` for:
   - `dist/sim-test-summary.json`
   - `dist/validation-suite.json`
   - `dist/validation-gate-summary.json`

### 3.4 Runtime Override Source-Trace Governance

1. validation-suite gate SHALL validate that each runtime override leaf path resolves to source-map coverage.
2. coverage check SHALL accept exact-path mapping or ancestor-path mapping.
3. source catalog and profile source maps SHALL include any new `ASSUME-*` IDs introduced by coverage fixes.

---

## 4. Validation Gates (Pass/Fail)

1. Gate CEG-1: `validate:stage` runs core scope and passes.
2. Gate CEG-2: `validate:val-suite --scope all` remains green.
3. Gate CEG-3: artifact freshness enforcement fails on stale artifacts and passes on fresh run.
4. Gate CEG-4: runtime override source-map coverage check passes for selected scope.

---

## 5. Delivery Breakdown

1. D1: implement validation scope filtering (`core`/`all`) in bench + CLI + gate script.
2. D2: split matrix required IDs into core/extension and sync alignment checks.
3. D3: add stage gate artifact freshness enforcement script/workflow.
4. D4: add runtime override source-map coverage guard and required source-map/catalog updates.
5. D5: docs and SDD lifecycle closure synchronization.

---

## 6. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL preserve:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline`, `real-trace`).
3. full-fidelity default research path.
4. no hidden KPI-impacting constants.
5. deterministic and traceable artifacts.
6. deferred-scope governance remains active.
7. stage gate automation must include freshness and scope governance.

---

## 7. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Evidence |
|---|---|---|
| D1 scope filtering (`core`/`all`) | Implemented | `src/sim/bench/validation-scope.ts`, `src/sim/bench/validation-suite.ts`, `src/sim/bench/cli-validation-suite.ts` |
| D2 matrix/definition alignment with scope | Implemented | `sdd/completed/beamHO-bench-validation-matrix.md`, `scripts/validate-validation-suite.mjs` |
| D3 stage artifact freshness enforcement | Implemented | `scripts/validate-stage-gate.mjs`, `package.json` (`validate:stage`) |
| D4 runtime override source-map coverage guard | Implemented | `scripts/validate-validation-suite.mjs`, `src/config/references/paper-sources.json`, `src/config/paper-profiles/*.sources.json` |
| D5 docs + lifecycle closure sync | Implemented | closure report + pending/completed/status sync |

---

## 8. Closure Reference

1. `sdd/completed/beamHO-bench-core-extension-governance-closure.md`
