# beamHO-bench — Software Design Document

**Version:** 0.6.0  
**Date:** 2026-02-28  
**Status:** Working Draft (Aligned with latest `todo.md`)

---

## 1. Scope and Product Definition

### 1.1 Purpose

This SDD defines the target software architecture of **beamHO-bench**: a reproducible LEO multi-beam handover benchmark with 3D visualization support.

### 1.2 Naming and Repository Reality

- Product name: `beamHO-bench`
- Current repository folder: `beamHO-bench/`
- Historical project alias in discussions: `omni-scope`
- Policy:
1. Use real filesystem paths from `beamHO-bench/` in all implementation docs.
2. Use `beamHO-bench` as product/document/runtime naming.
3. Treat `omni-scope` as an alias only; avoid mixed identifiers in config and result artifacts.
4. Keep public repository traceability metadata-only for third-party references (no full-text redistribution).

### 1.3 Goals

1. Reproduce Layer-A academic baselines under standardized NTN settings.
2. Compare baseline and custom algorithms under identical scenario + seed.
3. Support two modes: `paper-baseline` (analytic orbit, case9-style) and `real-trace` (SGP4 + TLE).
4. Keep simulation core independent from rendering stack.

### 1.4 Deferred (from latest `todo.md`)

1. Layer-D RL policy plugins (as first-class runtime plugins)
2. Beam hopping + HO tightly coupled optimization in v1
3. Multi-orbit LEO+MEO+GEO unified scheduler

---

## 2. Architecture Overview

beamHO-bench uses 3 layers:

```
┌──────────────────────────────────────────────────────────┐
│ Config Layer                                             │
│ paper profile JSON · schema validation · runtime overrides│
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ SimCore Layer (Pure TS)                                 │
│ Orbit · Beam · Channel · HO Engine · KPI · Reporter      │
└───────────────────────┬──────────────────────────────────┘
                        │ SimSnapshot stream
┌───────────────────────▼──────────────────────────────────┐
│ Viz Layer (React + R3F)                                 │
│ useSimulation hook · 3D scene · HUD/Charts               │
└──────────────────────────────────────────────────────────┘
```

Core invariant:
1. `src/sim/**` has no React/Three imports.
2. Viz consumes only typed snapshots and events.

---

## 3. Target Code Organization

## 3.1 SimCore (`beamHO-bench/src/sim/`)

| Module | Target Path | Responsibility | Phase |
|---|---|---|---|
| `SimEngine` | `src/sim/engine.ts` | tick orchestration and lifecycle control | M1 |
| `OrbitAnalytic` | `src/sim/orbit/analytic.ts` | case9-style analytic pass (7.56 km/s) | M1 |
| `OrbitSGP4` | `src/sim/orbit/sgp4.ts` | TLE propagation and visibility | M4 (Phase 1b) |
| `BeamGeometry` | `src/sim/beam/geometry.ts` | 19-beam layout, footprint projection, overlap geometry | M0-M1 |
| `ChannelLargeScale` | `src/sim/channel/large-scale.ts` | FSPL + 3GPP TR 38.811 SF/CL lookup | M1 |
| `ChannelSmallScale` | `src/sim/channel/small-scale.ts` | Shadowed-Rician/Loo plugin | M3+ |
| `LinkBudget` | `src/sim/channel/link-budget.ts` | RSRP/SINR matrix + interference + noise | M2 |
| `HOBaselines` | `src/sim/handover/baselines.ts` | max-RSRP/max-elevation/max-remaining-time | M1 |
| `HOEvents` | `src/sim/handover/events.ts` | A3/A4 trigger evaluation with TTT/HOM/filter | M2 |
| `HOCHO` | `src/sim/handover/cho.ts` | CHO prepare/execute (location/timer) | M3 |
| `HOMCHO` | `src/sim/handover/mc-ho.ts` | dual connectivity and packet-duplication flow | M3 |
| `HOStateMachine` | `src/sim/handover/state-machine.ts` | State1/2/3 transitions + RLF/HOF detection | M2 |
| `KpiAccumulator` | `src/sim/kpi/accumulator.ts` | KPI updates per tick/event | M2 |
| `KpiReporter` | `src/sim/kpi/reporter.ts` | deterministic CSV/JSON outputs | M2 |
| `UEManager` | `src/sim/ue/manager.ts` | UE placement and mobility updates | M0-M1 |
| `RNG` | `src/sim/util/rng.ts` | seeded PRNG for reproducibility | M0 |
| `BenchRunner` | `src/sim/bench/runner.ts` | multi-baseline batch comparison | M3 |

