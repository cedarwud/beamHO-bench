# beamHO-bench — Multi-Orbit Scheduler Backlog

**Version:** 0.2.0  
**Date:** 2026-03-01  
**Status:** Backlog Only / Not Implemented / Out of current LEO-only scope

---

## 1. Scope Statement

This document is a long-term reference for potential extension to LEO/MEO/GEO unified scheduling.

Current policy:
1. Do not treat this document as an active implementation target.
2. Do not add multi-orbit code paths in current roadmap phases.
3. Use this document only after an explicit scope-change decision.

---

## 2. Potential Goal (Future Only)

Extend simulation from LEO-only to unified LEO/MEO/GEO candidate management and scheduling.

---

## 3. Future Architecture Candidates

1. orbit-layer abstraction (`orbitClass`, visibility and latency traits)
2. cross-orbit candidate ranking and handover policy
3. unified scheduler for service continuity and load balancing

---

## 4. Future Data and Config Candidates

1. multi-orbit profile schema extension
2. per-orbit propagation/channel parameter blocks
3. artifact fields for orbit-class serving history

---

## 5. Reactivation Preconditions

This backlog item can be promoted to active pending only when all are true:
1. research scope is explicitly expanded beyond LEO.
2. roadmap document is updated and approved.
3. requirements and validation matrix are revised for multi-orbit gates.
4. compatibility plan proves no regression for existing LEO-only baselines.
