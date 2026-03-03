# SDD Document Set

This folder is explicitly split into implemented, pending (active or closure-tracked), and backlog SDD documents.

## Status Authority

1. The authoritative implementation status document is:
   - `completed/beamHO-bench-implementation-status.md`
2. This index is for document location/navigation, not milestone truth ownership.

## Folder Structure

1. `completed/`
   - SDDs implemented in code and closure-tracked with stage-gate evidence.
2. `pending/`
   - pending SDDs (active implementation roadmap items or closure-tracked historical pending specs).
3. `backlog/`
   - long-term SDD/backlog items out of the current active implementation scope.

## Completed (Implemented / Closure-Tracked)

1. `completed/beamHO-bench-sdd.md`
2. `completed/beamHO-bench-requirements.md`
3. `completed/beamHO-bench-profile-baseline.md`
4. `completed/beamHO-bench-paper-traceability.md`
5. `completed/beamHO-bench-validation-matrix.md`
6. `completed/beamHO-bench-experiment-protocol.md`
7. `completed/beamHO-bench-implementation-status.md`
8. `completed/beamHO-bench-sdd-v2-roadmap.md`
9. `completed/beamHO-bench-rl-plugin-sdd.md`
10. `completed/beamHO-bench-joint-beamho-sdd.md`
11. `completed/beamHO-bench-baseline-generalization-sdd.md`
12. `completed/beamHO-bench-gap-closure-closure.md`
13. `completed/beamHO-bench-small-scale-validation-closure.md`
14. `completed/beamHO-bench-common-benchmark-v1-closure.md`
15. `completed/beamHO-bench-common-baseline-v2-closure.md`
16. `completed/beamHO-bench-complexity-reduction-closure.md`
17. `completed/beamHO-bench-cross-mode-reproducible-benchmark-closure.md`

## Pending (Active + Closure-Tracked Specs)

1. `pending/beamHO-bench-baseline-parameter-envelope-sdd.md` (active pending package)
2. `pending/beamHO-bench-cross-mode-reproducible-benchmark-sdd.md` (implemented/closure-tracked pending package)
3. `pending/beamHO-bench-complexity-reduction-sdd.md` (implemented/closure-tracked pending package)
4. `pending/beamHO-bench-common-baseline-v2-sdd.md` (implemented/closure-tracked pending package)
5. `pending/beamHO-bench-common-benchmark-v1-sdd.md` (implemented/closure-tracked pending spec)
6. `pending/beamHO-bench-small-scale-validation-sdd.md` (implemented/closure-tracked pending package)
7. `pending/beamHO-bench-gap-closure-sdd.md` (implemented/closure-tracked pending package)

## Backlog (Out of Active Scope)

1. `backlog/beamHO-bench-multiorbit-backlog.md` (LEO+MEO+GEO long-term reference)

## Reference Locks (outside `sdd/`)

1. `papers/sdd-required/papers-index.md`
2. `papers/sdd-required/papers-lock.json`
3. `papers/standards/standards-index.md`
4. `papers/standards/standards-lock.json`

## Promotion Rule

A pending SDD can move from `pending/` to `completed/` only when:
1. corresponding code implementation is merged;
2. stage gate passes (`npm run validate:stage`);
3. traceability and validation artifacts are updated.
