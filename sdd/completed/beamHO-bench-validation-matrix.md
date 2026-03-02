# beamHO-bench — Validation Matrix

**Version:** 0.9.0  
**Date:** 2026-03-02  
**Status:** Active (CI-enforced validation suite)

---

## 1. Purpose

This matrix defines how simulation outputs are validated against baseline papers.  
Target is **trend and ordering consistency**, not exact numeric replication.

All profile conformance checks in this document assume:
1. canonical profile IDs from `sdd/completed/beamHO-bench-profile-baseline.md`
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
1. Determinism consistency: replay with identical profile + seed + overrides yields identical KPI/timeseries fingerprint.
2. Directional consistency: metric trends follow paper-reported direction.
3. Rank consistency: top/bottom strategy ordering is stable for tested sweep points.
4. Magnitude sanity: values fall into realistic range (no physically impossible spikes).
5. small-scale effect consistency: `none` vs non-`none` sweep shows at least one reproducible KPI/SINR delta.

State-aware KPI checks:
1. `rlf.state1` and `rlf.state2` both present and non-negative.
2. `hof.state2` and `hof.state3` both present and non-negative.
3. `hopp <= uho` always holds.

Academic-rigor checks:
1. no undocumented KPI-impacting hardcoded constants are present in active code path.
2. all engineering assumptions used in active path resolve to `ASSUME-*` source IDs.
3. benchmark-claim runs are marked `algorithm_fidelity=full`.

---

## 5. Required Validation Runs

Minimum run set for CI/nightly:
1. `VAL-A4-THRESH-SWEEP`
2. `VAL-A3-TTT-HOM-SWEEP`
3. `VAL-TIMER-ALPHA-SWEEP`
4. `VAL-MC-OVERLAP-SWEEP`
5. `VAL-STARLINK-TRACE-SMOKE`
6. `VAL-ONEWEB-TRACE-SMOKE`
7. `VAL-REALTRACE-MULTI-BASELINE-SMOKE`
8. `VAL-ONEWEB-MULTI-BASELINE-SMOKE`
9. `VAL-CHO-MCHO-FULLMODE-SMOKE`
10. `VAL-RL-POLICY-OFF-PARITY`
11. `VAL-RL-DETERMINISM-ON`
12. `VAL-RL-INVALID-ACTION-SAFETY`
13. `VAL-RL-REALTRACE-SMOKE`
14. `VAL-JBH-UNCOUPLED-PARITY`
15. `VAL-JBH-COUPLED-DETERMINISM`
16. `VAL-JBH-REALTRACE-COUPLED-SMOKE`
17. `VAL-JBH-CAPACITY-GUARD-SMOKE`
18. `VAL-JBH-HOPPING-PERIOD-SWEEP`
19. `VAL-JBH-OVERLAP-SWEEP`
20. `VAL-BG-BEAM-COUNT-SWEEP`
21. `VAL-SMALL-SCALE-MODEL-SWEEP`

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
10. `validation-gate-summary.json` (includes case-level pass/fail counts and check-level pass-rate stats)
11. `algorithm_fidelity` (`full` or `simplified`)
12. `playback_rate`
13. resolved `ASSUME-*` IDs used by active code path (empty if none)
14. `parameter-audit_*.json` (FR-028 runtime parameter audit payload)
15. `runtime-parameter-audit-summary.json` (suite-level FR-028 coverage aggregate for CI and appendix)
16. `validation-suite_*.json` case-level `trendPolicy` (`metric`, `direction`, optional `tolerance`) for directional-check provenance
17. `validation-suite.csv` (compact table for appendix and quick regression diff)
18. `profile_beams_per_satellite` and `profile_beam_layout` in batch summary CSV for beam-count comparability provenance
19. normalized KPI columns in batch summary CSV:
20. `normalized_throughput_per_total_beam_mbps`
21. `normalized_handover_rate_per_total_beam`
22. `small_scale_model`
23. `small_scale_params` (where applicable for selected model)

Validation gate policy:
1. blocking checks (`determinism`, `fidelity-mode`, `kpi-sanity`, `runtime-parameter-audit`, `link-state-consistency`, `small-scale-effect`) can fail the gate.
2. non-blocking diagnostic checks (`trend-directional`, `rank-consistency`) are reported in `warnings` and check pass-rate stats, but do not fail stage gate.
3. `trend-directional` is applied only to validation groups with explicit directional expectation; flat outcomes are acceptable if they do not violate configured direction.
4. directional expectation and metric are configured in `src/sim/bench/validation-definitions.ts` via `trendPolicy`.
5. deferred-scope policy (BG-6) is enforced by repo-policy/runtime-code scan and integration guards; active validation IDs must not introduce deferred runtime scope.

---

## 7. Academic-Rigor Compliance Workflow

1. Run static constant trace lint against SimCore modules used in the scenario.
2. Verify deterministic replay check passes for all validation cases.
3. Verify every flagged constant has profile-path source or `ASSUME-*` mapping.
4. Verify trend-directional and rank-consistency checks are reported and pass for applicable groups.
5. Verify runtime parameter audit summary has no missing FR-028 runtime keys.
6. Verify benchmark runs are `algorithm_fidelity=full`.
7. Verify runtime parameter audit check passes and has zero missing FR-028 keys.
8. Verify CHO/MC-HO cases pass link-state consistency (`prepared/secondary/event` coherence).
9. Verify repository policy check blocks forbidden tracked binaries under `papers/`.
10. Verify deferred-scope governance check is green (no active runtime RSMA/soft-HO/large-scale DRL path).
11. Mark compliance as `PASS` only when all checks pass.

---

## 8. Review Workflow

1. Execute validation suite.
2. Compare outputs against expected trend statements in Section 2.
3. Verify source trace completeness for KPI-critical parameter paths.
4. Verify each used `sourceId` resolves to canonical URL in lock/source catalog metadata.
5. Mark each paper row as `PASS`, `PARTIAL`, or `FAIL`.
6. Record deviations and suspected causes in a changelog entry.
