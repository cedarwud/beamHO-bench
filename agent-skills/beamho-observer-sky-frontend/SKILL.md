---
name: beamho-observer-sky-frontend
description: Use when editing beamHO-bench observer-sky satellite rendering, composition, camera framing, display selection, continuity, or screen-space acceptance so frontend changes stay aligned with visual-acceptance rules instead of proxy metrics alone.
---

# beamHO Observer-Sky Frontend

Use this skill for `beamHO-bench/` when the task affects satellite display, observer-sky composition, god-view framing, display-set behavior, or frontend acceptance for `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE`.

## Read First

Read these first:
1. `AGENTS.md`
2. `PROJECT_CONSTRAINTS.md`
3. `docs/zh-TW/07-observer-sky-visual-acceptance.md`
4. `sdd/completed/beamHO-bench-implementation-status.md`
5. the current active pending frontend SDD
6. these frontend files:
   - `src/components/scene/MainScene.tsx`
   - `src/components/scene/SatelliteSkyLayer.tsx`
   - `src/components/scene/ObserverSkyCameraRig.tsx`
   - `src/viz/satellite/view-composition.ts`
   - `src/viz/satellite/observer-sky-projection.ts`
   - `src/viz/satellite/display-selection.ts`
   - `src/viz/satellite/display-continuity.ts`
   - `src/viz/satellite/display-adapter.ts`
   - `src/viz/satellite/display-pipeline.ts`
   - `src/viz/satellite/screen-space-acceptance.ts`

## Ownership Boundaries

Keep these boundaries clear:
1. `src/sim/**`
   - physical/runtime truth
   - do not push frontend-only composition state back here
2. `src/viz/satellite/**`
   - projection, selection, continuity, composition, screen-space evaluation
3. `src/components/scene/**`
   - scene wiring, camera rig, accepted view-mode integration
4. `src/components/sim/**`
   - renderer-only display components

Do not solve a frontend acceptance problem by hiding more state inside runtime contracts.

## Frontend Acceptance Rules

The result must satisfy `docs/zh-TW/07-observer-sky-visual-acceptance.md`.

In practice, that means:
1. satellites must read as `rise -> pass -> set`
2. `elevation < 0` stays hidden
3. `0 <= elevation < theta_min` stays ghost / non-serving
4. `elevation >= theta_min` reads as active
5. screen-space must not collapse into a center-top cluster
6. satellites must remain identifiable as continuous moving objects
7. display set must remain broader than HO candidate set when the physical pool allows it

Do not mark complete if the screen still reads as:
1. a pack of points near the scene center swapping places
2. long pauses followed by abrupt relocation
3. candidate-limit-driven top-N truncation in the visible sky

## Preferred Change Surfaces

Typical frontend fixes belong in:
1. `src/viz/satellite/view-composition.ts`
2. `src/viz/satellite/display-selection.ts`
3. `src/viz/satellite/display-continuity.ts`
4. `src/viz/satellite/display-adapter.ts`
5. `src/viz/satellite/display-pipeline.ts`
6. `src/viz/satellite/screen-space-acceptance.ts`
7. `src/components/scene/ObserverSkyCameraRig.tsx`
8. `src/components/scene/MainScene.tsx`
9. `src/components/scene/SatelliteSkyLayer.tsx`

Do not reach for generic camera-distance tweaks first if the actual problem is display selection, composition policy, or continuity semantics.

## Validation

For observer-sky frontend work, prefer this full set:
1. `npm run lint`
2. `npm run test:sim`
3. `npm run build`
4. `npm run validate:stage`

Also check whether tests cover:
1. screen-space spread
2. pass readability
3. continuity readability
4. cross-mode consistency

If those tests are missing for the change, add them instead of relying on manual claims alone.

## Closure Rule

Frontend observer-sky work is not closure-ready until:
1. automated validation passes
2. manual acceptance is checked against `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. lifecycle docs are synced
4. the result is not justified only by proxy metrics such as:
   - sector diversity
   - determinism
   - retained-ID counts

## Reporting

Always report:
1. which frontend layers changed
2. whether camera/composition or display-set policy changed
3. what automated validation ran
4. whether manual visual acceptance was actually checked
5. what still fails if the screen is not yet acceptable