## 3.2 Visualization (`beamHO-bench/src/components`, `src/hooks`)

| Module | Target Path | Responsibility | Phase |
|---|---|---|---|
| `useSimulation` | `src/hooks/useSimulation.ts` | bridge SimCore -> React | M1 |
| `SatelliteModel` | `src/components/sim/SatelliteModel.tsx` | GLB satellite rendering | M0 |
| `BeamFootprint` | `src/components/sim/BeamFootprint.tsx` | beam projection rendering | M0 |
| `UEMarkers` | `src/components/sim/UEMarkers.tsx` | instanced UE markers | M0 |
| `ConnectionLines` | `src/components/sim/ConnectionLines.tsx` | UE-satellite/MC links | M2 |
| `KpiHUD` | `src/components/sim/KpiHUD.tsx` | live counters and summary | M2 |
| `ComparisonChart` | `src/components/sim/ComparisonChart.tsx` | multi-baseline KPI comparison | M3 |
| `TimelineControls` | `src/components/sim/TimelineControls.tsx` | play/pause/step/speed | M1 |

## 3.3 Configuration (`beamHO-bench/src/config/paper-profiles`)

Implemented and treated as source of truth:
1. `paper-profile.schema.json`
2. `types.ts`
3. `case9-default.json`
4. `starlink-like.json`
5. `oneweb-like.json`
6. `README.md`
7. `loader.ts` (schema validate + merge runtime overrides + source-map validation)

Normative baseline values are pinned in:
1. `beamHO-bench/src/config/paper-profiles/case9-default.json`
2. `sdd/beamHO-bench-profile-baseline.md`

Traceability files:
1. `beamHO-bench/src/config/paper-profiles/case9-default.sources.json`
2. `beamHO-bench/src/config/paper-profiles/starlink-like.sources.json`
3. `beamHO-bench/src/config/paper-profiles/oneweb-like.sources.json`
4. `beamHO-bench/src/config/references/paper-sources.json`

Reference lock files (public-safe pointers):
1. `papers/sdd-required/papers-lock.json`
2. `papers/standards/standards-lock.json`

---

## 4. Profile and Configuration Resolution

## 4.1 Important Rule (aligned to latest `todo.md`)

No global hardcoded environment defaults shall override paper profiles.

`case9-default` is the baseline profile, not a hidden global constant.

## 4.2 Resolution Order

```
finalConfig =
  deepMerge(
    profileJson,          // required (case9-default/starlink-like/oneweb-like/...)
    runtimeOverrides,     // optional
  )
```

Validation:
1. Validate `profileJson` against `paper-profile.schema.json`.
2. Validate `runtimeOverrides` keys against schema paths.
3. Persist resolved config in run manifest for exact rerun.

## 4.3 Canonical Profile IDs

Use exactly:
1. `case9-default`
2. `starlink-like`
3. `oneweb-like`

## 4.4 Baseline Value Lock

`case9-default` is the normative v1 baseline. The following values must be loaded from profile, never hardcoded:

1. constellation: `600 km`, `19 beams`, `footprintDiameterKm=50`, `minElevationDeg=10`
2. channel: `carrierFrequencyGHz=2`, `eirpDensityDbwPerMHz=34`, `ueGTdBPerK=-33.6`, `noiseTemperatureK=290`
3. HO/RLF state machine: `Qout=-8 dB`, `Qin=-6 dB`, `T310=1000 ms`, `HARQ=7`, `RLC=3`

For the full parameter table and override policy, see:
1. `sdd/beamHO-bench-profile-baseline.md`

---

## 5. Data Contracts

All primary runtime types live in `src/sim/types.ts`.

