# beamHO-bench — Beam Layout and Beam Visualization SDD

**Version:** 0.3.0
**Date:** 2026-03-18
**Status:** Active Pending

---

## 1. Purpose

Define the implementation target for the beam layer so the project has one auditable answer to:

1. which beam geometry and overlap semantics are paper-derived
2. which frontend beam states are research-relevant versus `VISUAL-ONLY`
3. how per-beam 3D visualization (cones + ground footprints) maps to the handover model

This SDD updates v0.2.0 to correct visualization design errors identified during implementation review against the 50-paper corpus.

### 1.1 Key corrections from v0.2.0

| v0.2.0 issue | Correction |
|---|---|
| No per-beam 3D cone specification | §5.3 now specifies per-beam cones from satellite to ground |
| No frequency-reuse color mapping | §5.4 now ties beam base color to `profile.beam.frequencyReuse` |
| No blending mode specification | §5.5 mandates `AdditiveBlending` so overlapping beams show interference |
| Display-set policy said "all runtime satellites" | §5.6 adds performance budget (top-N by elevation) |
| Missing active-beam-only cone rule | §5.3 specifies cones only for active/serving beams, not all beams |

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
| Per-beam cone visualization | `PAP-2026-BHFREQREUSE` (Bessel antenna pattern cone model), `PAP-2024-BEAM-MGMT-SPECTRUM` (per-beam spatial pointing) | each active beam is an independent cone from satellite to its ground footprint center |
| Additive blending for interference | `PAP-2022-A4EVENT-CORE` SINR interference term `Σ P_j·h_j`, `PAP-2026-BHFREQREUSE` co-channel interference | overlapping beam cones with additive blending visually approximate co-channel interference intensity |

### 2.2 Informative-only adjacent literature

The local paper corpus also contains beam-hopping/resource-allocation papers that are useful for future extensions, but they are not yet formal runtime source IDs in `src/config/references/paper-sources.json`:

1. `PAP-2024-BEAM-MGMT-SPECTRUM` — Earth-Fixed Cell grid, conflict graph (beam hopping model, not handover model)
2. `PAP-2025-MAAC-BHPOWER`
3. `PAP-2026-BHFREQREUSE` — SFR sub-band coloring, Bessel J₁+J₃ gain model

These papers may inform future scheduler visualization and `bessel-j1-j3` adoption, but they are not normative for KPI-driving defaults until source-catalog registration and transfer justification are completed.

### 2.3 Handover vs beam-hopping model distinction

This project uses the **handover model**: beam coverage areas move with the satellite (beam footprints are satellite-attached). This is distinct from the **beam-hopping model** where the ground is divided into Earth-Fixed Cells and beams hop between cells.

Normative handover papers (`A4EVENT-CORE`, `SEAMLESSNTN-CORE`, `TIMERCHO-CORE`, `MCCHO-CORE`, `DAPS-CORE`) model beams as satellite-attached. Earth-Fixed Cells are NOT required for this model and are out of scope for this SDD.

---

## 3. Scope

### In scope

1. Per-satellite beam geometry in SimCore (unchanged)
2. Per-beam link-budget and UE attachment semantics (unchanged)
3. **Per-beam 3D cone rendering** from satellite sky position to ground footprint
4. **Per-beam ground footprint** with gain-model-aware concentric rings
5. **Frequency-reuse color mapping** for beam base colors
6. **Additive blending** for overlapping beam interference visualization
7. Scheduler active/sleep beam distinction in coupled mode
8. Performance-budgeted display-set policy
9. Traceable separation between physical beam rules and `VISUAL-ONLY` rendering rules

### Out of scope

1. Earth-Fixed Cell grid (beam-hopping model, not handover model)
2. New beam-hopping algorithms or DRL scheduler redesign
3. Changing CHO / MC-HO protocol timing contracts
4. Introducing new physical parameters without existing `PAP-*`, `STD-*`, or registered `ASSUME-*`

---

## 4. Code Reality This SDD Must Govern

Current repo status after v0.2.0 partial implementation:

