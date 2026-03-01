# beamHO-bench — Baseline Profile Specification

**Version:** 0.3.0  
**Date:** 2026-02-28  
**Status:** Draft

---

## 1. Purpose

This document pins profile-level baseline values used by `beamHO-bench` and clarifies which values are fixed by default versus experiment overrides.

This is the normative companion for:
1. `beamHO-bench/src/config/paper-profiles/*.json`
2. `sdd/completed/beamHO-bench-sdd.md`
3. `sdd/completed/beamHO-bench-experiment-protocol.md`

---

## 2. Canonical Profile Catalog

| Profile ID | Mode | Primary Usage | Orbit Source |
|---|---|---|---|
| `case9-default` | `paper-baseline` | Layer A baseline reproduction and early algorithm benchmarking | analytic orbit |
| `starlink-like` | `real-trace` | Layer B extension with large constellation behavior | TLE + SGP4 |
| `oneweb-like` | `real-trace` | Layer B extension for high-inclination constellation behavior | TLE + SGP4 |

Canonical IDs are immutable within v1.

---

## 3. Pinned `case9-default` Values (Normative)

### 3.1 Constellation and Geometry

1. `altitudeKm = 600`
2. `activeSatellitesInWindow = 7`
3. `satelliteSpeedKmps = 7.56`
4. `beamsPerSatellite = 19`
5. `footprintDiameterKm = 50`
6. `minElevationDeg = 10`
7. `timeStepSec = 1`

### 3.2 Link and Channel Baseline

1. `carrierFrequencyGHz = 2`
2. `bandwidthMHz = 20`
3. `eirpDensityDbwPerMHz = 34`
4. `ueGTdBPerK = -33.6`
5. `ueAntennaGainDbi = 0`
6. `noiseTemperatureK = 290`
7. `largeScaleModel = 3gpp-tr-38.811`
8. `smallScaleModel = none`
9. `sfClSource = 3GPP TR 38.811 Table 6.6.2-1`

### 3.3 RLF/HO State Machine Baseline

1. `qOutDb = -8`
2. `qInDb = -6`
3. `t310Ms = 1000`
4. `n310 = 1`
5. `n311 = 1`
6. `l3FilterK = 4`
7. `harqMaxRetx = 7`
8. `rlcMaxRetx = 3`
9. `preambleMsg3MaxRetx = 4`
10. `raResponseTimerSubframes = 5`
11. `contentionResolutionTimerSubframes = 40`

### 3.4 UE and Handover Baseline

1. `ue.count = 100`
2. `ue.distribution = uniform`
3. `ue.speedKmphOptions = [0, 3, 30, 60]`
4. baselines enabled: `max-rsrp`, `max-elevation`, `max-remaining-time`, `a3`, `a4`, `cho`, `mc-ho`
5. `a4ThresholdDbm = -100`
6. `homDb = 2`
7. `mtsSec = 1`
8. `timerAlphaOptions = [0.8, 0.85, 0.9]`

---

## 4. Override Policy

1. Any experiment may override profile values only via explicit `runtimeOverrides`.
2. Overrides must be persisted to run artifacts in resolved profile JSON.
3. Hidden defaults are prohibited.
4. If an override changes a pinned value in Section 3, the run must be tagged as sensitivity or ablation, not baseline.

---

## 5. Sensitivity Set (Recommended)

Common sensitivity dimensions for `case9-default`:
1. `minElevationDeg`: `10`, `20`, `35`
2. A4 threshold: `-100`, `-101`, `-102` dBm
3. `l3FilterK`: `0`, `4`
4. `homDb`: `2`, `3`
5. timer alpha: `0.8`, `0.85`, `0.9`

---

## 6. Change Control

Any baseline value change requires:
1. updating `beamHO-bench/src/config/paper-profiles/case9-default.json`
2. updating this file in the same commit
3. recording a migration note in experiment history

---

## 7. Source Anchors for Baseline Values

Use these source IDs in sidecar mapping files and code comments:
1. `STD-3GPP-TR38.811-6.6.2-1` for `sfClSource` and related large-scale NTN lookup
2. `PAP-2022-A4EVENT-CORE` for A3/A4 and state-machine-centric KPI setup
3. `PAP-2024-MCCHO-CORE` for MC/CHO overlap and dual-connectivity baseline behavior
4. `PAP-2025-TIMERCHO-CORE` for timer-aware CHO and alpha sweep settings
5. `PAP-2022-SEAMLESSNTN-CORE` for starlink-like extension context

Detailed traceability workflow is defined in:
1. `sdd/completed/beamHO-bench-paper-traceability.md`
2. `papers/sdd-required/papers-lock.json`
