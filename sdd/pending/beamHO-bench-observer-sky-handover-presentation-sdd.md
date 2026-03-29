# beamHO-bench — Observer-Sky Handover Presentation SDD

**Version:** 0.1.0
**Date:** 2026-03-19
**Status:** Active Pending

---

## 1. Purpose

Define a research-grounded frontend package for making handover events readable in the accepted observer-sky composition without collapsing the visible sky into a center-top cluster.

This package exists to answer one question that is not yet governed by a dedicated active SDD:
1. how to present a handover event near the scene's central readable region
2. while preserving physical pass geometry and candidate diversity
3. and without misrepresenting the result as "many satellites crowding the zenith"

The goal is not to maximize the number of satellites at the exact screen center.
The goal is to make the serving satellite, target candidate, and handover state transition legible in the primary observer-sky view.

---

## 2. Scope-Container Justification

Opening a new pending SDD is justified because the current active pending items are not the correct scope container for this requirement:

1. `beamHO-bench-beam-layout-sdd.md`
   - governs beam geometry, beam visualization, and scene-focus beam rendering
   - does not define observer-sky handover-event presentation semantics
2. `beamHO-bench-real-trace-local-pass-replay-sdd.md`
   - governs real-trace fixture selection, replay window, bootstrap, and demo-loop separation
   - does not define how a handover event should be foregrounded in the accepted observer-sky composition
3. completed observer-sky packages (`OSV`, `OSVC`, `OSGC`, `OSPC`)
   - already solved visibility semantics, display/candidate separation, primary composition, and pass-conversion continuity
   - but do not define a dedicated handover-event readability contract

This package therefore introduces a new acceptance target:
1. central-readable handover presentation
2. with explicit research/default vs sensitivity vs presentation-mode separation
3. without reopening lower-layer pass-motion or beam-geometry contracts by default

---

## 3. Source Basis

### 3.1 Normative project constraints

1. `PROJECT_CONSTRAINTS.md`
2. `docs/zh-TW/07-observer-sky-visual-acceptance.md`
3. `docs/zh-TW/06-research-parameter-governance.md`

### 3.2 Normative paper/standard basis already used by the repo

1. `PAP-2020-USERCENTRIC`
   - user-centric handover with multiple Candidate Access Satellites (CAS)
   - explicit assumption that a terrestrial user can be covered by multiple LEO satellites simultaneously
2. `PAP-2022-SEAMLESSNTN-CORE`
   - conditional handover under multi-coverage
   - explicit "2+ covering satellites" context
3. `PAP-2024-MADRL-CORE`
   - mega-constellation, elevation-aware access/visibility thresholds, large candidate space
4. `PAP-2024-MCCHO-CORE`
   - multi-connectivity / overlap-aware handover state semantics
5. `PAP-2025-TIMERCHO-CORE`
   - geometry-assisted CHO timing and threshold semantics
6. `PAP-2025-DAPS-CORE`
   - candidate-rich coupling between handover and beam/scheduler decisions

### 3.3 Lower-layer package dependencies

This package depends on already-completed lower-layer packages for its baseline contracts:

1. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-view-sdd.md`
2. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-visual-correction-sdd.md`
3. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-god-view-composition-sdd.md`
4. `sdd/completed/implemented-specs/beamHO-bench-observer-sky-pass-conversion-sdd.md`

This package also depends on current pending work without replacing it:

1. `sdd/pending/beamHO-bench-real-trace-local-pass-replay-sdd.md`
2. `sdd/pending/beamHO-bench-beam-layout-sdd.md`

---

## 4. Scope Boundary

### In scope

1. define what "handover readable in the scene center" means under the accepted observer-sky composition
2. define a `handover focus corridor` as a readable region, not a single point target
3. define which runtime roles may be visually foregrounded:
   - serving
   - secondary candidate
   - CHO prepared target
   - just-executed target after serving change
4. define research-default, candidate-rich sensitivity, and demo/readability mode separation
5. define allowed event-focused replay/window selection behavior
6. define screen-space and state-transition validation gates for handover presentation
7. define ownership boundaries between runtime truth, display emphasis, and presentation labeling

### Out of scope

1. inventing synthetic satellites, fake candidate links, or non-physical motion
2. changing handover KPI formulas, scheduler logic, or baseline decision logic
3. replacing `real-trace` fixture selection policy owned by `RTLP`
4. replacing beam geometry/beam rendering policy owned by `beam-layout`
5. changing the accepted observer-sky visual-acceptance document itself
6. expanding current scope to multi-orbit LEO/MEO/GEO management

---

## 5. Problem Statement

The current project already supports:
1. observer-sky pass semantics (`rise -> pass -> set`)
2. display/candidate separation
3. primary accepted observer-sky composition
4. pass continuity and trajectory conversion
5. serving / secondary / prepared runtime states

But it still lacks one auditable contract for the user's stated requirement:
1. the frontend should make handover events easy to read near the center of the scene
2. without reintroducing the previously rejected "center-top cluster" behavior
3. and without overstating physical candidate density

If this requirement is solved incorrectly, the likely failure modes are:
1. too many satellites are pulled or prioritized into the top-center region
2. the visible sky collapses into only HO candidates
3. scene-center readability is achieved by display-only repositioning rather than physical event selection
4. demo/readability behavior is silently misrepresented as research-default geometry

This package defines a research-valid alternative:
1. the center of the primary view is treated as a readable event corridor
2. only a small number of handover-relevant actors are foregrounded there
3. the broader sky remains visible as physical context
4. any event-focused replay curation is explicit, deterministic, and labeled

---

## 6. Normative Requirements (MUST/SHALL)

### 6.1 Research Meaning of "Central Handover"

1. The project SHALL interpret "central handover presentation" as:
   - making a real serving-to-target transition readable in the primary observer-sky composition
   - not as maximizing satellite density at the exact screen center
2. The package SHALL optimize for handover-event readability, not zenith crowding.
3. A passing result SHALL preserve the observer-sky acceptance rule that satellites must remain time-staggered and spatially staggered.

### 6.2 Handover Focus Corridor

1. The package SHALL define a `handover focus corridor` in the accepted `observer-sky-primary` composition.
2. The corridor SHALL be:
   - a screen-space region or band suitable for reading a handover event
   - not a single fixed pixel target
   - not equivalent to "top-center cluster"
3. The corridor SHALL favor the high-elevation readable region of the sky while remaining outside any screen-space behavior that would fail the existing anti-cluster acceptance checks.
4. The corridor SHALL be owned by frontend composition/display policy, not by runtime orbital state.

### 6.3 Role-Based Foregrounding

The event presentation layer SHALL foreground only runtime-relevant actors:

1. current serving satellite
2. current secondary satellite when present
3. current CHO prepared satellite when present
4. newly selected target immediately after serving change
5. optionally one additional contender when a broader candidate context is required and physically supported

Rules:
1. foregrounding SHALL consume existing runtime truth only
2. foregrounding SHALL NOT fabricate new candidate roles
3. foregrounding SHALL NOT change handover ranking, trigger timing, KPI accumulation, or scheduler state

### 6.4 Display Set vs Candidate Set vs Event Set

1. The visible display set SHALL remain broader than the HO candidate set when the physical pool allows it.
2. The handover-event foreground set SHALL be a subset of the display set.
3. The package SHALL NOT solve readability by collapsing the entire visible sky to only `serving / secondary / prepared`.
4. Changes to `handover.params.candidateSatelliteLimit` SHALL NOT, by themselves, redefine the visible display set.

### 6.5 Candidate-Rich Physical Basis

1. When the research goal requires multiple simultaneous handover candidates, the implementation SHALL obtain them from:
   - source-backed constellation tiers
   - valid multi-plane geometry
   - observer-local pass retention
   - deterministic replay-window selection
2. The package SHALL prefer physically valid candidate diversity over visual crowding.
3. For synthetic walker mode, different orbital planes MAY contribute simultaneous candidates and this is explicitly in scope.
4. For real-trace mode, simultaneous candidates SHALL come from the retained physical TLE pool and replay window, not display fabrication.

### 6.6 Research-Default vs Candidate-Rich vs Demo/Readability Modes

The package SHALL distinguish three contracts:

1. `research-default`
   - continuous physical runtime behavior
   - no forced event-centric replay curation beyond already-approved baseline/bootstrap behavior
2. `candidate-rich sensitivity`
   - source-backed configuration intended to increase valid candidate diversity
   - may use higher constellation tiers, wider physical pools, or event-rich parameter selections
   - must be tagged as sensitivity/ablation, not baseline
3. `demo-readability`
   - deterministic presentation mode intended to show a real handover event in the focus corridor
   - may choose or replay an event-rich window
   - must remain explicitly labeled non-default presentation behavior

Rules:
1. `demo-readability` SHALL NOT silently replace `research-default`
2. `candidate-rich sensitivity` SHALL remain physically grounded
3. `demo-readability` SHALL NOT rewrite orbital positions or inject satellites

### 6.7 Event-Focused Replay / Window Selection

1. The package MAY define deterministic event-focused replay/window selection.
2. Event-focused selection SHALL choose a window where a real handover-relevant transition becomes readable inside the focus corridor.
3. Event-focused selection MAY use:
   - serving/target role presence
   - high-elevation count
   - candidate diversity
   - screen-space readability proxies derived from the same physical pool
4. Event-focused selection SHALL NOT:
   - modify orbital state
   - fabricate serving/target links
   - silently alter KPI semantics
5. If no physically valid event satisfies the requested readability target, the implementation SHALL preserve physical truth and expose that limitation.

### 6.8 Line / Beam / State Semantics

1. A passing handover presentation SHALL make the role transition legible through state overlays such as:
   - serving line
   - secondary line
   - prepared line
   - serving/candidate beam emphasis
2. The package SHALL prefer state contrast over actor count.
3. The package SHALL not require all visible satellites to receive beam or line emphasis.
4. Beam emphasis introduced by this package SHALL remain display-only unless separately governed by the beam-layout package.

### 6.9 Anti-Cluster Guard

1. The package SHALL preserve the accepted observer-sky anti-cluster semantics.
2. The focus corridor SHALL foreground a small number of event-relevant actors, not a large pack of satellites.
3. If multiple actors are emphasized simultaneously, they SHALL remain distinguishable by lane, azimuth separation, lifecycle stage, or link-state emphasis when the physical geometry supports it.
4. A passing result SHALL not visually regress into:
   - long-lived center-top crowding
   - synchronized point replacement
   - candidate-limit-driven top-N sky truncation

### 6.10 Ownership Boundary

1. Runtime truth remains owned by `src/sim/**`.
2. Focus-corridor definition, role-based display emphasis, and event readability checks remain owned by `src/viz/satellite/**` and scene wiring under `src/components/scene/**`.
3. Beam/readout styling remains renderer-only unless separately promoted into a source-traceable runtime contract.
4. This package SHALL NOT solve a frontend readability problem by writing new hidden state back into the runtime scenario unless the runtime contract is explicitly revised in a separate traceable package.

---

## 7. Intended Ownership Split

Future implementation SHOULD keep these responsibilities separated:

1. `src/sim/scenarios/**`
   - physical pool, serving state, candidate state, KPI truth
2. `src/viz/satellite/view-composition.ts`
   - focus corridor and composition-level screen-space policy
3. `src/viz/satellite/display-pipeline.ts`
   - event foreground selection from the broader display set
4. `src/viz/satellite/screen-space-acceptance.ts`
   - focus-corridor legibility checks and anti-cluster regression checks
5. `src/components/scene/SatelliteSkyLayer.tsx`
   - role-aware visual actor emphasis using existing pass/slot pipeline
6. `src/components/sim/ConnectionLines.tsx`
   - serving / secondary / prepared transition readability
7. `src/components/scene/BeamSkyLayer.tsx`
   - optional event-role beam emphasis only within display-only scope
8. `sdd/pending/beamHO-bench-real-trace-local-pass-replay-sdd.md`
   - real-trace event-rich replay-window selection inputs when real-trace mode is used

The display layer SHALL NOT become the owner of orbit generation or handover decision logic.

---

## 8. Validation Gates (Pass/Fail)

1. Gate OSHP-1: focus-corridor contract exists
   - the implementation defines a readable handover focus corridor in the primary observer-sky composition
   - it is explicit and not equivalent to exact center-point crowding
2. Gate OSHP-2: role-transition readability
   - serving, secondary, prepared, and post-switch states are visually distinguishable during a handover event
3. Gate OSHP-3: anti-cluster preservation
   - the same view still satisfies the existing observer-sky anti-cluster acceptance checks
4. Gate OSHP-4: display/candidate separation preserved
   - reducing HO candidate limits does not collapse the visible sky or the broader physical context
5. Gate OSHP-5: no fake density
   - all emphasized actors trace back to real runtime satellites and real role states
6. Gate OSHP-6: mode labeling
   - artifacts/HUD/runtime metadata indicate whether the run used `research-default`, `candidate-rich sensitivity`, or `demo-readability`
7. Gate OSHP-7: cross-mode applicability
   - the same event-presentation semantics work across `Synthetic Orbit`, `Starlink TLE`, and `OneWeb TLE`, even if event density differs
8. Gate OSHP-8: event-focused replay discipline
   - if a demo/readability mode is used, the selected event window is deterministic and does not silently alter physics or KPI logic

Manual acceptance remains required for frontend closure:

1. the user can identify the source satellite, target satellite, and transition point
2. the screen does not read as a center-top pack
3. the broader sky still reads as observer-centric physical context rather than a handover-only overlay

---

## 9. Delivery Breakdown

1. D1: define this package as a separate pending SDD and sync lifecycle docs
2. D2: define the `handover focus corridor` contract and role-based event foreground policy
3. D3: wire presentation mode separation:
   - `research-default`
   - `candidate-rich sensitivity`
   - `demo-readability`
4. D4: add event-legibility checks to observer-sky screen-space validation
5. D5: add scene-layer emphasis for serving / secondary / prepared / just-switched target
6. D6: add deterministic event-focused replay/window-selection contract where needed
7. D7: add lifecycle/reporting metadata and closure evidence

---

## 10. Open Questions

1. Should the focus corridor be scored primarily by:
   - high-elevation occupancy,
   - handover-state overlap,
   - or a weighted combination?
2. Should event-focused readability mode follow:
   - one UE-of-interest,
   - the first qualifying UE,
   - or a deterministic "best event in window" selector?
3. Should candidate-rich sensitivity become:
   - a canonical preset,
   - or remain only a runtime override family?
4. For synthetic mode, should event-rich selection prefer:
   - multi-plane diversity,
   - high-elevation overlap,
   - or stronger serving/target state contrast first?

---

## 11. Promotion Rule

This file moves to `sdd/completed/` only when:
1. D1-D7 are implemented,
2. the relevant observer-sky automated gates pass,
3. manual visual acceptance confirms the result is readable without center-top clustering,
4. lifecycle docs are synchronized,
5. and the implementation clearly separates research-default behavior from any demo/readability presentation mode.
