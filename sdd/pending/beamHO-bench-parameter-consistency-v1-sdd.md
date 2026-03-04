# beamHO-bench — Research Parameter Consistency v1 SDD (Active Pending)

**Version:** 0.1.0  
**Date:** 2026-03-04  
**Status:** Active Pending / Not Implemented

---

## 1. Purpose

Define a common (non-paper-specific) consistency layer for research parameters so runtime overrides cannot silently produce physically unreasonable or methodologically misleading combinations.

Primary goal:
1. keep parameterized benchmarking flexible.
2. prevent invalid tuples from entering KPI-critical paths.
3. make all parameter coupling and bounds explicit, deterministic, and traceable.

---

## 2. Scope Boundary

1. Active scope remains LEO-only.
2. No multi-orbit (`LEO/MEO/GEO`) runtime path is introduced.
3. No RSMA/soft-HO runtime path is introduced.
4. No external black-box simulator dependency is introduced.
5. Canonical profile IDs remain unchanged (`case9-default`, `starlink-like`, `oneweb-like`).
6. This package governs parameter consistency only; it does not introduce new handover algorithms.
7. `NTPU` default coordinate remains fixed.

---

## 3. Problem Statement (Current Gaps)

Current code already has partial coupling, but consistency is incomplete:
1. `beam.beamsPerSatellite -> beam.layout` is coupled.
2. `smallScaleModel=none` hides temporal/Doppler toggles.
3. `altitudeKm` can change without corresponding orbital-speed consistency.
4. `footprintDiameterKm` and `beamwidth3dBDeg` are not currently governed as a coupled physical pair.
5. `activeSatellitesInWindow` lacks profile-context upper-bound governance in research-parameter layer.
6. `A3/A4 TTT` vs `timeStepSec` can create coarse tick-aliasing while still appearing configurable.

---

## 4. Normative Requirements (MUST/SHALL)

### 4.1 Consistency Rule Taxonomy

1. System SHALL classify rules into:
   - `hard constraint` (must reject or clamp).
   - `derived coupling` (must auto-derive linked values).
   - `soft warning` (allowed but explicitly flagged).
2. Rule evaluation SHALL be deterministic for the same tuple (`profile + selection + mode`).

### 4.2 Hard Constraints

1. Hard constraints SHALL block or normalize impossible combinations before simulation starts.
2. At minimum, v1 hard constraints SHALL include:
   - `constellation.activeSatellitesInWindow <= constellation.satellitesPerPlane` (for synthetic window profiles).
   - domain bounds from schema plus research-tier envelope checks used by the research panel.
3. Hard-constraint resolution outcome SHALL be exportable/auditable (no silent mutation).

### 4.3 Derived Coupling

1. Derived coupling SHALL support a common baseline mode where selected anchor parameters auto-derive linked runtime fields.
2. v1 SHALL include at least:
   - altitude-driven orbital-speed derivation option for `paper-baseline` synthetic orbit mode.
   - optional geometry consistency rule tying footprint/beamwidth/altitude via documented approximation path.
3. Derived values SHALL be reproducible and emitted in runtime metadata/source-trace output.
4. Any approximation constant introduced by coupling SHALL be source-traceable (`STD-*`, `PAP-*`, or registered `ASSUME-*`).

### 4.4 Soft Warnings

1. Soft warnings SHALL not alter KPI path by default.
2. Soft warnings SHALL identify methodologically risky tuples, including at minimum:
   - `TTT` smaller than effective tick granularity risk.
   - physically inconsistent altitude/speed/footprint combination when user overrides derived defaults.
3. Warning payload SHALL include:
   - rule ID.
   - severity (`info`/`warn`).
   - affected parameter IDs.
   - deterministic message code.

### 4.5 Consistency Policy Modes

1. System SHALL support two explicit policy modes:
   - `strict`: reject hard-violating tuple and disallow inconsistency-bypassing overrides.
   - `exploratory`: keep hard safety, allow selected soft-risk combinations with explicit warning trace.
