# beamHO-bench Agent Rules

This file is the repo-local workflow entrypoint for agents working inside `beamHO-bench/`.

## 1. Authority Order

When instructions conflict, use this order:
1. `PROJECT_CONSTRAINTS.md`
2. active visual acceptance doc:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md` for observer-sky frontend work
3. current active pending SDD from:
   - `sdd/completed/beamHO-bench-implementation-status.md`
   - `sdd/pending/README.md`
4. closure-tracked pending SDDs only for already-completed lower-layer context
5. package scripts and validation docs:
   - `package.json`
   - `docs/zh-TW/04-testing-and-validation.md`

## 2. Working Rules

1. Check `git status --short` before editing.
2. Do not overwrite or revert unrelated local changes.
3. If there is an active pending SDD, implement against that SDD first.
4. Do not open a new SDD unless:
   - acceptance criteria materially changed, or
   - the current active pending SDD is no longer the correct scope container.
5. Do not mark frontend work complete from proxy metrics alone.

## 3. Frontend Acceptance Rule

For observer-sky / satellite-visual work:
1. `lint`, `test:sim`, `build`, and `validate:stage` are necessary but not sufficient.
2. The result must also satisfy:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. If the screen still reads as:
   - a cluster near center-top,
   - a pack of satellites swapping positions,
   - or arbitrary jump/replacement motion,
   the work is not complete even if tests pass.

## 4. SDD Lifecycle

1. Active pending truth lives in:
   - `sdd/completed/beamHO-bench-implementation-status.md`
2. `sdd/pending/README.md` must match the same lifecycle state.
3. Pending work is not closure-tracked until:
   - implementation exists,
   - validation passes,
   - lifecycle docs are synchronized,
   - and visual/manual acceptance is satisfied when the package changes frontend behavior.
4. Do not convert an SDD to closure-tracked early.

## 5. Validation Rules

Run at least:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

Frontend-only copy or lifecycle-doc changes may skip full validation if no code path changed, but the response must say validation was skipped.

## 6. Module Ownership

Use these boundaries:
1. `src/sim/**`
   - runtime, handover, scheduler, KPI, scenario state
2. `src/viz/**`
   - projection, display selection, continuity, composition, screen-space checks
3. `src/components/scene/**`
   - scene wiring and view-mode integration
4. `src/components/sim/**`
   - renderer-only display components, HUD, control surfaces

Do not push view-only state back into runtime contracts unless it is explicitly justified and traceable.

## 7. Traceability Rules

1. No hidden KPI-impacting constants.
2. Any new `ASSUME-*` must be registered and validation-covered in the same change set.
3. Profile/source map changes must keep traceability intact.

## 8. Commit Discipline

1. Commit at meaningful delivery boundaries.
2. Do not batch unrelated work into one commit.
3. When reporting progress, state:
   - what delivery was completed,
   - what files changed,
   - what validation ran,
   - what remains open.

## 9. Local Skill Source

Project-specific reusable skill sources live under:
1. `agent-skills/`

Current skills:
1. `agent-skills/beamho-sdd-workflow/SKILL.md`
2. `agent-skills/beamho-validation-closure/SKILL.md`
3. `agent-skills/beamho-traceability-profile-edit/SKILL.md`
4. `agent-skills/beamho-observer-sky-frontend/SKILL.md`
