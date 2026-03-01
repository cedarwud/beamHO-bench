# beamHO-bench — Requirements Specification

**Version:** 1.0.0  
**Date:** 2026-03-01  
**Status:** Baseline Implemented (validated by stage gate)

---

## 1. Purpose

This document defines functional and non-functional requirements derived from the latest `todo.md`, and provides milestone-level acceptance criteria.

---

## 2. Functional Requirements (FR)

| ID | Requirement | Priority | Acceptance Summary |
|---|---|---|---|
| FR-001 | System shall load and validate paper profile JSON via schema. | Must | Invalid profile rejected with explicit error path. |
| FR-002 | System shall support modes `paper-baseline` and `real-trace`. | Must | Both modes selectable and runnable. |
| FR-003 | System shall render Phase-0 static case9 scene (7 sats, 19 beams, UE points). | Must | M0 visual checklist passes. |
| FR-004 | System shall execute analytic orbit for case9 (`v=7.56 km/s`). | Must | Satellite movement and az/el/range outputs available. |
| FR-005 | System shall execute SGP4 propagation from TLE in real-trace mode. | Must | Starlink and OneWeb profile runs produce visible satellites. |
| FR-006 | System shall compute large-scale NTN channel using 3GPP TR 38.811 style lookup. | Must | RSRP/SINR generated for each UE-beam pair. |
| FR-007 | System shall support small-scale channel plugin (`none`, `shadowed-rician`, `loo`). | Should | Plugin toggle works without core rewrite. |
| FR-008 | System shall implement baselines: max-RSRP, max-elevation, max-remaining-time. | Must | Each baseline selectable and produces HO decisions. |
| FR-009 | System shall implement A3 and A4 event triggers with configurable parameters. | Must | A3/A4 sweeps executable in same scenario. |
| FR-010 | System shall implement CHO flow (prepare/execute, location/timer variants). | Must | CHO events emitted and counted. |
| FR-011 | System shall implement MC-HO flow with dual connectivity representation. | Should | Dual-link activation/release observable in events and viz. |
| FR-012 | System shall maintain 3-state HO machine (State1/2/3). | Must | Per-UE state transitions recorded each tick. |
| FR-013 | System shall compute KPIs including state-aware RLF/HOF splits. | Must | KPI report includes all required fields. |
| FR-014 | System shall export run outputs in JSON and CSV. | Must | Artifacts saved per run ID convention. |
| FR-015 | System shall support seeded deterministic runs for reproducibility. | Must | Repeat run with same config yields identical output. |
| FR-016 | System shall support multi-baseline benchmark execution in one scenario/seed. | Should | Batch run outputs comparable summary table/chart. |
| FR-017 | System shall recognize canonical profile IDs: `case9-default`, `starlink-like`, `oneweb-like`. | Must | Unknown profile ID fails fast with explicit error. |
| FR-018 | System shall read all 3GPP HO/RLF parameters from profile (`Qout/Qin/T310/N310/N311`, retransmission timers). | Must | Runtime dump confirms values are profile-sourced and persisted. |
| FR-019 | System shall not apply hidden global defaults that override profile values. | Must | Resolved run manifest has zero implicit override entries. |
| FR-020 | System shall provide profile sidecar source maps (`*.sources.json`) for canonical profiles. | Must | Each canonical profile has parameter-path to source ID mapping file. |
| FR-021 | System shall export `source-trace.json` per run for auditability. | Must | Run output contains source catalog checksum and resolved parameter-source map. |
| FR-022 | System shall annotate key algorithm modules with provenance comments using stable source IDs. | Should | Critical modules include file-level or block-level source IDs that match source catalog. |
| FR-023 | System shall maintain metadata lock files for standards and required papers, including canonical URL and checksum. | Must | `papers/standards/standards-lock.json` and `papers/sdd-required/papers-lock.json` are present and valid JSON. |
| FR-024 | System shall prevent third-party full-text binaries from being committed to public repo history. | Must | `.gitignore` rules block binaries under `papers/`; CI check fails on forbidden tracked file types. |
| FR-025 | System shall not keep KPI-impacting runtime constants as undocumented hardcoded literals in SimCore. | Must | Every KPI-impacting constant is either profile-sourced or mapped to `ASSUME-*` source ID with rationale. |
| FR-026 | System shall maintain an assumption registry for engineering assumptions (`ASSUME-*`) used in runtime logic. | Must | `source-trace.json` and source maps expose all `ASSUME-*` IDs referenced by code paths used in the run. |
| FR-027 | System shall provide research-grade full implementations for CHO and MC-HO, and mark simplified variants as non-default research baselines. | Must | Run metadata explicitly indicates `algorithm_fidelity` and benchmark profiles default to `full`. |
| FR-028 | System shall use the full configured RLF/HO parameter set in event and state-machine logic (`Qout/Qin/T310/N310/N311/L3/HARQ/RLC/RA`). | Must | Runtime parameter audit confirms all configured fields are consumed by the active logic path. |

