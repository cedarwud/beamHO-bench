# beamHO-bench — Validation Matrix

**Version:** 0.5.0  
**Date:** 2026-02-28  
**Status:** Draft

---

## 1. Purpose

This matrix defines how simulation outputs are validated against baseline papers.  
Target is **trend and ordering consistency**, not exact numeric replication.

All profile conformance checks in this document assume:
1. canonical profile IDs from `sdd/beamHO-bench-profile-baseline.md`
2. no hidden runtime defaults outside resolved profile + explicit overrides

---

## 2. Core Paper Validation Set (Layer A + Layer B anchor)

| Paper | Profile | Key Scenario Knobs | Expected Validation Pattern |
|---|---|---|---|
| 2022_10 A4 Event | `case9-default` | A4 threshold sweep (`-100/-101/-102 dBm`), A3 baseline, L3 filter K | A4 outperforms A3 in HOF/RLF for moderate threshold; too-low threshold can degrade performance. |
| 2024_10 MC+CHO | `case9-default` (MC subset) | overlap ratio sweep, distance offset, MC on/off | MC-HO reduces handover instability and improves continuity in overlap-heavy setting. |
| 2025_08 Timer-CHO | `case9-default` | set1-7 style configs, `alpha` sweep (`0.8/0.85/0.9`) | Timer-CHO lowers UHO/HOPP vs aggressive A3-only setups while preserving SINR quality. |
| 2022_12 Seamless CHO (anchor) | `starlink-like` | larger constellation, CHO candidate selection | CHO sequence optimization should reduce redundant HO and signaling overhead trend-wise. |

---

## 3. Baseline Algorithm Comparison Matrix

| Baseline | Primary KPI | Secondary KPI | Typical Failure Mode |
|---|---|---|---|
| max-RSRP | throughput | handover-rate | ping-pong under rapid signal fluctuation |
| max-elevation | handover-rate | SINR | misses load/resource constraints |
| max-remaining-time | handover-rate | HOF | can underperform in instantaneous link quality |
| A3 | trigger responsiveness | UHO/HOPP | overly sensitive when TTT/HOM too small |
| A4 | HOF/RLF | throughput | threshold mis-setting causes late HO |
| CHO | HOF reduction | interruption time | over-preparation overhead if candidates excessive |
| MC-HO | interruption robustness | handover-rate | higher signaling/resource usage |

---

## 4. KPI Acceptance Rules

Global rules for pass:
1. Directional consistency: metric trends follow paper-reported direction.
2. Rank consistency: top/bottom strategy ordering is stable for tested sweep points.
3. Magnitude sanity: values fall into realistic range (no physically impossible spikes).

State-aware KPI checks:
1. `rlf.state1` and `rlf.state2` both present and non-negative.
2. `hof.state2` and `hof.state3` both present and non-negative.
3. `hopp <= uho` always holds.

---

## 5. Required Validation Runs

Minimum run set for CI/nightly:
1. `VAL-A4-THRESH-SWEEP`
2. `VAL-A3-TTT-HOM-SWEEP`
3. `VAL-TIMER-ALPHA-SWEEP`
4. `VAL-MC-OVERLAP-SWEEP`
5. `VAL-STARLINK-TRACE-SMOKE`
6. `VAL-ONEWEB-TRACE-SMOKE`

Each run must vary one factor only while keeping profile and seed policy controlled.

---

## 6. Run Metadata Requirements

For each validation run, store:
1. `scenario_id`
2. `profile_id`
3. `seed`
4. `baseline`
5. resolved profile JSON snapshot
6. `profile_checksum_sha256`
7. KPI summary JSON
8. optional timeseries CSV
9. `source-trace.json`

---

## 7. Review Workflow

1. Execute validation suite.
2. Compare outputs against expected trend statements in Section 2.
3. Verify source trace completeness for KPI-critical parameter paths.
4. Verify each used `sourceId` resolves to canonical URL in lock/source catalog metadata.
5. Mark each paper row as `PASS`, `PARTIAL`, or `FAIL`.
6. Record deviations and suspected causes in a changelog entry.
