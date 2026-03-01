# beamHO-bench — RL Policy Plugin SDD (Pending)

**Version:** 0.1.0  
**Date:** 2026-03-01  
**Status:** Pending / Not Implemented

---

## 1. Goal

Introduce a pluggable RL decision interface without rewriting SimCore baseline logic.

---

## 2. Planned Architecture

1. `PolicyPlugin` interface (`init`, `observe`, `act`, `update`, `reset`)
2. `PolicyContext` schema (UE/satellite/beam/KPI/state machine fields)
3. `PolicyAction` schema (target sat/beam, hold, prepare, dual-link intent)
4. runtime adapter bridging policy actions to HO executor

---

## 3. Determinism and Traceability

1. deterministic seed for policy inference path
2. explicit `policy_id`, `policy_version`, `checkpoint_hash` in run artifacts
3. source mapping for reward and state feature definitions

---

## 4. Validation Plan

1. policy-off vs policy-on deterministic replay checks
2. baseline parity regression for unchanged scenarios
3. KPI comparison outputs with same profile/seed