1. **Beam geometry** exists in `src/sim/scenarios/common/beam-layout.ts` — hex offsets, per-beam `centerWorld` / `radiusWorld`. Beam positions are satellite-attached (move with satellite). **Correct, no changes needed.**
2. **Beam-aware link evaluation** exists in `src/sim/channel/link-budget.ts`. **Correct, no changes needed.**
3. **Gain-model footprint bands** exist in `src/components/sim/beam-footprint-gain.ts` — Bessel J₁, J₁+J₃, and flat-top opacity profiles. **Correct, no changes needed.**
4. **BeamFootprint.tsx** is mounted in MainScene but has visualization errors:
   - Draws one aggregate cone per satellite instead of per-beam cones
   - Colors keyed by HO state only, not frequency reuse
   - Uses `NormalBlending`, overlap not visible
   - Ground footprints are correct (per-beam, gain-band rings)
5. **BeamSkyLayer.tsx** remains as observer-sky highlight. **No changes needed.**

---

## 5. Normative Design

### 5.1 Beam geometry and physical contract (unchanged from v0.2.0)

1. `src/sim/scenarios/common/beam-layout.ts` remains the single source of truth for per-satellite beam placement.
2. Beam placement remains contiguous hex-style layout generated from the profile beam-count tier.
3. Beam footprint size must remain derived from altitude plus `beamwidth3dBDeg` using the project formula rule `D = 2h * tan(theta_3dB / 2)`.
4. `beam.overlapRatio` remains a physical parameter because it changes footprint spacing and handover feasibility.
5. Beam coverage areas are satellite-attached — they move with the satellite. This is correct for the handover model.

### 5.2 Beam link and attachment contract (unchanged from v0.2.0)

1. Link evaluation remains per `satId + beamId`, not per satellite only.
2. Frontend beam emphasis must consume beam-level UE fields already present in `UEState`:
   - `servingBeamId`
   - `secondaryBeamId`
   - `choPreparedBeamId`

### 5.3 Scene-focus serving-satellite rendering (REVISED)

Current frontend beam rendering shall be constrained to the satellite that actually covers the scene focus point.

1. **No sky-to-ground cone rendering** in the default frontend path.
   - Reason: the previous cone visualization visually exaggerated off-nadir steering and misread as satellites arbitrarily aiming at the scene center.
2. **Scene focus point** is the ground-projected `UAV`/scene-center anchor in the 3D scene (`VISUAL-ONLY`).
3. **Serving-beam selection for visualization**:
   - inspect visible beams only
   - a beam qualifies only if its ground footprint contains the scene focus point
   - among qualifying beams, choose the one with the smallest normalized center offset `distance_to_focus / beam.radiusWorld`
   - tie-breaker: higher satellite elevation
4. **Display scope**:
   - render beam footprints only for the parent satellite of the selected serving beam
   - if no visible beam covers the focus point, render no beam footprint layer
5. **Highlight semantics**:
   - the selected serving beam is rendered brighter with a solid outer boundary
   - non-serving beams of the same satellite are rendered more faintly
6. This selection is **frontend-only** and does **not** change runtime HO/KPI semantics.

### 5.3.1 Explicit non-default prototype cone + SINR mode (NEW)

The repo may provide a **user-opt-in prototype mode** for faster visual iteration, but it must remain outside the research-default path.

1. **Mode boundary**:
   - default mode remains the §5.3 scene-focus footprint path
   - prototype mode must be explicitly labeled `prototype` / `non-default`
   - prototype mode must never silently replace the default beam layer
   - when the explicit prototype toggle is enabled, prototype mode may replace the default footprint renderer for that session so the visual language is clearly distinct
   - prototype mode may also switch to a beam-readable non-primary camera composition while the research-default mode remains bound to the accepted observer-sky primary composition
2. **Prototype cone scope**:
   - reuse the same scene-focus serving-satellite selection from §5.3
   - render per-beam cones only for the selected satellite
   - cone apex uses the current satellite sky render position from the observer-sky display layer
   - cone base uses the beam's existing `centerWorld` / `radiusWorld` geometry from SimCore
   - prototype mode owns its own ground ring, center line, and compact beam label rendering rather than inheriting the default footprint layer
   - prototype mode may render a shortened near-ground beam shell plus a separate guide line to the true sky satellite position when full-length cones are unreadable in observer-sky view
   - prototype mode may remap beam targets into a scene-focus-centered visual cluster to approximate leo-style multi-beam layout, provided the mapping is explicitly visual-only and radio metrics still come from the true SimCore beam state
