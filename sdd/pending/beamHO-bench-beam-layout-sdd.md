# beamHO-bench — Beam Layout and Beam Visualization SDD

**Version:** 0.2.0
**Date:** 2026-03-18
**Status:** Active Pending

---

## 1. Purpose

Define the implementation target for the beam layer so the project has one auditable answer to:

1. which beam geometry and overlap semantics are paper-derived
2. which frontend beam states are research-relevant versus `VISUAL-ONLY`
3. why beam rendering must not collapse to only serving/candidate satellites

This SDD updates the previous stub into a delivery spec that matches the current codebase structure and the local 50-paper corpus.

---

## 2. Source Basis

### 2.1 Normative sources for this package

| Area | Source basis | What is adopted here |
|---|---|---|
| Beam count/layout tiers | `PAP-2022-A4EVENT-CORE`, `PAP-2022-SEAMLESSNTN-CORE`, `PAP-2025-TIMERCHO-CORE`, `ASSUME-BEAM-COUNT-LAYOUT-TIERS` | canonical beam-count envelope `7 / 16 / 19 / 50` and hex-style contiguous layout family |
| Beam overlap semantics | `PAP-2024-MCCHO-CORE`, `PAP-2025-TIMERCHO-CORE` | overlap remains a physical parameter, not a view-only decoration |
| Beam footprint derivation | `PROJECT_CONSTRAINTS.md` formula rule, `ASSUME-BEAM-FOOTPRINT-GEOMETRY-COUPLING` | footprint diameter is derived from altitude and 3dB beamwidth, not independently hardcoded |
| Frequency reuse / per-beam interference | `PAP-2022-A4EVENT-CORE`, `PAP-2025-TIMERCHO-CORE`, `ASSUME-FREQUENCY-REUSE-MODES` | per-beam link evaluation and reuse-group-aware interference remain part of core sim logic |
| CHO / MC-HO beam semantics | `PAP-2022-SEAMLESSNTN-CORE`, `PAP-2024-MCCHO-CORE`, `PAP-2025-DAPS-CORE`, `PAP-2025-TIMERCHO-CORE` | serving, secondary, and prepared states are beam-level runtime states, not satellite-only labels |
| Observer-sky display separation | `docs/zh-TW/07-observer-sky-visual-acceptance.md`, `ASSUME-OBSERVER-SKY-DISPLAY-COVERAGE-POLICY`, `ASSUME-OBSERVER-SKY-PRIMARY-COMPOSITION` | visible frontend set must remain broader than HO candidate set when the physical/runtime pool is broader |

### 2.2 Informative-only adjacent literature

The local paper corpus also contains beam-hopping/resource-allocation papers that are useful for future extensions, but they are not yet formal runtime source IDs in `src/config/references/paper-sources.json`:

1. `PAP-2024-BEAM-MGMT-SPECTRUM`
2. `PAP-2025-MAAC-BHPOWER`
3. `PAP-2026-BHFREQREUSE`

These papers may inform future scheduler visualization and `bessel-j1-j3` adoption, but they are not normative for KPI-driving defaults until source-catalog registration and transfer justification are completed.

---

## 3. Scope

### In scope

1. Per-satellite beam geometry in SimCore
2. Per-beam link-budget and UE attachment semantics
3. Primary ground-footprint beam visualization wired to live snapshots
4. Secondary observer-sky highlight semantics for HO-relevant beams
5. Scheduler active/sleep beam distinction in coupled mode
6. Traceable separation between physical beam rules and `VISUAL-ONLY` rendering rules

### Out of scope

1. New beam-hopping algorithms or DRL scheduler redesign
2. Changing CHO / MC-HO protocol timing contracts
3. Introducing new physical parameters without existing `PAP-*`, `STD-*`, or registered `ASSUME-*`
4. Closure-tracking this package in lifecycle docs before implementation and validation exist

---

## 4. Code Reality This SDD Must Govern

Current repo status is mixed and this SDD is the normalization target:

1. Beam geometry already exists in `src/sim/scenarios/common/beam-layout.ts`.
2. Beam-aware link evaluation already exists in `src/sim/channel/link-budget.ts`.
3. Gain-model footprint bands already exist in `src/components/sim/beam-footprint-gain.ts`.
4. True per-beam ground rendering already exists in `src/components/sim/BeamFootprint.tsx`.
5. Live scene currently mounts `src/components/scene/BeamSkyLayer.tsx`, which is only a satellite-level observer-sky overlay keyed by serving/candidate satellite IDs.
6. `BeamSkyLayer` therefore does not yet satisfy the intended per-beam visualization contract.
7. The old stub dependencies were stale; this package no longer points to `src/viz/beam/beam-layout.ts` or `src/components/scene/BeamFootprint.tsx`.

---

## 5. Normative Design

### 5.1 Beam geometry and physical contract

1. `src/sim/scenarios/common/beam-layout.ts` remains the single source of truth for per-satellite beam placement.
2. Beam placement remains contiguous hex-style layout generated from the profile beam-count tier.
3. Beam footprint size must remain derived from altitude plus `beamwidth3dBDeg` using the project formula rule `D = 2h * tan(theta_3dB / 2)`.
4. `beam.overlapRatio` remains a physical parameter because it changes footprint spacing and handover feasibility, especially for `MC-HO` and timer-based CHO paths.
5. Beam count tiers continue to use the research envelope already established in parameter governance:
   - `7`
   - `16`
   - `19`
   - `50`

