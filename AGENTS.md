# beamHO-bench Agent Rules

This file is the repo-local workflow entrypoint for agents working inside `beamHO-bench/`.

## 0. Current Repo Role

1. `beamHO-bench` is currently retained as a donor/reference project inside the broader `papers` workspace.
2. It is not the active primary implementation target; `ntn-sim-core` now holds that role.
3. Only use this workflow when the task explicitly requires:
   - donor inspection
   - parity lookup
   - selective backport
   - direct fixes inside `beamHO-bench`
4. Do not let `beamHO-bench` local conventions override the active authority set for `ntn-sim-core`.

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
6. Keep `sdd/pending/` limited to active pending scope and keep long-term items in `sdd/backlog/`; do not mix the two roles.
7. Preserve the project’s research default:
   - `full fidelity` is the default path
   - `simplified` is allowed only as an explicitly labeled non-default mode
8. Do not introduce ungrounded physical/visual parameters. If orbit, pass-time, projection, altitude-scaling, or similar behavior lacks paper or orbital-mechanics support, stop and surface the gap.
9. Split oversized files by responsibility, not by arbitrary line chopping:
   - `<= 500` lines is normal
   - `501-650` lines is warning territory
   - `> 650` lines should be treated as a required split unless there is a strong reason not to

## 2.1 Skill Routing

Use the project skill docs under `agent-skills/` as the first workflow reference when the task matches:
1. `agent-skills/beamho-sdd-workflow/SKILL.md`
   - active pending SDD work, implementation flow, lifecycle-sync
2. `agent-skills/beamho-validation-closure/SKILL.md`
   - validation scope, closure readiness, lifecycle closure
3. `agent-skills/beamho-observer-sky-frontend/SKILL.md`
   - observer-sky rendering, composition, continuity, screen-space acceptance
4. `agent-skills/beamho-traceability-profile-edit/SKILL.md`
   - profile JSON, `.sources.json`, `paper-sources.json`, `ASSUME-*`, research-parameter consistency

## 3. Frontend Acceptance Rule

For observer-sky / satellite-visual work:
1. `lint`, `test:sim`, `build`, and `validate:stage` are necessary but not sufficient.
2. The result must also satisfy:
   - `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. Use browser-based inspection evidence when validating visual behavior:
   - Playwright snapshot / screenshot evidence is preferred for visual regressions and closure checks.
4. If the screen still reads as:
   - a cluster near center-top,
   - a pack of satellites swapping positions,
   - or arbitrary jump/replacement motion,
   the work is not complete even if tests pass.
5. Manual acceptance must be reasoned against all three supported observer-sky modes:
   - `Synthetic Orbit`
   - `Starlink TLE`
   - `OneWeb TLE`
6. Do not let the visible display set collapse into the HO candidate set when the physical above-horizon pool is broader.
7. A passing observer-sky result must still read as:
   - `rise -> pass -> set`
   - `elevation < 0` hidden
   - low-elevation non-serving satellites as ghost/non-active
   - active satellites as visually distinguishable serving candidates

## 4. SDD Lifecycle

1. Active pending truth lives in:
   - `sdd/completed/beamHO-bench-implementation-status.md`
2. `sdd/pending/README.md` must match the same lifecycle state.
3. `sdd/README.md` must also stay synchronized when pending/completed package listings change.
4. Pending work is not closure-tracked until:
   - implementation exists,
   - validation passes,
   - lifecycle docs are synchronized,
   - and visual/manual acceptance is satisfied when the package changes frontend behavior.
5. Do not convert an SDD to closure-tracked early.
6. Completed pending work should have corresponding closure evidence under `sdd/completed/*-closure.md` or the implemented-spec package already referenced by the lifecycle docs.

## 5. Validation Rules

Run at least:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

Frontend-only copy or lifecycle-doc changes may skip full validation if no code path changed, but the response must say validation was skipped.
During iteration, targeted checks such as `node scripts/run-sim-tests.mjs` or `npx vitest` are acceptable for narrowing failures, but they do not replace the final required validation set above when code behavior changes.
Use these additional commands deliberately:
1. `npm run validate:daily`
   - local iteration shortcut only; never a substitute for `validate:stage`
2. `npm run validate:val-suite:all`
   - use when full validation-scope coverage is needed beyond core scope
3. `npm run validate:nightly`
   - use for release-grade/full-scope verification
4. `npm run bench:cross-mode`
   - use when touching cross-mode benchmark workflow or reproducibility contracts
5. `npm run bundle:repro-v1`
   - use when touching repro-bundle packaging/output contracts
6. `npm run rerun:contract`
   - use when touching rerun/replay contract behavior
The following changes should be treated as stage-gate-required by default:
1. KPI or handover logic
2. scheduler, scenario, or runtime behavior
3. profile/schema/source-map/`ASSUME-*` changes
4. TLE / real-trace / propagation changes
5. major refactors or responsibility-preserving file splits
When `validate:stage` is part of the task, the expected fresh artifacts include:
1. `dist/sim-test-summary.json`
2. `dist/validation-suite.json`
3. `dist/validation-suite.csv`
4. `dist/validation-gate-summary.json`
5. `dist/runtime-parameter-audit-summary.json`

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
4. If a profile or source-trace contract changes, update the synchronized surfaces together as needed:
   - `src/config/paper-profiles/<profile>.json`
   - `src/config/paper-profiles/<profile>.sources.json`
   - `src/config/references/paper-sources.json`
   - `src/config/paper-profiles/paper-profile.schema.json`
   - `src/config/research-parameters/catalog.ts`
   - `src/config/research-parameters/consistency.ts`
5. Every new `sourceId` must exist in `src/config/references/paper-sources.json`.
6. Do not change profile values without updating the corresponding `.sources.json` justification when the source basis changes.

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
