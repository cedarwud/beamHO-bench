# Pending SDD Set

This folder contains active-pending or closure-tracked pending SDD documents.

Status ownership:
1. milestone completion truth is maintained in `sdd/completed/beamHO-bench-implementation-status.md`.
2. this file is restricted to pending/closure-tracked index information.

## 1. Active Pending Specs

1. `beamHO-bench-core-extension-governance-sdd.md` (active pending on 2026-03-03)

## 2. Closure-Tracked Pending Specs

1. `beamHO-bench-repro-bundle-v1-sdd.md` (implemented/closure-tracked on 2026-03-03)
2. `beamHO-bench-baseline-parameter-envelope-sdd.md` (implemented/closure-tracked on 2026-03-03)
3. `beamHO-bench-cross-mode-reproducible-benchmark-sdd.md` (implemented/closure-tracked on 2026-03-03)
4. `beamHO-bench-complexity-reduction-sdd.md` (implemented/closure-tracked on 2026-03-03)
5. `beamHO-bench-common-baseline-v2-sdd.md` (implemented/closure-tracked on 2026-03-03)
6. `beamHO-bench-common-benchmark-v1-sdd.md` (implemented/closure-tracked on 2026-03-03)
7. `beamHO-bench-gap-closure-sdd.md` (implemented/closure-tracked on 2026-03-02)
8. `beamHO-bench-small-scale-validation-sdd.md` (implemented/closure-tracked on 2026-03-02)
9. `beamHO-bench-service-continuity-baseline-sdd.md` (implemented/closure-tracked on 2026-03-03)
10. closure report: `sdd/completed/beamHO-bench-repro-bundle-v1-closure.md`
11. closure report: `sdd/completed/beamHO-bench-baseline-parameter-envelope-closure.md`
12. closure report: `sdd/completed/beamHO-bench-cross-mode-reproducible-benchmark-closure.md`
13. closure report: `sdd/completed/beamHO-bench-complexity-reduction-closure.md`
14. closure report: `sdd/completed/beamHO-bench-common-baseline-v2-closure.md`
15. closure report: `sdd/completed/beamHO-bench-gap-closure-closure.md`
16. closure report: `sdd/completed/beamHO-bench-small-scale-validation-closure.md`
17. closure report: `sdd/completed/beamHO-bench-common-benchmark-v1-closure.md`
18. closure report: `sdd/completed/beamHO-bench-service-continuity-baseline-closure.md`

## 3. Backlog Location

1. long-term backlog documents are moved to `sdd/backlog/`.
2. current backlog item: `sdd/backlog/beamHO-bench-multiorbit-backlog.md`.

## 4. Quality Bar for Pending Specs

A pending SDD is considered implementation-ready only if it includes:
1. explicit scope boundary.
2. normative MUST/SHALL requirements.
3. concrete interface/data contract.
4. deterministic and traceability requirements.
5. pass/fail validation gates.
6. delivery breakdown with dependency order.
7. explicit binding to `PROJECT_CONSTRAINTS.md` guardrails.

## 5. Constraint Binding (Required)

All active pending items must keep compliance with:
1. `LEO-only` active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. real-trace compatibility with Starlink/OneWeb TLE daily-update workflow.
4. code-level provenance comments (`sourceId`) for key KPI-impacting logic.
5. no hidden KPI-impacting constants (profile or `ASSUME-*` only).
6. repository copyright policy (`.gitignore` and repo-policy validation).
7. meaningful file splitting and periodic architecture review per milestone.
8. required CI artifacts (`sim-test-summary`, `validation-suite`, `validation-gate-summary`).

## 6. Promotion Rule (pending -> completed)

Promotion requires all conditions:
1. implementation merged.
2. required tests and stage validation pass.
3. source-trace and artifact fields are complete.
4. completed SDD documents are updated to reflect actual code paths.

## 7. Deferred-Scope Checklist (BG-6)

For active v2 milestones, all pending implementations must keep:
1. no `RSMA` / `soft-HO` runtime path in `src/`.
2. no broad `large-scale DRL` or `multi-paper DRL fusion` runtime path in `src/`.
3. deferred items tracked only as pending SDD/backlog text, not partial active feature toggles.
4. any reactivation must be introduced by a new pending SDD with scope/data contract/validation-gate definition.