---

## 3. Non-Functional Requirements (NFR)

| ID | Requirement | Priority | Target |
|---|---|---|---|
| NFR-001 | Determinism | Must | Bit-identical outputs for identical resolved config + seed. |
| NFR-002 | SimCore decoupling | Must | `src/sim/**` has no `react`/`three` dependencies. |
| NFR-003 | Config traceability | Must | Every run stores resolved profile and metadata manifest. |
| NFR-004 | Extensibility | Should | New baseline strategy can be added without changing Viz layer. |
| NFR-005 | Performance (v1 scale) | Should | 100 UEs, 7 active sats, 19 beams at 1s tick runs interactively. |
| NFR-006 | Validation readiness | Must | KPI definitions are fixed and shared across profiles. |
| NFR-007 | Documentation integrity | Must | SDD, protocol, and validation matrix stay consistent with `todo.md`. |
| NFR-008 | Research traceability | Must | Reviewer can trace KPI-critical parameters and logic back to a source ID within 5 minutes. |
| NFR-009 | Copyright safety | Must | Public repository includes only legal metadata pointers, not redistributed publisher full text. |
| NFR-010 | Research fidelity by default | Must | Default benchmark path uses full (non-simplified) CHO/MC-HO and profile/trace-backed constants. |
| NFR-011 | Assumption governance | Must | Any new engineering assumption requires `ASSUME-*` registration and validation-matrix coverage in same change set. |

---

## 4. Milestone Acceptance Gates

## M0 Gate
1. `case9-default` profile loads successfully.
2. Static 3D scene shows 7 satellites, 19 beam footprints, and UE markers.
3. Seeded UE placement is deterministic.
4. Resolved config proves no hidden fallback defaults.
5. Reference lock files exist and are checksum-valid.

## M1 Gate
1. Analytic orbit mode updates satellite positions over time.
2. azimuth/elevation/range are available per satellite.
3. `max-rsrp` baseline runs end-to-end and emits serving changes.

## M2 Gate
1. A3/A4 trigger engine supports parameter sweeps.
2. 3-state HO machine active with state-aware RLF/HOF counting.
3. KPI JSON + CSV exports generated per run.
4. A3/A4 and state-machine modules include provenance annotations.
5. Link-budget and state-machine KPI-impacting constants are profile-sourced or `ASSUME-*`-mapped.
6. Runtime audit confirms FR-028 parameter consumption coverage.

## M3 Gate
1. CHO timer/location flows integrated.
2. MC-HO dual connectivity behavior observable.
3. Multi-baseline benchmark runner produces comparison outputs.
4. Full-fidelity CHO/MC-HO path is available and set as benchmark default.
5. Simplified CHO/MC-HO path (if retained) is explicitly labeled and excluded from baseline claims unless selected.

## M4 Gate
1. SGP4 mode runs with `starlink-like` and `oneweb-like` profiles.
2. Visibility selection is stable and reproducible from TLE snapshots.
3. Baseline comparison works in real-trace mode.
4. `source-trace.json` emitted in both `paper-baseline` and `real-trace`.
5. Real-trace run passes the same hardcoded-constant and assumption-registry checks as paper-baseline mode.
6. Repository policy gate blocks forbidden tracked binaries in `papers/` and validates `.gitignore` policy patterns.

---

## 5. Out of Scope for Current Version

1. Full RL plugin lifecycle management as production feature.
2. Coupled beam-hopping and HO optimization.
3. Multi-orbit unified control (LEO+MEO+GEO).

---

## 6. Traceability to `todo.md`

This requirements spec concretizes:
1. Section 2 (environment standards)
2. Section 3 (handover baselines)
3. Section 4 (KPI/state machine)
4. Section 5 (phase roadmap)
5. Section 6/7 (reproducibility and milestones)

Reference documents:
1. `sdd/completed/beamHO-bench-sdd.md`
2. `sdd/completed/beamHO-bench-profile-baseline.md`
3. `sdd/completed/beamHO-bench-paper-traceability.md`
4. `sdd/completed/beamHO-bench-validation-matrix.md`
5. `sdd/completed/beamHO-bench-experiment-protocol.md`
6. `papers/sdd-required/papers-lock.json`
7. `papers/standards/standards-lock.json`
