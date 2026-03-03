# beamHO-bench — Cross-Mode Reproducible Benchmark Pack SDD (Closure-Tracked Pending)

**Version:** 0.1.0  
**Date:** 2026-03-03  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Define a paper-agnostic, reproducible benchmark pack that evaluates the same baseline set across:
1. `paper-baseline` mode (`case9-default`)
2. `real-trace` mode (`starlink-like`)
3. `real-trace` mode (`oneweb-like`)

The package target is comparability and replayability, not new algorithm invention.

---

## 2. Scope Boundary

In scope:
1. cross-mode benchmark tuple/matrix contract.
2. deterministic plan/build/run artifact generation.
3. replay-ready seed-set governance across all three canonical profiles.
4. validation and integration checks for cross-mode plan completeness.

Out of scope:
1. new handover baseline algorithms.
2. KPI formula or acceptance-threshold changes.
3. profile default parameter rewrites.
4. deferred runtime scope activation (`RSMA`/soft-HO/multi-orbit/large-scale DRL).

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Canonical Cross-Mode Coverage

1. Pack SHALL include all canonical profiles:
2. `case9-default`
3. `starlink-like`
4. `oneweb-like`
5. Each matrix case SHALL publish stable `matrixCaseId` and tuple digest fields.

### 3.2 Deterministic Tuple Contract

1. Fixed tuple inputs (`profile + scenarioId + seedSet + baselines + tickCount + overrides`) SHALL produce identical plan/run artifacts.
2. Per-case tuple metadata SHALL be traceable in output artifacts for audit/replay.
3. Case ordering SHALL be stable and deterministic.

### 3.3 Reproducible Execution Pack

1. Execution pack SHALL support configurable seed sets and baseline sets.
2. Same seed set SHALL apply uniformly across all cross-mode cases unless explicitly overridden.
3. Artifact schema SHALL include per-case benchmark results with source tuple linkage.

### 3.4 Validation & Governance

1. `npm run test:sim` and `npm run validate:val-suite` SHALL remain green after each delivery.
2. `npm run validate:stage` SHALL pass before closure.
3. No existing validation IDs SHALL be broken or renamed without synchronized matrix update.

---

## 4. Validation Gates (Pass/Fail)

1. Gate CMR-1: canonical profile coverage
2. pack includes `case9-default`, `starlink-like`, `oneweb-like`.
3. Gate CMR-2: deterministic plan/run
4. same tuple re-run yields identical benchmark artifact.
5. Gate CMR-3: tuple integrity
6. `matrixCaseId`, `profileId`, `mode`, `seedSet`, and tuple digest are present and coherent.
7. Gate CMR-4: stage safety
8. full stage gate remains green.

---

## 5. Delivery Breakdown

1. D1: implement cross-mode benchmark plan/run artifact module.
2. D2: add integration tests for deterministic plan/run and canonical-profile coverage.
3. D3: introduce validation-suite entry or consistency checks for cross-mode benchmark pack usage contract.
4. D4: sync docs/status/index references and benchmark workflow guidance.
5. D5: closure report with architecture and parity evidence.

---

## 6. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode support (`paper-baseline` + `real-trace`) with canonical profiles intact.
3. full-fidelity benchmark defaults remain unchanged.
4. no hidden KPI-impacting constants.
5. reproducible artifacts and stage-gate enforceability.
6. deferred-scope governance remains active.

---

## 7. Implementation Progress Backfill

As of 2026-03-03:

| Delivery | Status | Evidence |
|---|---|---|
| D1 cross-mode benchmark plan/run module | Implemented | `src/sim/bench/cross-mode-benchmark.ts` |
| D2 deterministic/coverage integration tests | Implemented | `src/sim/tests/integration-cases-cross-mode-benchmark.ts`, integration registry wiring |
| D3 validation-suite contract extension | Implemented | `scripts/validate-validation-suite.mjs` now executes cross-mode benchmark contract checks (determinism, canonical profile coverage, unique case IDs, tuple digest sanity) |
| D4 docs/status/index sync for benchmark workflow | Implemented | `scripts/run-cross-mode-benchmark.mjs`, `package.json` (`bench:cross-mode`), `README.md`, `docs/zh-TW/04-testing-and-validation.md`, implementation-status sync |
| D5 closure report and lifecycle convergence | Implemented | `sdd/completed/beamHO-bench-cross-mode-reproducible-benchmark-closure.md`, pending/completed index and implementation-status lifecycle sync |

---

## 8. Closure Reference

1. `sdd/completed/beamHO-bench-cross-mode-reproducible-benchmark-closure.md`
