---
name: beamho-validation-closure
description: Use when validating beamHO-bench changes, deciding which project gates to run, preparing SDD closure, or checking whether lifecycle docs and manual acceptance evidence are sufficient before marking work complete.
---

# beamHO Validation And Closure

Use this skill for `beamHO-bench/` when the task is about validation scope, gate selection, closure readiness, or lifecycle-sync after implementation.

## Read First

Read these first:
1. `AGENTS.md`
2. `PROJECT_CONSTRAINTS.md`
3. `docs/zh-TW/04-testing-and-validation.md`
4. `sdd/completed/beamHO-bench-implementation-status.md`
5. `sdd/pending/README.md`
6. if the package changes frontend satellite behavior:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`

## Validation Scope

Use this default set unless the change is docs-only:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

Treat the following as stage-gate-required changes:
1. KPI or handover logic
2. scheduler or scenario runtime behavior
3. profile, schema, source map, or `ASSUME-*` changes
4. TLE / real-trace / propagation changes
5. large refactors, file splits, or cross-module frontend composition changes

Docs-only or lifecycle-doc-only changes may skip code validation, but the report must say validation was skipped and why.

## Frontend Closure Rule

If the change affects observer-sky or satellite presentation:
1. automated gates are necessary but not sufficient
2. closure also requires manual acceptance against:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. do not mark complete from proxy metrics alone, including:
   - sector diversity only
   - determinism only
   - retained-ID counts only

## Closure Checklist

Before marking an SDD closure-tracked, confirm:
1. implementation exists in code
2. required validation ran and results are reported
3. `sdd/completed/beamHO-bench-implementation-status.md` is updated
4. `sdd/pending/README.md` matches the same lifecycle state
5. `sdd/README.md` is synced when package listings changed
6. frontend work has manual acceptance evidence when applicable
7. remaining open items are explicitly stated if not fully closed

## Reporting

Always report:
1. what validation ran
2. what was intentionally skipped
3. whether closure criteria were met
4. which lifecycle files were updated
