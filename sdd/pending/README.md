# Pending SDD Workspace

This folder is intentionally narrow. It currently holds only the active corrective workspace item.

Status ownership:
1. lifecycle truth is maintained in `sdd/completed/beamHO-bench-implementation-status.md`
2. this file is only the navigation/index entry for what remains physically under `pending/`

## 1. Current Workspace Files

`beamHO-bench-beam-layout-sdd.md` — Active Pending (2026-03-15 opened, stub phase)

`beamHO-bench-real-trace-local-pass-replay-sdd.md` — Active Pending (2026-03-16 promoted from backlog; D1/D3/D4/D5/D6 implemented; D2/D7 open)

Notes:
1. `beamHO-bench-observer-sky-pass-conversion-sdd.md` closed on 2026-03-15 — moved to `sdd/completed/implemented-specs/`.
2. `beamHO-bench-observer-sky-projection-selection-correction-sdd.md` is deleted — superseded.
3. do not add unrelated completed specs back into `pending/`
4. historical closure-tracked pending specs were moved to `sdd/completed/implemented-specs/`

## 2. Historical Implemented Specs

Implemented specs that used to remain in `pending/` now live in:
1. `sdd/completed/implemented-specs/beamHO-bench-gap-closure-sdd.md`
2. `sdd/completed/implemented-specs/beamHO-bench-small-scale-validation-sdd.md`
3. `sdd/completed/implemented-specs/beamHO-bench-common-benchmark-v1-sdd.md`
4. `sdd/completed/implemented-specs/beamHO-bench-common-baseline-v2-sdd.md`
5. `sdd/completed/implemented-specs/beamHO-bench-complexity-reduction-sdd.md`
6. `sdd/completed/implemented-specs/beamHO-bench-cross-mode-reproducible-benchmark-sdd.md`
7. `sdd/completed/implemented-specs/beamHO-bench-baseline-parameter-envelope-sdd.md`
8. `sdd/completed/implemented-specs/beamHO-bench-repro-bundle-v1-sdd.md`
9. `sdd/completed/implemented-specs/beamHO-bench-service-continuity-baseline-sdd.md`
10. `sdd/completed/implemented-specs/beamHO-bench-core-extension-governance-sdd.md`
11. `sdd/completed/implemented-specs/beamHO-bench-parameter-consistency-v1-sdd.md`
12. `sdd/completed/implemented-specs/beamHO-bench-parametric-trajectory-backend-sdd.md`
13. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md`
14. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md`
15. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md`

## 3. Constraint Binding

Any file left under `pending/` must still comply with:
1. `PROJECT_CONSTRAINTS.md`
2. current status authority in `sdd/completed/beamHO-bench-implementation-status.md`
3. active frontend acceptance requirements when observer-sky behavior is involved