### 5.2 Beam link and attachment contract

1. Link evaluation remains per `satId + beamId`, not per satellite only.
2. Frontend beam emphasis must consume beam-level UE fields already present in `UEState`:
   - `servingBeamId`
   - `secondaryBeamId`
   - `choPreparedBeamId`
3. Satellite-only beam highlighting is insufficient because it cannot distinguish:
   - intra-satellite beam changes
   - overlap-driven preparation on a non-serving beam
   - scheduler blocking on a specific beam while the satellite itself remains visible

### 5.3 Frontend beam rendering layers

The project shall use two beam-related layers with different roles:

1. Primary beam layer: ground footprint layer
   - Uses real `beam.centerWorld` and `beam.radiusWorld`
   - Renders from `snapshot.satellites`, not only current serving/candidate beams
   - This is the main answer to "where are the beams?"
2. Secondary beam layer: observer-sky highlight layer
   - May remain as a lightweight sky cue for serving/secondary/prepared beam states
   - Must not be the only visible beam representation
   - Must be treated as a view aid, not the canonical beam geometry layer

### 5.4 Display-set policy

1. The primary ground footprint layer must not collapse to the current HO candidate set.
2. The minimum acceptable beam display set is:
   - all beams belonging to the current runtime satellite set in `snapshot.satellites`
3. This runtime-window beam scope is a `VISUAL-ONLY` scene-budget rule, not a new physical model assumption.
4. Observer-sky satellite display may still use the broader `observerSkyPhysicalSatellites` pool for pass readability; this does not require the ground footprint layer to draw every above-horizon physical satellite.
5. Serving/secondary/prepared states are highlight overlays on top of the broader beam field, not the rule that determines whether a beam exists visually.

### 5.5 Scheduler coupling semantics

1. If `snapshot.beamScheduler.summary.mode === "coupled"`, the beam layer must visually distinguish:
   - scheduler-active beams
   - scheduler-sleep beams
2. If the scheduler is `uncoupled`, the beam layer must not invent a fake active/sleep split.
3. The active/sleep distinction may use opacity, stroke, or ring intensity, but those knobs are `VISUAL-ONLY`.
4. The scheduler state source of truth is `snapshot.beamScheduler.states`, not ad hoc frontend ranking.

### 5.6 What is `VISUAL-ONLY`

The following remain frontend-only and must not be treated as paper-derived physical parameters:

1. colors
2. opacity multipliers
3. ring-band alpha scaling
4. max overlay count
5. camera framing for beam readability
6. animation easing or reveal timing

If any of these values ever starts affecting KPI interpretation or runtime selection, it must be promoted into an explicit traceable parameter instead of remaining a hidden visual constant.

### 5.7 Traceability guard

1. KPI-driving beam logic may only depend on registered `sourceId` values or registered `ASSUME-*` entries.
2. Adjacent literature from the local paper corpus may be cited in design notes, but not adopted as normative runtime basis until it is registered in `paper-sources.json`.
3. Current alias-style references such as `PAP-2023-BHFREQREUSE` or `PAP-2024-BHFREQREUSE` are not valid closure-ready provenance for this package and must be normalized before implementation closure.

---

## 6. Acceptance Gates

| Gate | Criterion |
|---|---|
| BL-1 | Live scene renders a primary per-beam footprint layer using real `beam.centerWorld` / `beam.radiusWorld`, not only a satellite-level sky ring |
| BL-2 | Changing `candidateSatelliteLimit` does not reduce the beam layer to only serving/candidate beams when the runtime satellite set is broader |
| BL-3 | Serving, secondary, and prepared emphasis is keyed by `beamId` as well as `satId` |
| BL-4 | Coupled mode visually distinguishes active vs sleep beams from `snapshot.beamScheduler.states`; uncoupled mode does not fabricate scheduler states |
| BL-5 | Observer-sky beam overlay, if retained, is explicitly secondary and not the sole beam visualization surface |
| BL-6 | Physical/KPI-affecting beam rules cite registered `sourceId` values only; unregistered adjacent literature remains informative-only |
| BL-7 | Implementation closure still requires `npm run lint`, `npm run test:sim`, `npm run build`, and `npm run validate:stage` |

---

## 7. Immediate Delivery Order

1. Wire the primary beam footprint layer into `MainScene` using `snapshot.satellites`.
2. Consume `snapshot.beamScheduler.states` so coupled mode can distinguish active/sleep beams.
3. Rework `BeamSkyLayer` so it uses beam-level HO state as a secondary cue, or remove it if the ground layer already covers the required semantics.
4. Add/update tests so beam display policy no longer assumes satellite-only highlighting.

---

## 8. Open Items

1. Lifecycle docs are still inconsistent: `sdd/pending/README.md` lists this file as active pending, while `sdd/completed/beamHO-bench-implementation-status.md` does not currently list it under active pending items.
2. Adjacent beam-hopping papers in the local corpus should be formally registered before any runtime default claims rely on them.
3. The current beam-gain and beam-sky provenance comments use non-normalized aliases and are not closure-ready.