3. **Prototype SINR display**:
   - SINR/RSRP labels or HUD values must come from the existing link-budget path
   - the display probe is the scene-focus point (`UAV` ground projection) unless a later SDD promotes a different probe definition
   - renderer geometry must not be used to derive radio metrics
4. **Runtime isolation**:
   - prototype mode is display-only
   - it must not change HO candidate sets, scheduler state, KPI accumulation, or UE attachment semantics
5. **Prototype-only rendering allowances** (`VISUAL-ONLY`):
   - cone opacity, segment count, line style, label placement, panel layout, and depth-test policy
   - prototype mode may lift the visual beam target slightly above the terrain to preserve readability in observer-sky view, as long as radio metrics still come from SimCore geometry
   - prototype mode may use an explicit visual cone/ring radius multiplier, separated from physical `radiusWorld`, when the physical beam radius is too small to read in the observer-sky composition
   - when a scheduler sleep beam is present, prototype mode may dim or ghost the cone, but must not rewrite scheduler state
6. **Failure behavior**:
   - if no visible beam covers the scene focus point, prototype mode renders nothing
   - if no valid link-budget sample exists for a beam, prototype mode may still draw the beam geometry but must display radio metrics as unavailable rather than fabricating values

### 5.4 Frequency-reuse color mapping (NEW)

Beam base color is determined by `profile.beam.frequencyReuse`, not by HO state.

| `frequencyReuse` | Color rule | Rationale |
|---|---|---|
| `FR1` | All beams same color (`#38bdf8` sky-blue) | Full frequency reuse — all beams share same spectrum |
| `reuse-4` | 4-color cycle based on `beamIndex % 4` | 4 sub-bands; adjacent beams use different frequencies |
| `custom` | Falls back to `FR1` single-color | No standard color mapping |

**reuse-4 color palette** (`VISUAL-ONLY`):

| Group | Color | Hex |
|---|---|---|
| 0 | Orange | `#ff8844` |
| 1 | Cyan | `#44aaff` |
| 2 | Lime | `#88dd44` |
| 3 | Magenta | `#dd44aa` |

**HO state is an overlay**, not the base color. Serving/secondary/prepared states are indicated by:
- Cone opacity boost (serving = 0.3 vs others = 0.12)
- Center line style (solid vs dashed)
- Ground footprint ring brightness

This keeps frequency reuse visible at all times while HO state is still distinguishable.

### 5.5 Additive blending for overlap interference (NEW)

1. All beam cones and ground footprint meshes shall use `THREE.AdditiveBlending`.
2. This causes overlapping beam regions to appear brighter — a natural visual approximation of co-channel interference (SINR denominator `Σ P_j·h_j`).
3. In `FR1` mode (all beams same frequency), every overlap region glows brighter — showing that all co-channel beams contribute interference.
4. In `reuse-4` mode, same-color overlaps glow while different-color overlaps blend — showing that only same-frequency beams interfere.
5. This is `VISUAL-ONLY` — it does not affect SINR computation.

### 5.6 Display-set policy (revised)

1. The current beam layer does **not** render all visible satellites.
2. The display set is a single satellite:
   - the visible satellite whose beam footprint covers the scene focus point under §5.3
3. The beam layer shall therefore not collapse to HO candidate satellites; it collapses only to the single scene-focus serving satellite for this visual mode.
4. If no visible beam covers the scene focus point, the beam layer stays empty rather than inventing a fallback beam.

### 5.7 Scheduler coupling semantics (unchanged from v0.2.0)

1. If `snapshot.beamScheduler.summary.mode === "coupled"`, the beam layer must visually distinguish:
   - scheduler-active beams (cones rendered, full opacity ground rings)
   - scheduler-sleep beams (no cone, dimmed ground rings at `× 0.3` opacity)
2. If the scheduler is `uncoupled`, the beam layer must not invent a fake active/sleep split.
3. The scheduler state source of truth is `snapshot.beamScheduler.states`, not ad hoc frontend ranking.

### 5.8 Ground footprint rings (clarified)

