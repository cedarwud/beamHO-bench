# beamHO-bench — Joint Beam Hopping + HO Closure Report

**Version:** 1.0.0  
**Date:** 2026-03-01  
**Status:** Completed (V2-B JBH-1 ~ JBH-7)

---

## 1. Purpose

This report records closure evidence for:
1. `sdd/pending/beamHO-bench-joint-beamho-sdd.md`

---

## 2. Scope and Constraint Compliance

1. Scheduler/HO coupling implemented in LEO-only scope.
2. `uncoupled` and `coupled` modes co-exist for A/B reproducibility.
3. Paper-baseline and real-trace both supported in coupled-path validations.
4. NTPU default coordinate remains unchanged.
5. KPI-impacting scheduler constants remain profile-sourced or `ASSUME-*` traceable.

---

## 3. Gate Coverage (JBH-1 ~ JBH-7)

| Gate | Status | Evidence |
|---|---|---|
| JBH-1 mode parity | PASS | `VAL-JBH-UNCOUPLED-PARITY`, integration `scheduler uncoupled mode preserves baseline parity` |
| JBH-2 deterministic replay | PASS | `VAL-JBH-COUPLED-DETERMINISM`, integration `scheduler coupled mode is deterministic...` |
| JBH-3 sensitivity trend | PASS | `VAL-JBH-HOPPING-PERIOD-SWEEP`, `VAL-JBH-OVERLAP-SWEEP` with trend checks |
| JBH-4 artifact completeness | PASS | scheduler summary + coupled decision counters in manifest/source-trace and integration checks |
| JBH-5 regression safety | PASS | stage gate remains green with `uncoupled` path and policy-off parity cases |
| JBH-6 dual-mode compatibility | PASS | `VAL-JBH-REALTRACE-COUPLED-SMOKE` + paper-baseline JBH cases pass |
| JBH-7 constraints compliance | PASS | repo-policy and required CI artifacts remain green/present |

---

## 4. Implementation Mapping

1. Scheduler window engine:
2. `src/sim/scheduler/window-engine.ts`
3. Coupled conflict resolver and stats:
4. `src/sim/scheduler/coupled-resolver.ts`
5. Scheduler/coupled types:
6. `src/sim/scheduler/types.ts`
7. Coupled metadata and artifacts:
8. `src/sim/kpi/reporter.ts`
9. `src/sim/reporting/source-trace.ts`
10. `src/sim/reporting/manifest.ts`
11. Validation definitions:
12. `src/sim/bench/validation-definitions.ts` (`VAL-JBH-*`)

---

## 5. Verification Snapshot

Latest local verification (2026-03-01):
1. `npm run validate:stage` passed.
2. JBH-related validation groups in suite:
3. `VAL-JBH-UNCOUPLED-PARITY`
4. `VAL-JBH-COUPLED-DETERMINISM`
5. `VAL-JBH-REALTRACE-COUPLED-SMOKE`
6. `VAL-JBH-CAPACITY-GUARD-SMOKE`
7. `VAL-JBH-HOPPING-PERIOD-SWEEP`
8. `VAL-JBH-OVERLAP-SWEEP`
9. Required CI artifacts present:
10. `dist/sim-test-summary.json`
11. `dist/validation-suite.json`
12. `dist/validation-gate-summary.json`

---

## 6. References

1. `sdd/completed/beamHO-bench-implementation-status.md`
2. `sdd/completed/beamHO-bench-validation-matrix.md`
3. `sdd/pending/beamHO-bench-joint-beamho-sdd.md`
