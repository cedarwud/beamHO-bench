# beamHO-bench — SDD v2 Roadmap (Pending)

**Version:** 0.1.0  
**Date:** 2026-03-01  
**Status:** Pending / Not Implemented

---

## 1. Purpose

Define the next-stage architecture after v1 (M0-M4), focused on:
1. RL policy plugin framework,
2. beam hopping + handover joint optimization.

Scope boundary note:
1. active roadmap remains LEO-only.
2. multi-orbit (LEO/MEO/GEO) is kept as long-term backlog only and is not a near-term implementation target.

---

## 2. Scope

In scope:
1. plugin contracts and lifecycle for decision engines,
2. resource scheduling coupling between beam activation and HO decisions.

Out of scope:
1. production-scale distributed training platform,
2. carrier-grade real-time orchestration deployment,
3. multi-orbit (LEO/MEO/GEO) unified scheduling for the current research phase.

---

## 3. Deliverables

1. RL plugin SDD (`beamHO-bench-rl-plugin-sdd.md`)
2. Joint optimization SDD (`beamHO-bench-joint-beamho-sdd.md`)
3. Updated requirements and validation matrix for v2 gates
4. Optional long-term reference: `beamHO-bench-multiorbit-sdd.md` (backlog, not part of current roadmap exit)

---

## 4. Exit Criteria

This roadmap is complete only when:
1. RL plugin and joint optimization sub-SDDs are implemented in code,
2. new validation suites are added and green in CI,
3. artifacts and traceability are reproducible end-to-end.
