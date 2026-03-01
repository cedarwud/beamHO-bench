# beamHO-bench — Joint Beam Hopping + HO SDD (Pending)

**Version:** 0.1.0  
**Date:** 2026-03-01  
**Status:** Pending / Not Implemented

---

## 1. Goal

Model beam hopping and handover as a coupled optimization problem instead of independent modules.

---

## 2. Planned Architecture

1. beam scheduler service (beam on/off window, frequency/power allocation)
2. coupled HO evaluator using scheduler state as decision input
3. conflict resolver (capacity, overlap, and fairness constraints)

---

## 3. Key Metrics

1. throughput and interruption under scheduled beam availability
2. handover rate / HOF / RLF under hopping constraints
3. scheduler fairness and resource utilization

---

## 4. Validation Plan

1. uncoupled vs coupled mode A/B comparisons
2. sensitivity sweeps for hopping period and overlap ratio
3. trend consistency checks integrated into validation suite
