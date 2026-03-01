# SDD Document Set

This folder is explicitly split into implemented and planned SDD documents.

## Folder Structure

1. `completed/`
   - SDDs already implemented in code and validated by current stage gate.
2. `pending/`
   - Next-phase SDDs not implemented yet (planning/design state).

## Completed (Implemented)

1. `completed/beamHO-bench-sdd.md`
2. `completed/beamHO-bench-requirements.md`
3. `completed/beamHO-bench-profile-baseline.md`
4. `completed/beamHO-bench-paper-traceability.md`
5. `completed/beamHO-bench-validation-matrix.md`
6. `completed/beamHO-bench-experiment-protocol.md`
7. `completed/beamHO-bench-implementation-status.md`

## Pending (Not Implemented Yet)

1. `pending/beamHO-bench-sdd-v2-roadmap.md`
2. `pending/beamHO-bench-rl-plugin-sdd.md`
3. `pending/beamHO-bench-joint-beamho-sdd.md`
4. `pending/beamHO-bench-multiorbit-sdd.md`

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