```ts
export interface SimSnapshot {
  tick: number;
  timeSec: number;
  satellites: SatelliteState[];
  ues: UEState[];
  hoEvents: HOEvent[];
  kpiCumulative: KpiResult;
}

export interface SatelliteState {
  id: number;
  positionEcef: [number, number, number];
  positionLla: { lat: number; lon: number; altKm: number };
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  visible: boolean;
  beams: BeamState[];
}

export interface BeamState {
  beamId: number;
  centerLatLon: [number, number];
  radiusKm: number;
  connectedUeIds: number[];
}

export interface UEState {
  id: number;
  positionLatLon: [number, number];
  speedKmph: number;
  servingSatId: number | null;
  servingBeamId: number | null;
  rsrpDbm: number;
  sinrDb: number;
  hoState: 1 | 2 | 3;
  rlfTimerMs: number | null;
}
```

Traceability contracts (for governance and audit) are defined in:
1. `sdd/beamHO-bench-paper-traceability.md`

---

## 6. Simulation Pipeline

Per-tick order:
1. Orbit update (analytic or SGP4)
2. Beam footprint projection and overlap map
3. UE position update
4. Large-scale channel update (FSPL + SF/CL)
5. Optional small-scale fading plugin
6. RSRP/SINR matrix generation
7. L3 filtering
8. Handover decision + state machine transitions
9. KPI accumulation
10. Emit `SimSnapshot`

Default `timeStepSec = 1.0` (per profile, overrideable).

---

## 7. Handover Logic and State Machine

## 7.1 Baselines

1. `max-rsrp`
2. `max-elevation`
3. `max-remaining-time`
4. `a3`
5. `a4`
6. `cho`
7. `mc-ho`

## 7.2 3-State model

1. State 1: pre-event-entry
2. State 2: event met -> HO command delivered
3. State 3: HO command -> HO complete (RA stage)

RLF/HOF mapping follows `todo.md`:
1. `RLF by state`: state1, state2
2. `HOF by state`: state2, state3

## 7.3 Parameter Source

Use `profile.rlfStateMachine` as runtime source for:
1. `Qout/Qin`
2. `T310/N310/N311`
3. `L3 filter K`
4. `HARQ/RLC/RA timers`

No hidden hardcoded constants allowed in HO modules.

---

## 8. KPI Model

Required v1 KPIs:
1. `throughput`
2. `handover-rate`
3. `hof` (state2/state3 split)
4. `rlf` (state1/state2 split)
5. `uho`
6. `hopp`
7. `avg-dl-sinr`
8. `jain-fairness`

Export formats:
1. per-run `result.json`
2. per-run `timeseries.csv`
3. optional aggregate comparison `summary.csv`

---

## 9. 3D Visualization Contract

Scene elements (minimum):
1. Satellite meshes
2. Beam footprints
3. UE markers
4. UE-satellite connection lines
5. KPI HUD

Performance rules:
1. UE rendering uses instancing.
2. Snapshot-driven updates (not physics in render loop).
3. Optional LOD for satellite representation.

---

## 10. Milestones (Aligned with latest `todo.md`)

### M0 / Phase 0
1. Static case9 scene (7 satellites + 19-beam footprints + UE scatter)
2. Deterministic UE placement by seed
3. Profile loader available for `case9-default` with no hidden fallback defaults

### M1 / Phase 1a
1. Analytic orbit animation
2. Visibility and geometry metrics (az/el/range)
3. Basic baseline (`max-rsrp`) with serving updates

### M2 / Phase 2 + core of Phase 4
1. A3/A4 event logic
2. State1/2/3 HO machine
3. RLF/HOF state-aware counting
4. KPI report export

### M3 / Phase 3 + remaining Phase 4 + Phase 5 basics
1. CHO timer/location variants (v1 simplified runtime baseline available)
2. MC-HO dual connectivity flow (v1 simplified secondary-link baseline available)
3. Multi-baseline batch comparison

### M4 / Phase 1b complete
1. SGP4/TLE real-trace mode
2. `starlink-like` and `oneweb-like` profiles in benchmark runs

---

## 11. Verification Strategy

Three test levels:
1. Unit tests (SimCore modules)
2. Integration tests (10-100 tick deterministic scenarios)
3. Paper trend validation (see `sdd/beamHO-bench-validation-matrix.md`)

Minimum deterministic guarantee:
1. Same `(profileId, seed, overrides)` -> same outputs.