1. Each beam retains per-beam concentric ring rendering on the ground plane.
2. Ring opacity profile is driven by `profile.beam.gainModel` via `resolveBeamFootprintBands()`:
   - `bessel-j1`: Bessel J₁ pattern — bright center, decaying rings, edge ring
   - `bessel-j1-j3`: Bessel J₁+J₃ — sharper center, more pronounced sidelobes
   - `flat`: uniform fill with thin border
3. Ring color matches the beam's frequency-reuse base color (§5.4).
4. Ground rings use `AdditiveBlending` so overlapping beam footprints show interference (§5.5).
5. Y offset `+2` above ground model to prevent z-fighting (`VISUAL-ONLY`).

### 5.9 What is `VISUAL-ONLY`

The following remain frontend-only and must not be treated as paper-derived physical parameters:

1. Cone/ring colors and opacity multipliers
2. `AdditiveBlending` mode
3. `MAX_DISPLAY_SATELLITES` budget
4. Cone segment count, line widths, dash patterns
5. Ground Y offset for z-fighting avoidance
6. Camera framing for beam readability
7. Animation easing or reveal timing

### 5.10 Traceability guard (unchanged from v0.2.0)

1. KPI-driving beam logic may only depend on registered `sourceId` values or registered `ASSUME-*` entries.
2. Adjacent literature from the local paper corpus may be cited in design notes, but not adopted as normative runtime basis until it is registered in `paper-sources.json`.

---

## 6. Acceptance Gates

| Gate | Criterion |
|---|---|
| BL-1 | Default frontend beam rendering does not use satellite-to-ground cones |
| BL-2 | Beam visibility requires actual scene-focus footprint containment, not generic HO-state membership |
| BL-3 | Only the selected scene-focus serving satellite renders beam footprints |
| BL-4 | The selected serving beam is brighter/solid-lined than sibling beams of the same satellite |
| BL-5 | Beam base color follows `profile.beam.frequencyReuse`: single color for `FR1`, 4-color cycle for `reuse-4` |
| BL-6 | `AdditiveBlending` is used on ground rings so overlapping rings within the serving satellite remain legible |
| BL-7 | Coupled scheduler mode dims sleep beams from `beamScheduler.states`; uncoupled mode does not fabricate states |
| BL-8 | Ground footprint rings retain gain-model-aware bands from `resolveBeamFootprintBands()` |
| BL-9 | No Earth-Fixed Cell grid is introduced (handover model, not beam-hopping model) |
| BL-10 | `npm run lint && npm run test:sim && npm run build` pass |
| BL-P1 | Any cone + SINR visualization is behind an explicit non-default prototype mode toggle |
| BL-P2 | Prototype SINR display is sourced from the existing link-budget path, not renderer-derived geometry |
| BL-P3 | With prototype mode disabled, default beam behavior remains the §5.3 scene-focus footprint path |

---

## 7. Implementation Files

| File | Action |
|---|---|
| `src/components/sim/BeamFootprint.tsx` | **Rewrite** — scene-focus serving-satellite-only ground footprints; no sky-to-ground cones |
| `src/components/sim/BeamPrototypeLayer.tsx` | **New** — non-default per-beam cone overlay + focus-probe SINR display |
| `src/viz/satellite/beam-visual-selection.ts` | **New** — scene-focus serving-beam selection helper |
| `src/components/sim/beam-footprint-gain.ts` | **No change** — gain band profiles are correct |
| `src/components/scene/MainScene.tsx` | **Minor** — wire scene-focus serving-beam rendering, explicit prototype mode toggle, and keep research-default as the default beam path |
| `src/components/scene/BeamSkyLayer.tsx` | **No change** — retained on disk but not mounted in the default scene path |
| `src/sim/scenarios/common/beam-layout.ts` | **No change** — beam geometry is correct |

---

## 8. Open Items

1. `UEState.servingSatId` is currently `null` at runtime in the visualization snapshot — cone HO-state overlay cannot function until this data flow is fixed. Fallback: show all active beams with uniform opacity until serving data is available.
2. Adjacent beam-hopping papers in the local corpus should be formally registered before any runtime default claims rely on them.
3. The `reuse-4` beam-index-to-color-group mapping assumes simple modulo assignment. If the hex layout has a specific frequency plan (e.g., 4-color graph coloring to minimize adjacent same-frequency), the mapping should be updated to match.
