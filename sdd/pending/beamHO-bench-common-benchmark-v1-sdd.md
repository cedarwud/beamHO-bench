# beamHO-bench — Common Benchmark Environment v1 SDD (Closure-Tracked Pending)

**Version:** 0.2.0  
**Date:** 2026-03-03  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Define the next active roadmap package to evolve current deterministic single-run validation into a paper-ready, general-purpose benchmark environment for LEO multi-beam handover research.

This SDD is explicitly common-benchmark oriented (not paper-specific runtime customization).

Target gaps:
1. multi-seed statistical benchmarking.
2. standardized scenario matrix templates for reproducible cross-algorithm comparison.
3. channel realism increment via temporal correlation and Doppler-aware small-scale options.
4. paper-ready reporting artifacts (CDF/boxplot-ready raw data, cross-seed ranking stability, significance summary).
5. research-facing UI workflow (deterministic replay + HO timeline + state-aware failure overlays).

---

## 2. Scope Boundary

1. Active scope remains LEO-only.
2. No multi-orbit (`LEO/MEO/GEO`) runtime path is introduced.
3. No `RSMA`/soft-HO runtime path is introduced.
4. No end-to-end large-scale DRL training stack is introduced.
5. Existing canonical profile IDs remain unchanged (`case9-default`, `starlink-like`, `oneweb-like`).
6. New capabilities must be profile/seed-driven and reproducible under stage-gated validation.
7. Research default remains `full fidelity`; any `simplified` path MUST be explicit non-default engineering mode.
8. `NTPU` default coordinate remains fixed in this package.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Multi-Seed Statistical Benchmarking

1. Benchmark execution SHALL support deterministic seed sets (`seed list` or equivalent explicit range expansion).
2. Statistical output SHALL include at least `mean`, `std`, and `95% CI` per KPI for each baseline.
3. Pairwise baseline comparison SHALL include at least one effect-size metric.
4. Same tuple (`profile + overrides + seed-set + tick + baseline set`) SHALL produce identical statistical artifacts.

### 3.2 Standardized Scenario Matrix v1

1. System SHALL provide a reusable matrix template over common axes:
   - orbit mode (`paper-baseline`, `real-trace`)
   - beam count
   - overlap ratio
   - UE speed group
   - frequency reuse mode
   - small-scale model
2. Each matrix case SHALL have stable case identity (`matrix_case_id`) and reproducible tuple metadata.
3. Core matrix profile SHALL remain computationally bounded for CI/stage usage; extended matrix can be optional.

### 3.3 Channel Realism Increment (General)

1. Small-scale model path SHALL support optional temporal-correlation control.
2. Small-scale model path SHALL support optional Doppler-aware control.
3. When realism options are disabled, behavior SHALL preserve current baseline-compatible outputs.
4. All KPI-impacting channel parameters SHALL be profile-sourced or `ASSUME-*` traced (no hidden constants).

### 3.4 Paper-Ready Reporting

1. Export SHALL include CDF/boxplot-ready raw metric artifacts for reproducible plotting.
2. Export SHALL include cross-seed baseline ranking stability summary.
3. Export SHALL include cross-seed significance summary metadata for key KPI deltas.
4. Artifact schema SHALL include tuple trace fields (`profile_id`, `matrix_case_id`, `seed_set`, `tick_count`, `baseline`).

### 3.5 Research UI Workflow (Omni-Scope-Oriented)

1. UI SHALL support deterministic replay scrubbing by tick/time index.
2. UI SHALL expose HO event timeline and State1/2/3 failure overlays.
3. UI research views SHALL consume snapshot/report artifacts without mutating SimCore runtime behavior.
4. UI state views SHALL represent satellite motion + UE connectivity + multi-beam HO core states for analysis use (not decorative-only animation).

### 3.6 Traceability and Source Governance

1. KPI-impacting runtime logic introduced in this package SHALL include `sourceId`-traceable comments.
2. Profile parameters added/changed in this package SHALL map to source catalog entries and be export-traceable in artifacts.
3. Any new `ASSUME-*` entry SHALL be registered in source catalog with rationale in the same change set.
4. Any new `ASSUME-*` entry SHALL be connected to profile/source-map or artifact-level trace fields.
5. At least one validation case/check SHALL cover each newly added `ASSUME-*` entry before merge.
6. This package SHALL NOT introduce opaque third-party simulator black-box dependencies for core sim logic.
7. Untraceable synthetic simplifications in KPI-critical data/algorithm paths SHALL be rejected.

### 3.7 Enforcement Binding (Automation Required)

1. Academic rigor/source-trace/full-fidelity/KPI-constant constraints SHALL remain enforceable via `scripts/validate-academic-rigor.mjs`.
2. Module split and file-size guardrails SHALL remain enforceable via `scripts/validate-module-structure.mjs`.
3. Repo policy + deferred scope guardrails SHALL remain enforceable via `scripts/validate-repo-policy.mjs`.
4. Validation suite completeness and gate summary constraints SHALL remain enforceable via `scripts/validate-validation-suite.mjs`.
5. Stage integration gate SHALL remain `npm run validate:stage`, and this package SHALL not weaken any existing hard gate.

---

## 4. Validation Gates (Pass/Fail)

