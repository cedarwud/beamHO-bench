# beamHO-bench — RL Policy Plugin SDD (Pending)

**Version:** 0.2.0  
**Date:** 2026-03-01  
**Status:** Pending / Implementation-ready spec

---

## 1. Goal and Scope

This document defines a pluggable RL decision interface that can be integrated without rewriting existing SimCore baseline logic.

Scope boundary:
1. Active research scope remains LEO-only.
2. RL is a decision module only, not a replacement for orbit/channel/link-budget/state-machine environment models.
3. Default benchmark claim path remains baseline/full-fidelity non-RL unless explicitly switched.

---

## 2. Normative Requirements (MUST/SHALL)

1. The system SHALL provide a `PolicyPlugin` contract with `init`, `observe`, `act`, `update`, and `reset`.
2. The system SHALL keep SimCore environment invariants unchanged when policy mode is enabled.
3. The system SHALL route RL actions through a runtime adapter before entering HO executor.
4. The system SHALL reject invalid actions deterministically and record rejection reasons in run artifacts.
5. The system SHALL emit `policy_id`, `policy_version`, and `checkpoint_hash` in run manifest when policy mode is active.
6. The system SHALL emit source-trace mapping for state features and reward definition IDs.
7. The system SHALL support deterministic replay with fixed `seed + profile + policy metadata`.
8. The system SHALL allow policy-off execution in the same scenario path for A/B parity.
9. The system SHALL support both `paper-baseline` and `real-trace` modes without introducing mode-specific hidden defaults.
10. The system SHALL preserve current NTPU default coordinate behavior and must not mutate observer defaults in this phase.
11. KPI-impacting policy features/constants SHALL be either profile-sourced or registered as `ASSUME-*` with rationale.
12. Key policy/runtime adapter modules SHALL include code comments with stable `sourceId` references.
13. Public-repo policy SHALL be preserved (no third-party full-text redistribution in code/assets/artifacts).

---

## 3. Planned Interfaces

Proposed contract shape (final path names decided at implementation):

```ts
export interface PolicyPlugin {
  init(ctx: PolicyInitContext): void | Promise<void>;
  observe(obs: PolicyObservation): void | Promise<void>;
  act(obs: PolicyObservation): PolicyAction | Promise<PolicyAction>;
  update?(transition: PolicyTransition): void | Promise<void>;
  reset(): void | Promise<void>;
}
```

Policy context minimum fields:
1. tick/time (`tick`, `timeSec`)
2. per-UE serving state (`state1/2/3`, serving sat/beam IDs)
3. candidate summary (`rsrp`, `sinr`, elevation, remaining visibility time)
4. scheduler-facing flags (`prepared`, `dualLinkCapable`) for CHO/MC-HO compatibility
5. profile/runtime metadata (`mode`, `profileId`, `seed`, `algorithm_fidelity`)

Policy action minimum fields:
1. `decisionType`: `hold | ho_execute | ho_prepare | dual_link_add | dual_link_release`
2. `targetSatId`, `targetBeamId` (nullable for `hold`)
3. `reasonCode` (stable string ID for audit/debug)
4. `confidence` (optional; must not affect determinism checks unless explicitly enabled)

---

## 4. Runtime Adapter Rules

1. Adapter SHALL translate `PolicyAction` to existing HO executor input format.
2. Adapter SHALL enforce guardrails before execution:
3. target satellite/beam must exist in current snapshot.
4. action must satisfy min-elevation and visibility constraints.
5. action must not violate enabled CHO/MC-HO state transition rules.
6. Invalid action handling SHALL be deterministic:
7. reject and fallback to `hold` for current tick.
8. append structured rejection event to `hoEvents` and audit output.

---

## 5. Determinism and Traceability

1. Determinism keys SHALL include:
2. `seed`
3. `profile_id`
4. `policy_id`
5. `policy_version`
6. `checkpoint_hash`
7. `runtime_config_hash`
8. Trace artifacts SHALL include:
9. `source-trace.json` mapping reward/state features to source IDs (`PAPER-*`, `STD-*`, `ASSUME-*`).
10. explicit `policy_mode` (`off|on`) and `policy_decision_count`.
11. Assumption governance SHALL apply to policy-derived constants exactly as existing SimCore policy.

---

## 6. Validation Gates (Pass/Fail)

1. Gate RL-1: deterministic replay
2. same scenario/profile/seed/policy metadata produces identical KPI + event digest.
3. Gate RL-2: baseline parity when policy disabled
4. policy-off path matches existing baseline outputs (within configured deterministic equality rule).
5. Gate RL-3: action safety
6. invalid actions are rejected with deterministic fallback and audit record.
7. Gate RL-4: artifact completeness
8. run output contains policy metadata and source-trace policy sections.
9. Gate RL-5: CI integration
10. validation suite includes RL-related cases and is green in stage gate.
11. Gate RL-6: dual-mode compatibility
12. RL integration passes in both `paper-baseline` and `real-trace` with same traceability guarantees.
13. Gate RL-7: constraints compliance
14. repo policy check and required CI artifact generation remain green.

---

## 7. Delivery Breakdown

1. D1: types/contracts + adapter scaffolding + policy-off no-op plugin
2. D2: artifact/trace schema extension + metadata wiring
3. D3: deterministic replay + parity + invalid-action integration tests
4. D4: validation-suite entries and CI gate integration
