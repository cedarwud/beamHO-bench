# Pending SDD Set

This folder contains SDD documents not implemented yet.

## 1. Active Pending Topics (LEO-only)

1. `beamHO-bench-sdd-v2-roadmap.md` (execution order and gates)
2. `beamHO-bench-rl-plugin-sdd.md` (RL decision plugin contract)
3. `beamHO-bench-joint-beamho-sdd.md` (beam scheduler + HO coupled mode)

## 2. Long-Term Backlog (Out of current scope)

1. `beamHO-bench-multiorbit-sdd.md` (LEO+MEO+GEO unified scheduler; do not include in current implementation plan)

## 3. Quality Bar for Pending Specs

A pending SDD is considered implementation-ready only if it includes:
1. explicit scope boundary.
2. normative MUST/SHALL requirements.
3. concrete interface/data contract.
4. deterministic and traceability requirements.
5. pass/fail validation gates.
6. delivery breakdown with dependency order.
7. explicit binding to `PROJECT_CONSTRAINTS.md` guardrails.

## 4. Constraint Binding (Required)

All active pending items must keep compliance with:
1. `LEO-only` active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. real-trace compatibility with Starlink/OneWeb TLE daily-update workflow.
4. code-level provenance comments (`sourceId`) for key KPI-impacting logic.
5. no hidden KPI-impacting constants (profile or `ASSUME-*` only).
6. repository copyright policy (`.gitignore` and repo-policy validation).
7. meaningful file splitting and periodic architecture review per milestone.
8. required CI artifacts (`sim-test-summary`, `validation-suite`, `validation-gate-summary`).

## 5. Promotion Rule (pending -> completed)

Promotion requires all conditions:
1. implementation merged.
2. required tests and stage validation pass.
3. source-trace and artifact fields are complete.
4. completed SDD documents are updated to reflect actual code paths.
