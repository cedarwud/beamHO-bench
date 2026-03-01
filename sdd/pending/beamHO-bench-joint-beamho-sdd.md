# beamHO-bench — Joint Beam Hopping + HO SDD (Pending)

**Version:** 0.2.0  
**Date:** 2026-03-01  
**Status:** Pending / Implementation-ready spec

---

## 1. Goal and Scope

Model beam hopping and handover as a coupled optimization problem under the existing LEO simulation framework.

Scope boundary:
1. LEO-only.
2. This work extends resource scheduling and decision coupling, not core orbital class abstraction.
3. Full-fidelity baseline path must remain available as control group.

---

## 2. Normative Requirements (MUST/SHALL)

1. The system SHALL provide a beam scheduler service with explicit time windows and per-beam resource state.
2. The HO decision path SHALL consume scheduler state in coupled mode.
3. The system SHALL support `uncoupled` and `coupled` modes under identical scenario/profile/seed for A/B studies.
4. Coupled mode SHALL enforce capacity, overlap, and fairness constraints before HO execution.
5. Scheduler decisions SHALL be deterministic under fixed seed and fixed configuration.
6. Scheduler and HO decisions SHALL be exported as auditable event streams.
7. KPI output SHALL include coupled-mode metrics without breaking existing v1 KPI schema compatibility.
8. The implementation SHALL remain compatible with both `paper-baseline` and `real-trace` modes.
9. The implementation SHALL not alter NTPU default coordinate settings in this phase.
10. KPI-impacting scheduler constants SHALL be profile-sourced or mapped to `ASSUME-*` with rationale.
11. Key coupled-decision modules SHALL include stable `sourceId` provenance comments.
12. Public-repo copyright policy SHALL remain intact (`.gitignore` + repo policy checks).

---

## 3. Planned Components

1. Beam Scheduler Service
2. inputs: active satellites/beams, demand summary, policy parameters
3. outputs: beam on/off state, frequency assignment, power profile
4. Coupled HO Evaluator
5. reads scheduler snapshot and candidate link quality
6. returns serving/prepare/dual-link decisions with constraint-aware scoring
7. Conflict Resolver
8. deterministic tie-breaking for capacity conflict and overlapping candidate conflicts
9. fairness guard based on configured Jain target or equivalent normalized index

---

## 4. Data Contracts (Planned)

1. `BeamScheduleState`
2. fields: `tick`, `satId`, `beamId`, `isActive`, `freqBlockId`, `powerClass`, `windowId`
3. `CoupledDecisionInput`
4. fields: `ueId`, current state machine status, candidate list, scheduler availability summary
5. `CoupledDecisionOutput`
6. fields: decision type, target IDs, constraint flags, resolver reason code

All fields that affect KPI SHALL carry source trace IDs or documented `ASSUME-*` references.

---

## 5. Metrics and Reporting

1. Existing metrics retained: throughput, handover rate, HOF, RLF, interruption.
2. New coupled metrics:
3. scheduler utilization ratio
4. blocked-by-schedule handover count
5. fairness index over scheduler allocation
6. scheduler-induced interruption time
7. Reports SHALL support `uncoupled` vs `coupled` comparison with same seed/profile.

---

## 6. Validation Gates (Pass/Fail)

1. Gate JBH-1: mode parity
2. `uncoupled` mode must match pre-existing baseline behavior within deterministic rule.
3. Gate JBH-2: deterministic replay
4. `coupled` mode outputs are identical for repeated run with same seed/config.
5. Gate JBH-3: sensitivity trend
6. hopping period and overlap sweep shows consistent trend policy in validation suite.
7. Gate JBH-4: artifact completeness
8. output includes schedule state summary and coupled decision counters.
9. Gate JBH-5: regression safety
10. stage gate remains green with coupled feature toggled off.
11. Gate JBH-6: dual-mode compatibility
12. coupled feature passes smoke checks in both `paper-baseline` and `real-trace`.
13. Gate JBH-7: constraints compliance
14. required CI artifacts remain generated and repo policy checks remain green.

---

## 7. Delivery Breakdown

1. D1: scheduler state model + deterministic window engine
2. D2: coupled evaluator and conflict resolver integration
3. D3: KPI/report extensions and source-trace hooks
4. D4: validation-suite scenarios (`uncoupled` vs `coupled`, sweep tests)
