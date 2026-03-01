# beamHO-bench — SDD Implementation Status

**Date:** 2026-03-01  
**Status:** M0-M4 Core Scope Complete (v1 baseline)  

---

## 1. Scope Statement

This status document records whether the v1 SDD scope is implemented and continuously verifiable.

v1-complete means:
1. M0-M4 core requirements are implemented in code.
2. Stage gate validation is green (`validate:stage`).
3. Artifacts required by SDD/requirements/validation matrix are generated.

Deferred items remain out of v1 scope:
1. Layer-D RL policy plugins as first-class runtime modules.
2. Beam hopping + HO joint optimization.
3. Multi-orbit unified scheduler (LEO/MEO/GEO), reserved for long-term backlog and out of current LEO-only scope.

---

## 2. Milestone Completion

| Milestone | Status | Evidence |
|---|---|---|
| M0 | Complete | Static Case9 scene + deterministic UE placement + profile loader |
| M1 | Complete | Case9 analytic orbit + az/el/range + `max-rsrp` baseline |
| M2 | Complete | A3/A4 + State1/2/3 + KPI export + runtime parameter audit |
| M3 | Complete | CHO/MC-HO full-fidelity default + batch comparison |
| M4 | Complete | real-trace (`starlink-like`, `oneweb-like`) + SGP4/Kepler fallback + real-trace multi-baseline smoke |

---

## 3. CI/Local Gate Evidence

Mandatory command:
1. `npm run validate:stage`

This gate includes:
1. `npm run lint`
2. `npm run build`
3. `npm run test:sim`
4. `npm run validate:rigor`
5. `npm run validate:structure`
6. `npm run validate:repo-policy`
7. `npm run validate:val-suite`

Required artifacts:
1. `dist/sim-test-summary.json`
2. `dist/validation-suite.json`
3. `dist/validation-suite.csv`
4. `dist/validation-gate-summary.json`
5. `dist/runtime-parameter-audit-summary.json`

---

## 4. Verification Snapshot (Latest)

Latest local verification (2026-03-01):
1. `validate:stage` passed.
2. `test:sim`: 12/12 passed (unit 5/5, integration 7/7).
3. `validate:val-suite`: 17/17 passed, warnings=0.
4. Validation artifacts are compact and generated under `dist/`.

---

## 5. Traceability Cross-Reference

Primary references:
1. `sdd/completed/beamHO-bench-sdd.md`
2. `sdd/completed/beamHO-bench-requirements.md`
3. `sdd/completed/beamHO-bench-validation-matrix.md`
4. `sdd/completed/beamHO-bench-paper-traceability.md`

Code points added for M4 closure evidence:
1. `src/sim/tests/integration-cases.ts` (real-trace multi-baseline, dual-mode source-trace, manifest `tle_snapshot_utc`)
2. `src/sim/bench/validation-definitions.ts` (real-trace multi-baseline validation groups)
