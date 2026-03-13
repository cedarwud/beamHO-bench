# SDD Document Set

This folder is explicitly split into implemented specs, the current pending workspace, and backlog documents.

## Status Authority

1. The authoritative implementation status document is:
   - `completed/beamHO-bench-implementation-status.md`
2. This index is for document location/navigation, not milestone truth ownership.

## Folder Structure

1. `completed/`
   - implemented specs, closure reports, status authority, and long-lived completed references.
2. `pending/`
   - the narrow current-workspace bucket; do not keep historical closure-tracked specs here.
3. `backlog/`
   - long-term SDD/backlog items out of the current active implementation scope.
4. `completed/implemented-specs/`
   - original SDD specs that were implemented and previously closure-tracked under `pending/`.

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
18. `completed/beamHO-bench-baseline-parameter-envelope-closure.md`
19. `completed/beamHO-bench-repro-bundle-v1-closure.md`
20. `completed/beamHO-bench-service-continuity-baseline-closure.md`
21. `completed/beamHO-bench-core-extension-governance-closure.md`
22. `completed/beamHO-bench-parameter-consistency-v1-closure.md`
23. `completed/beamHO-bench-parametric-trajectory-backend-closure.md`
24. `completed/beamHO-bench-observer-sky-view-closure.md`
25. `completed/beamHO-bench-observer-sky-visual-correction-closure.md`
26. `completed/beamHO-bench-observer-sky-god-view-composition-closure.md`
27. `completed/implemented-specs/beamHO-bench-gap-closure-sdd.md`
28. `completed/implemented-specs/beamHO-bench-small-scale-validation-sdd.md`
29. `completed/implemented-specs/beamHO-bench-common-benchmark-v1-sdd.md`
30. `completed/implemented-specs/beamHO-bench-common-baseline-v2-sdd.md`
31. `completed/implemented-specs/beamHO-bench-complexity-reduction-sdd.md`
32. `completed/implemented-specs/beamHO-bench-cross-mode-reproducible-benchmark-sdd.md`
33. `completed/implemented-specs/beamHO-bench-baseline-parameter-envelope-sdd.md`
34. `completed/implemented-specs/beamHO-bench-repro-bundle-v1-sdd.md`
35. `completed/implemented-specs/beamHO-bench-service-continuity-baseline-sdd.md`
36. `completed/implemented-specs/beamHO-bench-core-extension-governance-sdd.md`
37. `completed/implemented-specs/beamHO-bench-parameter-consistency-v1-sdd.md`
38. `completed/implemented-specs/beamHO-bench-parametric-trajectory-backend-sdd.md`
39. `completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md`
40. `completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md`
41. `completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md`

## Pending Workspace

1. no active pending spec at this time (`2026-03-13`)
2. lifecycle truth remains in:
   - `completed/beamHO-bench-implementation-status.md`
   - `pending/README.md`

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
