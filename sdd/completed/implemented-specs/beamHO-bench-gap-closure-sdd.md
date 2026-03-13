# beamHO-bench — TODO Gap Closure SDD (Active Pending)

**Version:** 0.2.0  
**Date:** 2026-03-02  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Close the remaining gaps between `todo.md` statements and current implementation status, without scope drift beyond current LEO-only roadmap.

Target gaps:
1. frequency-reuse behavior (`FR1` vs `reuse-4`) in runtime SINR/interference path.
2. gain-model-driven visualization path (`flat` / `bessel-j1`) in active scene rendering.
3. optional satellite GLB render path for M0 wording alignment.
4. comparison chart artifact export (machine-readable summary already exists).

---

## 2. Scope Boundary

1. Active scope remains LEO-only.
2. No multi-orbit runtime path is introduced in this SDD.
3. Existing canonical profile IDs remain unchanged (`case9-default`, `starlink-like`, `oneweb-like`).
4. Any KPI-impacting change must remain profile-sourced and traceable.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Frequency Reuse in Link Budget

1. Runtime SINR/interference calculation SHALL consume `profile.beam.frequencyReuse`.
2. `FR1` SHALL preserve current full-reuse behavior.
3. `reuse-4` SHALL apply deterministic 4-group interference partitioning with no hidden constants outside profile semantics.
4. Validation SHALL include at least one deterministic unit/integration case proving reuse mode affects interference path.

### 3.2 Gain Model Visualization

1. Visualization SHALL consume `profile.beam.gainModel` in render path.
2. At minimum, `flat` and `bessel-j1` SHALL render distinguishable footprint intensity behavior.
3. Visualization-only effects SHALL not mutate SimCore KPI computations unless explicitly defined and validated.

### 3.3 Satellite Rendering Mode

1. Scene SHALL support `primitive` and `glb` satellite render mode.
2. Default mode SHALL remain deterministic and lightweight for benchmark runs.
3. Missing GLB assets SHALL fail gracefully without breaking simulation execution.

### 3.4 Comparison Artifact Export

1. Baseline comparison export SHALL include chart artifact output in addition to existing CSV/JSON.
2. Chart export SHALL include profile/seed/tick metadata in filename or sidecar metadata.

---

## 4. Validation Gates (Pass/Fail)

1. Gate GC-1: frequency reuse runtime
2. deterministic tests prove `reuse-4` changes interference behavior vs `FR1` under fixed setup.
3. Gate GC-2: gain-model visualization route
4. render path switches by `gainModel` and passes smoke checks.
5. Gate GC-3: satellite render mode compatibility
6. `primitive`/`glb` modes both render without simulation regression.
7. Gate GC-4: artifact completeness
8. comparison export emits chart artifact and existing CSV/JSON outputs.
9. Gate GC-5: stage safety
10. `npm run validate:stage` remains green.

---

## 5. Delivery Breakdown

1. D1: frequency-reuse-aware interference model + deterministic unit coverage.
2. D2: gain-model-driven footprint rendering path + visual smoke checks.
3. D3: optional satellite GLB render mode + graceful fallback.
4. D4: comparison chart artifact export + metadata stamping.
5. D5: documentation sync (`todo.md` mapping, README, status references).

---

## 6. Closure Snapshot

As of 2026-03-02:
1. D1 implemented (`FR1`/`reuse-4` runtime interference partition + deterministic tests).
2. D2 implemented (`gainModel`-driven footprint intensity rendering path).
3. D3 implemented (`primitive`/`glb` satellite render mode + graceful fallback on GLB load failure).
4. D4 implemented (baseline comparison chart artifact export with metadata-rich filename).
5. D5 implemented (todo mapping + README/status reference synchronization).

Closure reference:
1. `sdd/completed/beamHO-bench-gap-closure-closure.md`
