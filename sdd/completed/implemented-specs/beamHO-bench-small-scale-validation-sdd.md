# beamHO-bench — Small-Scale Channel Validation SDD

**Version:** 1.0.0  
**Date:** 2026-03-02  
**Status:** Implemented / Closure-Tracked

---

## 1. Purpose

Promote `smallScaleModel` from "implemented but lightly verified" to fully validation-gated and artifact-traceable behavior, aligned with current LEO-only roadmap.

Target gaps:
1. deterministic test coverage for `none` / `shadowed-rician` / `loo` runtime paths.
2. explicit runtime/export traceability for selected small-scale model and key parameters.
3. reproducible sensitivity execution template for small-scale model comparison.

---

## 2. Scope Boundary

1. Active scope remains LEO-only.
2. No multi-orbit runtime path is introduced.
3. No new DRL/RSMA/soft-HO runtime path is introduced.
4. Existing canonical profile IDs remain unchanged (`case9-default`, `starlink-like`, `oneweb-like`).
5. This SDD focuses on validation and traceability hardening, not physics-model expansion beyond current plugin set.

---

## 3. Normative Requirements (MUST/SHALL)

### 3.1 Runtime Behavior and Determinism

1. Runtime link-budget path SHALL consume `profile.channel.smallScaleModel`.
2. `none`, `shadowed-rician`, and `loo` SHALL produce deterministic outputs under fixed profile/seed/tick/context tuple.
3. `smallScaleParams` SHALL be consumed only from profile/defaulted assumption path with no hidden KPI-impacting constants.

### 3.2 Validation and Regression Coverage

1. Unit tests SHALL cover all three `smallScaleModel` branches.
2. Integration tests SHALL verify deterministic replay for at least one non-`none` model.
3. Validation suite SHALL include at least one case where small-scale model switch affects KPI/SINR distribution in a reproducible way.

### 3.3 Artifact and Traceability

1. Exported run metadata/source-trace SHALL expose active `smallScaleModel`.
2. Where applicable, artifact output SHALL include the model identifier and seed for reproducible plotting/analysis.
3. Source comments and source-map linkage for small-scale assumptions SHALL remain auditable.

---

## 4. Validation Gates (Pass/Fail)

1. Gate SS-1: runtime branch coverage
2. all `smallScaleModel` branches are executed by tests and pass.
3. Gate SS-2: deterministic replay
4. repeated runs with fixed input tuple produce identical artifacts for selected non-`none` model.
5. Gate SS-3: traceability completeness
6. run metadata/source-trace exposes small-scale model selection.
7. Gate SS-4: stage safety
8. `npm run validate:stage` remains green.

---

## 5. Delivery Breakdown

1. D1: add unit/integration tests for `none` / `shadowed-rician` / `loo`.
2. D2: add validation-suite case(s) for deterministic small-scale comparison.
3. D3: add metadata/source-trace fields for small-scale model selection.
4. D4: add reproducible comparison export template and docs references.
5. D5: sync `todo.md` mapping and status docs after gate pass.

---

## 6. Closure Snapshot

As of 2026-03-02:
1. D1 implemented (`unit-cases-small-scale.ts`, `integration-cases-small-scale.ts`).
2. D2 implemented (`VAL-SMALL-SCALE-MODEL-SWEEP` + blocking `small-scale-effect` check).
3. D3 implemented (`smallScaleModel/smallScaleParams` in metadata, source-trace, and manifest).
4. D4 implemented (small-scale comparison template export artifact + docs references).
5. D5 implemented (`todo.md`, validation matrix, implementation status and SDD index synchronization).

Closure reference:
1. `sdd/completed/beamHO-bench-small-scale-validation-closure.md`

---

## 7. TODO Mapping (from `/home/u24/papers/todo.md`)

This package maps to:
1. Layer C: "將 Shadowed-Rician/Loo 作為可切換進階通道模型".
2. Channel roadmap: "第二版：加入 Shadowed-Rician 或 Loo 作為小尺度衰落插件".
3. reproducibility/governance sections requiring deterministic reruns and auditable outputs.
