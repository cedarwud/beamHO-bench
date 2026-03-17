# beamHO-bench — Beam Layout and SINR Visualization SDD

**Version:** 0.1.0
**Date:** 2026-03-15
**Status:** Active Pending

---

## 1. Purpose

Implement the multi-beam coverage layer: geometric beam layout (hex-ring or circular footprint), SINR calculation per UE per beam, and 3D beam footprint visualization in the scene.

This package is the first step toward the beam hopping and handover coupling work described in the project's research plan.

---

## 2. Scope

### In scope
- Beam layout geometry: per-satellite hex-ring or circular footprint generation from profile parameters
- SINR calculation pipeline: antenna gain model (Bessel J1/J3 or simplified Gaussian), path loss, interference
- `BeamFootprint` 3D visual component wired to live sim snapshot
- Beam-to-UE association display

### Out of scope
- Beam hopping scheduler (separate SDD)
- Handover–beam coupling (separate SDD)
- Changes to simulation handover contracts

---

## 3. Dependencies

- `src/viz/beam/beam-layout.ts` — existing geometry stub (to be extended)
- `src/components/scene/BeamFootprint.tsx` — existing visual stub (to be wired)
- `src/sim/scenarios/case9-analytic.ts` — satellite geometry source
- Paper sources: A4EVENT (PAP-2022-A4EVENT-CORE) eq. (1)–(9) for SINR baseline

---

## 4. Acceptance Gates

| Gate | Criterion |
|---|---|
| BL-1 | Beam footprint renders at correct world position for each satellite |
| BL-2 | SINR values computed per UE match A4EVENT eq. (1)–(9) numerically |
| BL-3 | No regression in test:sim (93/93) |
| BL-4 | validate:stage green |

---

## 5. Open Questions

1. Which antenna gain model to use as default: Bessel J1+J3 (SEAMLESSNTN) or simplified Gaussian?
2. Beam radius: from profile `beamRadiusKm` or derived from SINR target?
3. Number of beams per satellite: hex-ring N or single spot beam?

_This SDD is a stub. Detailed design will be filled in before implementation begins._