---

## 12. Reproducibility Governance

Experiment identity:
```
{scenario_id}_{profile_id}_{seed}_{baseline}
```

Run artifacts shall include:
1. resolved profile JSON
2. run metadata (`scenario_id`, `seed`, git commit hash, profile checksum)
3. final KPI summary
4. optional per-tick timeseries
5. optional TLE snapshot timestamp for `real-trace` runs
6. source trace snapshot (`source-trace.json`)

Detailed protocol is specified in:
- `sdd/beamHO-bench-experiment-protocol.md`

---

## 13. Risks and Mitigations

1. Risk: paper parameter ambiguity  
Mitigation: lock profile versions and store resolved configs per run.

2. Risk: Viz/SimCore coupling regression  
Mitigation: enforce contract at `useSimulation` boundary only.

3. Risk: profile drift across experiments  
Mitigation: schema validation + immutable run manifests.

4. Risk: inconsistent KPI definitions  
Mitigation: single KPI accumulator and explicit state-aware definitions.

---

## 14. Traceability to `todo.md`

| `todo.md` section | Covered in this SDD |
|---|---|
| 0) goals | Sections 1, 2 |
| 1) baseline layers | Sections 4, 10 |
| 2) initial environment | Sections 4, 6, 7 |
| 3) HO baselines | Section 7 |
| 4) KPI framework | Section 8 |
| 5) implementation roadmap | Section 10 |
| 6) reproducibility | Section 12 |
| 7) milestones | Section 10 |
| 8) deferred items | Section 1.4 |

---

## 15. Paper Traceability Standard

For reproducible research claims, all key implementation points must be traceable to standards/papers.

### 15.1 Mandatory Traceability Scope

1. profile parameters that impact radio/channel/HO behavior
2. decision logic in `A3/A4`, `CHO`, `MC-HO`, and state-machine transitions
3. KPI definitions and event classification rules
4. any non-trivial formula constants (thresholds, timers, margins)

### 15.2 Source ID Convention

Use stable source IDs:
1. standards: `STD-<ORG>-<DOC>-<SECTION>`
2. papers: `PAP-<YYYY>-<SHORTNAME>-<LOCATOR>`

Examples:
1. `STD-3GPP-TR38.811-6.6.2-1`
2. `PAP-2022-A4EVENT-Table2`
3. `PAP-2025-TIMERCHO-Sec4`

### 15.3 Code Comment Convention

Every key formula block shall include a short provenance comment:

```ts
// Source: STD-3GPP-TR38.811-6.6.2-1, PAP-2022-A4EVENT-Table2
// Rationale: qOut/qIn and SF/CL lookup follow baseline profile definitions.
```

For algorithm modules, include a file-level provenance header:

```ts
/**
 * Provenance:
 * - PAP-2022-A4EVENT-Sec3 (A3/A4 trigger behavior)
 * - PAP-2025-TIMERCHO-Sec4 (timer-aware CHO variant)
 */
```

### 15.4 Parameter Source Mapping Files

Each profile shall have a sidecar source map (`*.sources.json`) that binds parameter path to source IDs.

Minimum mapping entries:
1. `channel.sfClSource`
2. `rlfStateMachine.qOutDb`
3. `rlfStateMachine.qInDb`
4. `rlfStateMachine.t310Ms`
5. `handover.params.a4ThresholdDbm`
6. `handover.params.timerAlphaOptions`

### 15.5 Runtime Artifact for Audit

Each run shall export `source-trace.json` containing:
1. `profile_id`
2. `profile_checksum_sha256`
3. resolved parameter-to-source map
4. source catalog snapshot hash
5. canonical source links (`sourceId` -> URL)

Details are specified in:
1. `sdd/beamHO-bench-paper-traceability.md`

### 15.6 Copyright and Public-Repo Safety

1. Never commit third-party full-text binaries (publisher PDFs, standards ZIP/DOC/DOCX) into public history.
2. Commit only citation metadata and lock files with canonical URLs + checksums.
3. Use source IDs in code comments and experiment artifacts; do not embed copied publisher text.
4. Enforce this policy via `.gitignore` and CI checks for forbidden binary reference artifacts.
