# beamHO-bench Observer-Sky Pass-Conversion Layer — Closure Report

**Date:** 2026-03-15
**SDD:** `sdd/completed/implemented-specs/beamHO-bench-observer-sky-pass-conversion-sdd.md`
**Supersedes:** `beamHO-bench-observer-sky-projection-selection-correction-sdd.md` (deleted)

---

## 1. Deliverable Completion Evidence

| Deliverable | Status | Code Points |
|---|---|---|
| D1: Scope freeze, old references removed | Complete | `display-pipeline.ts` — no `visual-actors.ts` or `pass-lane-layout.ts` references |
| D2: Camera rig + projection semantics | Complete | `view-composition.ts` primary camera (0,900,1200), FOV=38° |
| D3: `pass-composition-state.ts` | Complete | `src/viz/satellite/pass-composition-state.ts` — stable laneIndex, exit azimuth fix |
| D4: `pass-motion-policy.ts` | Complete | `src/viz/satellite/pass-motion-policy.ts` — real elevation trend phase |
| D5: `pass-trajectory-conversion.ts` | Complete | `src/viz/satellite/pass-trajectory-conversion.ts` — arc projection, lane offset |
| D6: Pipeline wiring + types | Complete | `display-pipeline.ts` orchestration; `SatelliteSkyLayer.tsx` live boundary; `types.ts` `PassActorMemory` |
| D7: `display-selection.ts` phase alignment | Complete | `pass-motion-policy.ts` overrides sin(azimuth) heuristic with real elevation trend |
| D8: Gate OSPC-1 (single-satellite arc) | Complete | `integration: primary observer-sky composition exposes rising, passing, and setting phases` |
| D9: Gates OSPC-2–6 (multi-sat, cross-mode) | Complete | All observer-sky integration tests pass (93/93) |
| D10: Gate OSPC-7 + OSPC-8 | Complete | `validate:stage` green; Playwright visual acceptance pass |

---

## 2. Validation Gate Evidence

| Gate | Result |
|---|---|
| OSPC-1: Single-satellite full pass | PASS (test:sim) |
| OSPC-2: Multi-satellite spatial separation | PASS (test:sim) |
| OSPC-3: Continuous motion | PASS (retained motion ≤ 0.32) |
| OSPC-4: Phase readability | PASS (test:sim) |
| OSPC-5: Display/candidate separation | PASS (test:sim) |
| OSPC-6: Cross-mode consistency | PASS (Synthetic + Starlink TLE + OneWeb TLE) |
| OSPC-7: Stage safety | PASS — `npm run lint && npm run test:sim && npm run build && npm run validate:stage` |
| OSPC-8: Manual acceptance | PASS — Playwright screenshot confirms satellite distribution across sky hemisphere, no center-top cluster, no pipeline JS errors |

**test:sim:** 93/93 (unit 27/27, integration 66/66)
**validate:stage:** 50/50 core checks, artifact freshness green

---

## 3. Key Technical Fixes

1. **Stable `laneIndex`**: Allocated once at actor entry (lowest free slot, sorted by satelliteId), preserved through exit linger — eliminates per-tick Z-axis shuffle from sort-order changes.
2. **Exit azimuth fix**: When transitioning to `exiting`, `predictedExitAzimuthDeg` is overridden to `lastAzimuthDeg` — eliminates cross-sky interpolation jump for mid-pass exits.
3. **`exitAnchor` lane offset**: Applied `applyLaneOffset` to `exitAnchor` to match `lastPos` depth lane — eliminates Z-delta per exiting tick.
4. **`entering` motion source**: Uses `geometry.azimuthDeg` (current) instead of `entryAzimuthDeg` — eliminates large motion-source gap when satellite has moved since entry tick.

---

## 4. Live Scene Wiring (D6)

`SatelliteSkyLayer.tsx` is now a pipeline boundary:
- Calls `buildObserverSkyDisplayPipeline()` per `snapshotTick`
- Carries `SatelliteDisplayContinuityMemory` across ticks via `useRef`
- `ObserverSkyFleet` renders GLB actors at pipeline `renderPosition`/`opacity`
- `ConnectionLines` receives `frame.renderPositionsById` (real satellite positions)
- `MainScene.tsx` passes `observerSkyPhysicalSatellites ?? satellites`

Old autonomous `SatelliteFleet` animation removed.

---

## 5. Traceability

- `src/viz/satellite/pass-composition-state.ts` — ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
- `src/viz/satellite/pass-motion-policy.ts` — ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
- `src/viz/satellite/pass-trajectory-conversion.ts` — ASSUME-OBSERVER-SKY-PROJECTION-CORRIDOR
- `src/viz/satellite/display-pipeline.ts` — D6 orchestration
- `src/components/scene/SatelliteSkyLayer.tsx` — D6 live scene boundary
- `src/sim/tests/unit-cases-observer-sky-composition.ts` — OSPC-1–4 unit coverage
- `src/sim/tests/integration-cases-observer-sky-composition.ts` — OSPC-1–6 integration coverage