2. Default research path SHALL be `strict`.
3. Policy mode SHALL be explicit in exported metadata and run bundle artifacts.

### 4.6 UI and Workflow Integration

1. Research parameter UI SHALL surface rule outcomes (applied derivation, clamp, warning) before run.
2. UI SHALL not expose consistency internals as arbitrary free-form sliders.
3. UI SHALL keep grouped research parameters and avoid reintroducing view-only controls into research parameter groups.

### 4.7 Traceability and Assumption Governance

1. Each new consistency rule SHALL declare a provenance source ID set.
2. If new assumptions are required, corresponding `ASSUME-*` entries SHALL be registered in the same change set with rationale.
3. At least one validation case/check SHALL cover every new `ASSUME-*` entry introduced by this package.

### 4.8 Enforcement Binding

1. Package SHALL remain compliant with:
   - `scripts/validate-academic-rigor.mjs`
   - `scripts/validate-module-structure.mjs`
   - `scripts/validate-repo-policy.mjs`
   - `scripts/validate-validation-suite.mjs`
   - `npm run validate:stage`
2. Package SHALL not weaken any existing hard gate.

---

## 5. Validation Gates (Pass/Fail)

1. Gate PC-1: hard constraints
2. invalid tuples are rejected or deterministically normalized with audit evidence.
3. Gate PC-2: derived coupling determinism
4. same input tuple yields identical derived overrides and signatures.
5. Gate PC-3: strict/exploratory policy behavior
6. strict rejects configured invalid cases; exploratory emits deterministic warnings.
7. Gate PC-4: metadata trace completeness
8. exported artifacts include consistency policy mode and rule outcomes.
9. Gate PC-5: no hidden constants
10. all new constants are profile- or source-registered (`ASSUME-*`) and traceable.
11. Gate PC-6: stage safety
12. `npm run validate:stage` passes with fresh required artifacts.
13. Gate PC-7: structure safety
14. file-size/module-split guardrails remain green.

---

## 6. Delivery Breakdown

1. D1: define consistency rule registry schema/types and deterministic evaluator API.
2. D2: implement hard constraints + derived coupling core in research-parameter runtime override path.
3. D3: implement policy-mode contract (`strict`/`exploratory`) and warning payload model.
4. D4: wire UI pre-run feedback and artifact/report trace fields.
5. D5: add integration/validation coverage and gate-contract checks.
6. D6: docs/status/index sync and closure preparation hooks.

---

## 7. Implementation Progress Backfill (D1~D6)

As of 2026-03-04:

| Delivery | Status | Evidence |
|---|---|---|
| D1 rule registry/evaluator contract | Planned | not started |
| D2 hard constraints + derived coupling path | Planned | not started |
| D3 policy-mode + warning model | Planned | not started |
| D4 UI/report trace integration | Planned | not started |
| D5 integration + validation contracts | Planned | not started |
| D6 docs/status/closure sync | In Progress | this active pending SDD introduced |

---

## 8. Constraint Binding (`PROJECT_CONSTRAINTS.md`)

This active pending package SHALL maintain:
1. LEO-only active scope and fixed NTPU default coordinate.
2. dual-mode compatibility (`paper-baseline` + `real-trace`).
3. real-trace compatibility with Starlink/OneWeb TLE workflow.
4. full-fidelity default research path; no hidden KPI-impacting constants.
5. source-traceability for all new coupling/consistency logic.
6. meaningful module split and maintainable architecture boundaries.
7. stage-gate freshness and validation-matrix/definition consistency.

---

## 9. TODO Mapping (from `/home/u24/papers/todo.md`)

This package maps to:
1. parameterized simulator usability without code-level manual edits.
2. meaningful parameter grouping with bounded, research-valid ranges.
3. prevention of invalid cross-parameter tuples entering benchmark comparisons.
4. preserving common baseline comparability while allowing controlled sensitivity exploration.

