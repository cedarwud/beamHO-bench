# beamHO-bench — SDD v2 Roadmap (Pending)

**Version:** 0.1.0  
**Date:** 2026-03-01  
**Status:** Pending / Not Implemented

---

## 1. Purpose

Define the next-stage architecture after v1 (M0-M4), focused on:
1. RL policy plugin framework,
2. beam hopping + handover joint optimization,
3. multi-orbit (LEO/MEO/GEO) unified scheduling.

---

## 2. Scope

In scope:
1. plugin contracts and lifecycle for decision engines,
2. resource scheduling coupling between beam activation and HO decisions,
3. orbit-layer abstraction for cross-orbit candidate selection.

Out of scope:
1. production-scale distributed training platform,
2. carrier-grade real-time orchestration deployment.

---

## 3. Deliverables

1. RL plugin SDD (`beamHO-bench-rl-plugin-sdd.md`)
2. Joint optimization SDD (`beamHO-bench-joint-beamho-sdd.md`)
3. Multi-orbit SDD (`beamHO-bench-multiorbit-sdd.md`)
4. Updated requirements and validation matrix for v2 gates

---

## 4. Exit Criteria

This roadmap is complete only when:
1. all three sub-SDDs are implemented in code,
2. new validation suites are added and green in CI,
3. artifacts and traceability are reproducible end-to-end.
