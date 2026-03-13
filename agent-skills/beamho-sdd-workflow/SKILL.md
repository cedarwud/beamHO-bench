---
name: beamho-sdd-workflow
description: Use when developing, reviewing, or closing work in beamHO-bench that is governed by an active pending SDD, especially when the task requires reading PROJECT_CONSTRAINTS, active pending status, validation rules, and lifecycle-sync docs before editing code.
---

# beamHO SDD Workflow

Use this skill for `beamHO-bench/` when the task is tied to an active pending SDD or when lifecycle status may need updating.

## Required Read Order

Read these first:
1. `PROJECT_CONSTRAINTS.md`
2. `sdd/completed/beamHO-bench-implementation-status.md`
3. `sdd/pending/README.md`
4. the current active pending SDD
5. if frontend satellite behavior is involved:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`
   - related closure-tracked frontend SDDs for lower-layer context

## Workflow

1. Check `git status --short`.
2. Identify the active pending SDD from status docs.
3. Read only the files needed for the current delivery.
4. Implement the current delivery directly; do not stop at analysis.
5. Run validation appropriate to the change.
6. Sync lifecycle docs if the delivery changes pending/completed truth.
7. Report:
   - delivery reached
   - core files changed
   - validation results
   - remaining open items

## Frontend Rule

If the change affects observer-sky rendering:
1. passing automated tests is not enough
2. the result must also satisfy:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. do not close the SDD early from proxy metrics such as:
   - sector diversity only
   - determinism only
   - retained-ID counts only

## Validation Defaults

Prefer this set unless the task is docs-only:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

If validation is skipped, say so explicitly and explain why.

## Lifecycle Rules

1. `sdd/completed/beamHO-bench-implementation-status.md` is the authority.
2. `sdd/pending/README.md` and `sdd/README.md` must stay in sync with it.
3. Closure-tracked status requires:
   - implementation exists
   - validation evidence exists
   - lifecycle docs are updated
   - visual/manual acceptance is satisfied for frontend packages