1. Gate CB-1: multi-seed determinism
2. fixed tuple re-run yields identical statistical artifacts.
3. Gate CB-2: matrix completeness
4. required scenario axes/case IDs are generated and auditable.
5. Gate CB-3: compatibility safety
6. realism options disabled preserves baseline-compatible outputs.
7. Gate CB-4: report completeness
8. CDF/boxplot/ranking/significance artifacts are generated with required metadata.
9. Gate CB-5: UI research workflow
10. replay scrubber + HO timeline + state overlay pass integration smoke checks.
11. Gate CB-6: stage safety
12. `npm run validate:stage` remains green.
13. Gate CB-7: traceability safety
14. new KPI-impacting logic has `sourceId` trace and profile/source-trace fields in artifacts.
15. Gate CB-8: artifact freshness
16. `dist/sim-test-summary.json`, `dist/validation-suite.json`, `dist/validation-gate-summary.json` timestamps are newer than stage-run start.
17. Gate CB-9: policy and deferred-scope safety
18. `validate-repo-policy` passes with no RSMA/soft-HO/multi-orbit runtime path activation.
19. Gate CB-10: structure safety
20. `validate-module-structure` passes (`<=500` normal, `501-650` warning, `>650` split required).
21. Gate CB-11: validation-definition consistency
22. validation IDs used by completed validation matrix remain consistent with `src/sim/bench/validation-definitions.ts`.

---

## 5. Delivery Breakdown

1. D1: implement multi-seed statistical benchmark runner and artifact schema.
2. D2: implement scenario matrix v1 template generator (core + optional extended set).
3. D3: add temporal-correlation and Doppler-aware small-scale options (profile-traceable).
4. D4: add paper-ready reporting artifacts (CDF/boxplot raw, ranking stability, significance summary).
5. D5: add research UI workflow (replay scrubber, HO timeline, state overlay) and docs/status sync.
6. D6: add/refresh traceability and assumption governance hooks (`sourceId`, source-map, `ASSUME-*` validation coverage).
7. D7: keep enforcement scripts and stage-gate outputs green/fresh, and run milestone architecture review before completion closure.

---

## 6. Implementation Progress Backfill (D1~D7)

As of 2026-03-03:

| Delivery | Status | Commit | Evidence |
|---|---|---|---|
| D1 multi-seed statistical runner | Implemented | `4109743` | `src/sim/bench/multi-seed-benchmark.ts`, `src/sim/tests/integration-cases-multi-seed-benchmark.ts` |
| D2 scenario matrix v1 template | Implemented | `85a3eac` | `src/sim/bench/scenario-matrix.ts`, `src/sim/tests/integration-cases-scenario-matrix.ts` |
| D3 temporal correlation + Doppler-aware options | Implemented | `a39dd7e` | `src/sim/channel/small-scale.ts`, `src/sim/channel/link-budget.ts`, profile/source updates and deterministic small-scale tests |
| D4 paper-ready report artifacts | Implemented | `2aa121e` | `src/sim/bench/multi-seed-reporting.ts`, `src/sim/tests/integration-cases-multi-seed-reporting.ts` |
| D5 research UI workflow | Implemented | `4755310` | `src/components/sim/TimelineControls.tsx`, `src/components/sim/HOEventTimeline.tsx`, `src/components/sim/UEMarkers.tsx`, `src/components/scene/MainScene.tsx` |
| D6 traceability + `ASSUME-*` governance closure | Implemented | `a39dd7e` + closure | `ASSUME-SMALL-SCALE-REALISM-OPTIONS` registry/source-map/validation coverage + closure audit section |
| D7 architecture review + final closure sign-off | Implemented | `14e41d8` | architecture review notes + gate snapshot finalized in closure report |

Closure reference:
1. `sdd/completed/beamHO-bench-common-benchmark-v1-closure.md`

---

## 7. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This pending package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. `real-trace` compatibility with Starlink/OneWeb TLE daily-update workflow.
4. full-fidelity default research path; simplified mode explicit non-default.
5. profile/seed/source-trace reproducibility contract.
6. code-level provenance (`sourceId`) for KPI-impacting logic.
7. no hidden KPI-impacting constants (profile or registered `ASSUME-*` only).
8. repository copyright policy (`.gitignore` + repo-policy validation).
9. deferred-scope governance (no RSMA/soft-HO/multi-orbit active runtime path).
10. meaningful module split + file-size guardrails (`<=500` normal, `501-650` warning, `>650` split required).
11. milestone-level architecture review for structural coupling/layer clarity.
12. required stage artifacts freshness and CI traceability:
    - `dist/sim-test-summary.json`
    - `dist/validation-suite.json`
    - `dist/validation-gate-summary.json`
13. hard constraints mapped to executable enforcement scripts/gates (not text-only policy).
14. validation-matrix vs `validation-definitions` consistency remains mandatory.
15. no new black-box simulator dependency in core simulation path.

---

## 8. TODO Mapping (from `/home/u24/papers/todo.md`)

This pending package maps to:
1. Layer A/B common baseline comparison reproducibility requirements.
2. Layer C channel model generalization quality (without paper-specific lock-in).
3. KPI/report governance and reproducibility sections (artifact-level auditability).
4. Omni-scope Phase 5 requirement for fair baseline vs custom-algorithm comparison under same tuple.
