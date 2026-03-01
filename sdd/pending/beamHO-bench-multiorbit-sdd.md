# beamHO-bench — Multi-Orbit Scheduler SDD (Pending)

**Version:** 0.1.0  
**Date:** 2026-03-01  
**Status:** Pending / Not Implemented

---

## 1. Goal

Extend simulation from LEO-only to unified LEO/MEO/GEO candidate management and scheduling.

---

## 2. Planned Architecture

1. orbit-layer abstraction (`orbitClass`, visibility and latency traits)
2. cross-orbit candidate ranking and handover policy
3. unified scheduler for service continuity and load balancing

---

## 3. Data and Config Plan

1. multi-orbit profile schema extension
2. per-orbit propagation and channel parameter blocks
3. artifact fields for orbit-level serving history

---

## 4. Validation Plan

1. single-orbit compatibility tests (must match v1 behavior)
2. multi-orbit smoke scenarios with deterministic replay
3. KPI decomposition by orbit class in output reports
