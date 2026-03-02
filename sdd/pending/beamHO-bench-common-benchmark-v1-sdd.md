# beamHO-bench — Common Benchmark Environment v1 SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-02  
**Status:** Active Pending / Planned

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

---

## 5. Delivery Breakdown

1. D1: implement multi-seed statistical benchmark runner and artifact schema.
2. D2: implement scenario matrix v1 template generator (core + optional extended set).
3. D3: add temporal-correlation and Doppler-aware small-scale options (profile-traceable).
4. D4: add paper-ready reporting artifacts (CDF/boxplot raw, ranking stability, significance summary).
5. D5: add research UI workflow (replay scrubber, HO timeline, state overlay) and docs/status sync.

---

## 6. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This pending package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. profile/seed/source-trace reproducibility contract.
4. no hidden KPI-impacting constants (profile or `ASSUME-*` only).
5. deferred-scope governance (no RSMA/soft-HO/multi-orbit active runtime path).
6. structure and file-size guardrails (`validate:structure`).
7. required stage artifacts freshness and CI traceability.

---

## 7. TODO Mapping (from `/home/u24/papers/todo.md`)

This pending package maps to:
1. Layer A/B common baseline comparison reproducibility requirements.
2. Layer C channel model generalization quality (without paper-specific lock-in).
3. KPI/report governance and reproducibility sections (artifact-level auditability).
4. Omni-scope Phase 5 requirement for fair baseline vs custom-algorithm comparison under same tuple.
