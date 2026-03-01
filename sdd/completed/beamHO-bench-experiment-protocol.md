# beamHO-bench — Experiment Protocol

**Version:** 0.5.0  
**Date:** 2026-02-28  
**Status:** Draft

---

## 1. Purpose

This protocol standardizes how experiments are configured, executed, stored, and rerun to guarantee comparability and reproducibility.

---

## 2. Experiment Identity

Canonical run key:
```
{scenario_id}_{profile_id}_{seed}_{baseline}
```

Examples:
1. `case9_a4sweep_case9-default_42_a4`
2. `starlink_smoke_starlink-like_2026_max-rsrp`

---

## 3. Configuration Rules

1. Every run starts from exactly one paper profile JSON.
2. Overrides are allowed, but must be explicit and persisted.
3. Resolved config is immutable after run start.
4. No hidden global defaults may alter runtime behavior.
5. Source references must resolve through metadata lock files, not full-text binaries in git.

Configuration precedence:
1. `profileJson`
2. `runtimeOverrides`

---

## 4. Seed Policy

1. Required `seed` for all stochastic components.
2. Seed drives UE placement.
3. Seed drives UE mobility randomness.
4. Seed drives optional fading randomness.
5. Same resolved config + seed must produce identical outputs.

Recommended standard seeds per scenario:
1. smoke: `[1, 2, 3]`
2. benchmark: `[11, 17, 23, 29, 31]`
3. paper-comparison: `[42, 314, 2718, 10007, 65537]`

---

## 5. Output Directory Layout

```
results/
  {scenario_id}/
    {profile_id}/
      seed_{seed}/
        {baseline}/
          manifest.json
          resolved-profile.json
          source-trace.json
          kpi-summary.json
          timeseries.csv
```

---

## 6. Mandatory Artifact Fields

## 6.1 `manifest.json`
1. `scenario_id`
2. `profile_id`
3. `baseline`
4. `seed`
5. `git_commit`
6. `started_at_utc`
7. `finished_at_utc`
8. `engine_version`
9. `profile_checksum_sha256`
10. `profile_schema_version`
11. `mode` (`paper-baseline` or `real-trace`)
12. `tle_snapshot_utc` (required only for `real-trace`)
13. `source_catalog_checksum_sha256`

## 6.2 `kpi-summary.json`
1. `throughput`
2. `handover-rate`
3. `hof` (`state2`, `state3`)
4. `rlf` (`state1`, `state2`)
5. `uho`
6. `hopp`
7. `avg-dl-sinr`
8. `jain-fairness`

## 6.3 `source-trace.json`
1. `scenario_id`
2. `profile_id`
3. `baseline`
4. `seed`
5. `profile_checksum_sha256`
6. `source_catalog_checksum_sha256`
7. `resolvedParameterSources`
8. `resolvedSourceLinks` (`sourceId` -> canonical URL)
9. `assumptions` (optional)

---

## 7. Comparison Protocol

For each comparison study:
1. Fix `scenario_id`, `profile_id`, and seed list.
2. Run all target baselines.
3. Aggregate mean and dispersion over seeds.
4. Report relative delta against a declared reference baseline.

Recommended reference:
1. case9 studies: `a3` or `max-rsrp` (explicitly declared)
2. CHO studies: `a3` as baseline unless paper demands otherwise

---

## 8. Sweep Protocol

Single-factor sweep only:
1. A4 threshold sweep: vary `a4ThresholdDbm`, keep others fixed.
2. A3 TTT/HOM sweep: vary one axis at a time.
3. Timer alpha sweep: vary `timerAlphaOptions`.
4. Overlap sweep for MC-HO: vary overlap ratio only.

Any multi-factor experiment must be explicitly labeled as factorial.

---

## 9. Re-run Procedure (One-Click Principle)

Re-run requires only:
1. stored `manifest.json`
2. stored `resolved-profile.json`

Procedure:
1. load manifest
2. load resolved profile
3. execute engine with same seed
4. compare checksum/hash of key outputs

Pass condition:
1. KPI summary fields identical
2. timeseries row count and keyed values identical
3. source-trace content identical except timestamps (if any)

---

## 10. Governance and Change Control

1. Any KPI definition change requires version bump and migration note.
2. Any profile schema change requires schema version bump.
3. Historical results are never overwritten; append new run directory.
4. Any change to baseline pinned values requires updating `beamHO-bench/src/config/paper-profiles/case9-default.json`.
5. The same baseline change must update `sdd/completed/beamHO-bench-profile-baseline.md` in the same commit.

Related spec:
1. `sdd/completed/beamHO-bench-paper-traceability.md`
2. `papers/sdd-required/papers-lock.json`
3. `papers/standards/standards-lock.json`
