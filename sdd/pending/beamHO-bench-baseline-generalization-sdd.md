# beamHO-bench — Baseline Generalization and Reproduction SDD (Implemented)

**Version:** 1.0.0  
**Date:** 2026-03-01  
**Status:** Implemented / Historical pending spec (closure-tracked)

Closure reference:
1. `sdd/completed/beamHO-bench-baseline-generalization-closure.md`

---

## 1. Purpose

Close the remaining gap between a general LEO baseline framework and paper-specific reproduction workflows.

This document standardizes six pending items:
1. Layer-D paper role mapping (`MORL`, `C-UCGM`, `LDAPS/DAPS`) without collapsing into single-paper environment lock-in.
2. Throughput definition policy (`Shannon` vs `MCS-mapped`) and default.
3. one-click rerun contract for reproducible experiments.
4. Timer-CHO ToS countdown + geometry visualization acceptance.
5. 7/16/50 beam profile benchmark rules.
6. deferred scope policy for `RSMA soft HO` and large-scale DRL integration.

---

## 2. Scope Boundary

1. Active scope is still LEO-only.
2. This document defines framework-level policies and gates, not a single-paper reproduction script.
3. Paper-specific parameters must be implemented via profile/source mapping, never by hidden code constants.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Layer-D Paper Role Mapping

1. The system SHALL define Layer-D roles by function, not by hard binding to one paper environment:
2. MORL-type papers -> policy plugin state/action/reward contract reference.
3. C-UCGM/large-scale control papers -> scenario scaling and clustering strategy reference.
4. LDAPS/DAPS papers -> multistage decision flow and transition constraints reference.
5. Any newly used paper in Layer-D SHALL be registered in source catalog and lock files before being used in code comments or profiles.

### 3.2 Throughput Definition Policy

1. The benchmark default SHALL be `Shannon` throughput for cross-paper comparability in base framework runs.
2. `MCS-mapped` throughput SHALL be supported as an optional mode with explicit run metadata field.
3. Any reported result SHALL include `throughput_model` in run manifest/artifacts.

### 3.3 One-Click Rerun Contract

1. The system SHALL provide a rerun entrypoint accepting at least: `scenario_id`, `profile_id`, `seed`, `baseline_or_policy`, and optional `runtime_overrides`.
2. The rerun entrypoint SHALL regenerate comparable artifacts and a manifest hash summary in one command.
3. The rerun command SHALL fail fast on unknown profile/source IDs.

### 3.4 Timer-CHO Visualization Acceptance

1. Timer-CHO mode SHALL expose ToS countdown state in runtime data and UI/HUD binding.
2. Timer-CHO mode SHALL expose geometry linkage fields (distance/elevation/time-to-threshold) used by countdown logic.
3. Acceptance SHALL include deterministic replay of countdown events under fixed scenario/profile/seed.

### 3.5 7/16/50 Beam Profile Rules

1. The framework SHALL support profile-driven beam counts `7`, `16`, and `50` without code-path rewrites.
2. Each beam-count mode SHALL be benchmarked under identical seed/scenario comparison runs.
3. Report output SHALL include beam-count metadata and normalized KPI comparison.

### 3.6 Deferred RSMA/DRL Expansion Policy

1. `RSMA soft HO` and broad multi-paper DRL fusion SHALL remain deferred and non-blocking for current roadmap exit.
2. Reactivation requires explicit pending SDD entry with scope, data contract, and validation gates.
3. Deferred items SHALL not introduce hidden partial code paths in active baseline modes.

---

## 4. Validation Gates (Pass/Fail)

1. Gate BG-1: Layer-D role mapping completeness
2. role-to-paper mapping table exists with source registration checks.
3. Gate BG-2: throughput model traceability
4. every run artifact has explicit `throughput_model` and no implicit fallback.
5. Gate BG-3: one-click rerun
6. rerun command reproduces matching digest for fixed input tuple.
7. Gate BG-4: Timer-CHO visualization
8. ToS countdown and geometry fields are present and replay-stable.
9. Gate BG-5: beam-count comparability
10. 7/16/50 runs complete with normalized KPI output.
11. Gate BG-6: deferred policy enforcement
12. RSMA/large-scale DRL remain out of active stage-gate requirements.

---

## 5. Delivery Breakdown

1. D1: role mapping table + source registration checks.
2. D2: throughput model schema/runtime metadata and report updates.
3. D3: rerun CLI contract and artifact digest check.
4. D4: Timer-CHO visualization data contract + tests.
5. D5: 7/16/50 profile benchmark templates and validation-suite cases.
6. D6: deferred-policy checklist integration in roadmap and pending README.
