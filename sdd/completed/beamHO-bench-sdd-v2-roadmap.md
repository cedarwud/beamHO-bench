# beamHO-bench — SDD v2 Roadmap (Pending)

**Version:** 0.2.0  
**Date:** 2026-03-01  
**Status:** Implemented / Closure-tracked roadmap

---

## 1. Purpose

Define the next implementation stage after v1 (M0-M4), with executable order and gate conditions.

Active target items:
1. RL policy plugin framework.
2. Joint beam hopping + HO optimization.
3. Baseline generalization closure for cross-paper reproduction workflows.

---

## 2. Scope Boundaries

In scope:
1. decision plugin contracts and lifecycle integration.
2. scheduler/HO coupling within existing LEO SimCore.
3. reproducible artifacts and validation gates for new features.
4. pending-gap closure for throughput model policy, rerun contract, Timer-CHO visualization acceptance, and beam-count benchmark comparability.

Out of scope:
1. multi-orbit (LEO/MEO/GEO) unified scheduling.
2. distributed RL training platform operations.
3. carrier-grade deployment orchestration.

Mandatory boundary rule:
1. v2 active roadmap remains LEO-only.

Global constraint binding (from `PROJECT_CONSTRAINTS.md`):
1. Keep NTPU default coordinate unchanged in this stage.
2. Keep compatibility with both `paper-baseline` and `real-trace` paths.
3. `real-trace` must remain compatible with Starlink/OneWeb TLE workflow and daily-update pipeline.
4. KPI-impacting logic must remain traceable (`sourceId` code comments + `source-trace.json` + profile source maps).
5. No hidden KPI-impacting constants; only profile paths or documented `ASSUME-*`.
6. Public-repo copyright policy must remain intact (`.gitignore` and repo policy checks).
7. Meaningful file splitting and architecture reviews are mandatory:
8. file length policy follows project thresholds (`<=500` normal, `501-650` warning, `>650` split required).
9. architecture review required at least once per milestone and before/after large feature merges.

---

## 3. Implementation Sequence

Phase V2-A:
1. deliver RL plugin contract, adapter, metadata, and deterministic replay gate.
2. merge only when RL gates are green in CI.

Phase V2-B:
1. deliver joint beam hopping + HO scheduling and coupled evaluator.
2. merge only when coupled A/B and sweep gates are green.

Phase V2-C:
1. refresh requirements/validation matrix and implementation status docs.
2. ensure all new KPI-impacting fields have traceability mapping.

Phase V2-D:
1. implement baseline generalization SDD items (`MORL/C-UCGM/LDAPS` role mapping policy, throughput model metadata, one-click rerun, Timer-CHO ToS visualization acceptance, 7/16/50 beam benchmark templates, deferred RSMA/DRL governance).
2. merge only when BG validation gates are green.
3. enforce BG-6 deferred policy checklist (`RSMA soft HO` and broad `large-scale DRL` remain out of active runtime paths).

Dependency rule:
1. V2-B depends on V2-A artifact extensions and validation harness.
2. V2-D depends on V2-A/V2-B metadata and validation infrastructure.

---

## 4. Deliverables

1. `beamHO-bench-rl-plugin-sdd.md` implemented in code.
2. `beamHO-bench-joint-beamho-sdd.md` implemented in code.
3. `beamHO-bench-baseline-generalization-sdd.md` implemented in code/process artifacts.
4. validation suite extensions for RL, joint scheduling, and baseline-generalization gates.
5. updated requirements and validation matrix references under `sdd/completed/`.
6. optional long-term reference only: `sdd/backlog/beamHO-bench-multiorbit-backlog.md` (not part of roadmap exit).

---

## 5. Exit Criteria (Pass/Fail)

1. RL plugin and joint optimization features are merged with tests.
2. `npm run validate:stage` is green after feature toggle on/off checks.
3. deterministic replay checks pass for new feature modes.
4. source-trace and run manifests include all new metadata fields.
5. no scope drift to multi-orbit components.
6. CI artifacts required by project constraints are generated and valid:
7. `dist/sim-test-summary.json`
8. `dist/validation-suite.json`
9. `dist/validation-gate-summary.json`
10. pending-gap six-point checklist is fully covered by completed SDD references.
11. BG-6 deferred policy checklist is green:
12. no RSMA/soft-HO runtime code paths in `src/`.
13. no broad large-scale/multi-paper DRL fusion runtime path in `src/`.
14. any reactivation must originate from explicit pending SDD entry.

---

## 6. Closure References

1. `sdd/completed/beamHO-bench-sdd-v2-roadmap-closure.md`
2. `sdd/completed/beamHO-bench-rl-plugin-closure.md`
3. `sdd/completed/beamHO-bench-joint-beamho-closure.md`
4. `sdd/completed/beamHO-bench-baseline-generalization-closure.md`
5. `sdd/completed/beamHO-bench-implementation-status.md`
