// Inlined by esbuild in test builds to cap trajectory cache window (OOM prevention).
declare const __SIM_TEST_TRAJ_WINDOW_SEC__: number | undefined;

import type { PaperProfile } from '@/config/paper-profiles/types';
import { createRuntimeParameterAuditSession } from '@/sim/audit/runtime-parameter-audit';
import {
  runHandoverBaseline,
  type RuntimeBaseline,
  type TriggerMemoryStore,
} from '@/sim/handover/baselines';
import { applyHandoverStateMachine } from '@/sim/handover/state-machine';
import { computeJainFairness, updateKpiAccumulator } from '@/sim/kpi/accumulator';
import { PolicyRuntimeSession } from '@/sim/policy/runtime-session';
import type { PolicyMode, PolicyPlugin } from '@/sim/policy/types';
import { BeamSchedulerWindowEngine } from '@/sim/scheduler/window-engine';
import {
  computeTopocentricPoint,
  createObserverContext,
  geoToWorldXZ,
  loadOrbitCatalog,
  propagateOrbitElement,
} from '@/sim/orbit/sgp4';
import { buildTrajectoryCache } from '@/sim/orbit/trajectory-cache';
import type {
  SatelliteState,
  SimScenario,
  SimSnapshot,
  SimTickContext,
  UEState,
} from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';
import { buildBeamsForSatellite, computeBeamSpacingWorld } from './common/beam-layout';
import {
  DEFAULT_OBSERVER,
  EMPTY_KPI,
  assignInitialServing,
  type SatelliteStateFrame,
} from './common/scenario-defaults';
import { worldToLatLon } from './common/geo';
import { attachUesToBeams, moveUesLinearX } from './common/runtime';

/**
 * Provenance:
 * - PAP-2022-SEAMLESSNTN-CORE
 * - PAP-2024-MADRL-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 */


/**
 * Replay mode contract (RTLP §4.4):
 * - 'research-default': continuous propagation from fixture epoch origin (DEFAULT).
 *   No forced looping; physical truth is preserved.
 * - 'demo-loop': wraps simulation time at the fixture replay-window boundary.
 *   NOT the default; labeled as presentation behavior. Seam is explicit reset.
 */
export type RealTraceReplayMode = 'research-default' | 'demo-loop';

interface RealTraceScenarioOptions {
  profile: PaperProfile;
  seed: number;
  baseline?: RuntimeBaseline;
  policyRuntime?: {
    mode?: PolicyMode;
    plugin?: PolicyPlugin;
  };
  scenarioId?: string;
  kmToWorldScale?: number;
  observerLat?: number;
  observerLon?: number;
  /**
   * Replay mode: 'research-default' (default) or 'demo-loop'.
   * Source: SDD RTLP §4.4 — research-default is the normative path.
   */
  replayMode?: RealTraceReplayMode;
  /**
   * When true, apply bootstrap offset from fixture metadata to the initial
   * simulation epoch so the first frame starts at the most observer-readable
   * point in the replay window.
   * Source: SDD RTLP §4.3.
   */
  applyBootstrap?: boolean;
  /**
   * Override the trajectory cache window duration (seconds).
   * Only used in tests to reduce memory consumption; production uses the
   * full fixture replayWindowDurationSec.
   */
  maxTrajWindowSec?: number;
  /**
   * Limit the number of catalog records used for propagation.
   * Only used in tests to reduce memory consumption.
   */
  maxCatalogRecords?: number;
}



function buildInitialUEs(options: {
  profile: PaperProfile;
  seed: number;
  kmToWorldScale: number;
  observerLat: number;
  observerLon: number;
}): UEState[] {
  const { profile, seed, kmToWorldScale, observerLat, observerLon } = options;
  const rng = new SeededRng(seed);

  const widthWorld = profile.scenario.areaKm.width * kmToWorldScale;
  const heightWorld = profile.scenario.areaKm.height * kmToWorldScale;
  const speedOptions = profile.ue.speedKmphOptions;

  return Array.from({ length: profile.ue.count }, (_, index) => {
    const x = rng.nextRange(-widthWorld / 2, widthWorld / 2);
    const z = rng.nextRange(-heightWorld / 2, heightWorld / 2);
    const [lat, lon] = worldToLatLon(x, z, kmToWorldScale, observerLat, observerLon);

    return {
      id: index,
      positionLatLon: [lat, lon],
      positionWorld: [x, 0.8, z],
      speedKmph: rng.pick(speedOptions),
      servingSatId: null,
      servingBeamId: null,
      secondarySatId: null,
      secondaryBeamId: null,
      choPreparedSatId: null,
      choPreparedBeamId: null,
      choPreparedElapsedMs: null,
      choPreparedTargetMs: null,
      choPreparedRemainingMs: null,
      choGeometryDistanceKm: null,
      choGeometryElevationDeg: null,
      choGeometryTimeToThresholdSec: null,
      rsrpDbm: -140,
      sinrDb: -20,
      l3SinrDb: -20,
      qOutCounter: 0,
      qInCounter: 0,
      hoState: 1,
      rlfTimerMs: null,
      rlfRecoveryBudgetMs: null,
    };
  });
}

export function createRealTraceScenario(options: RealTraceScenarioOptions): SimScenario {
  const profile = options.profile;
  const fullCatalog = loadOrbitCatalog(profile);
  // In test builds, limit catalog records to reduce memory from SGP4 propagation.
  const testMaxRecords = typeof __SIM_TEST_TRAJ_WINDOW_SEC__ !== 'undefined' ? 30 : undefined;
  const maxRecords = options.maxCatalogRecords ?? testMaxRecords;
  const catalog = maxRecords != null && maxRecords < fullCatalog.records.length
    ? { ...fullCatalog, records: fullCatalog.records.slice(0, maxRecords) }
    : fullCatalog;
  const baseline = options.baseline ?? 'max-rsrp';
  // Replay mode: 'research-default' is the normative path (RTLP §4.4).
  // 'demo-loop' is presentation-only and must be explicitly requested.
  const replayMode: RealTraceReplayMode = options.replayMode ?? 'research-default';
  // Bootstrap: apply fixture-computed offset so the initial frame starts at the
  // most NTPU-visible epoch within the replay window (RTLP §4.3).
  const applyBootstrap = options.applyBootstrap ?? true;
  const scenarioId =
    options.scenarioId ??
    `phase1b-real-trace-${catalog.provider}-${catalog.propagationEngine}`;
  const kmToWorldScale = options.kmToWorldScale ?? 0.6;
  const observerLat = options.observerLat ?? DEFAULT_OBSERVER.lat;
  const observerLon = options.observerLon ?? DEFAULT_OBSERVER.lon;
  const runtimeParameterAudit = createRuntimeParameterAuditSession({
    profileId: profile.profileId,
    scenarioId,
  });
  const policyRuntime = new PolicyRuntimeSession({
    mode: options.policyRuntime?.mode ?? 'off',
    plugin: options.policyRuntime?.plugin,
    profile,
    seed: options.seed,
    scenarioId,
  });
  const beamScheduler = new BeamSchedulerWindowEngine({
    profile,
    seed: options.seed,
  });
  const observer = createObserverContext(observerLat, observerLon, 0);
  const beamRadiusKm = profile.beam.footprintDiameterKm / 2;
  const beamRadiusWorld = beamRadiusKm * kmToWorldScale;
  const beamSpacingWorld = computeBeamSpacingWorld(beamRadiusWorld, profile.beam.overlapRatio);
  const desiredSatCount =
    profile.constellation.activeSatellitesInWindow ?? profile.constellation.satellitesPerPlane;
  let triggerMemory: TriggerMemoryStore = new Map();

  /**
   * Epoch origin for propagation (RTLP §4.1):
   * Use fixture replay-window start + bootstrap offset (if enabled).
   * This is deterministic for the same fixture independent of wall-clock date.
   */
  const bootstrapOffsetMs = applyBootstrap
    ? Math.round(catalog.bootstrapStartOffsetSec * 1000)
    : 0;
  const epochOriginMs = catalog.replayWindowStartUtcMs + bootstrapOffsetMs;

  /**
   * Demo-loop seam (RTLP §4.4, §4.6):
   * When replayMode='demo-loop', simulation time wraps at replayWindowDurationSec.
   * The seam is an explicit reset boundary (not silent mid-pass teleport).
   * Research-default: no wrapping, continuous propagation.
   */
  const replayWindowDurationMs = catalog.replayWindowDurationSec * 1000;

  function resolveSimUtcMs(timeSec: number): number {
    const elapsed = Math.round(timeSec * 1000);
    if (replayMode === 'demo-loop') {
      // Explicit reset at seam: wrap elapsed inside the remaining window
      // (window duration minus bootstrap offset to stay within window bounds).
      const remainingWindowMs = replayWindowDurationMs - bootstrapOffsetMs;
      const wrappedMs = remainingWindowMs > 0 ? elapsed % remainingWindowMs : elapsed;
      return epochOriginMs + wrappedMs;
    }
    // research-default: continuous propagation from epoch origin
    return epochOriginMs + elapsed;
  }

  function buildSatellitesAt(timeSec: number): SatelliteStateFrame {
    const simUtcMs = resolveSimUtcMs(timeSec);
    const minElevationDeg = profile.constellation.minElevationDeg;

    const propagated = catalog.records.map((record) => {
      const point = propagateOrbitElement(record, simUtcMs);
      const topo = computeTopocentricPoint(observer, point.ecefKm);
      const [groundX, groundZ] = geoToWorldXZ(
        point.latDeg,
        point.lonDeg,
        observerLat,
        observerLon,
        kmToWorldScale,
      );
      return {
        satellite: {
          id: record.noradId,
          positionEcef: point.ecefKm,
          positionWorld: [
            topo.eastKm * kmToWorldScale,
            topo.upKm * kmToWorldScale,
            topo.northKm * kmToWorldScale,
          ] as [number, number, number],
          positionLla: {
            lat: point.latDeg,
            lon: point.lonDeg,
            altKm: point.altKm,
          },
          azimuthDeg: topo.azimuthDeg,
          elevationDeg: topo.elevationDeg,
          rangeKm: topo.rangeKm,
          visible: topo.elevationDeg >= minElevationDeg,
        },
        groundCenterWorld: [groundX, groundZ] as [number, number],
      };
    });

    const visibleSorted = propagated
      // Source: PAP-2022-SEAMLESSNTN-CORE
      // Source: STD-3GPP-TR38.811-6.6.2-1
      // Visibility gate uses profile-configured minimum elevation.
      .filter((entry) => entry.satellite.elevationDeg >= minElevationDeg)
      .sort((left, right) => right.satellite.elevationDeg - left.satellite.elevationDeg);

    const fallbackSorted = propagated
      .filter(
        (entry) =>
          !visibleSorted.some(
            (visible) => visible.satellite.id === entry.satellite.id,
          ),
      )
      .sort((left, right) => right.satellite.elevationDeg - left.satellite.elevationDeg);

    const selected = visibleSorted.slice(0, desiredSatCount);
    if (selected.length < desiredSatCount) {
      // Source: PAP-2024-MADRL-CORE
      // Keep fixed active-satellite window size for reproducible batch comparison.
      selected.push(...fallbackSorted.slice(0, desiredSatCount - selected.length));
    }

    return {
      runtimeSatellites: selected.map((entry) => ({
        ...entry.satellite,
        beams: buildBeamsForSatellite({
          satelliteId: entry.satellite.id,
          beamIdMultiplier: 1000,
          centerWorld: entry.groundCenterWorld,
          beamCount: profile.beam.beamsPerSatellite,
          beamRadiusKm,
          beamRadiusWorld,
          spacingWorld: beamSpacingWorld,
          kmToWorldScale,
          observerLat,
          observerLon,
        }),
      })),
      observerSkyPhysicalSatellites: propagated.map((entry) => entry.satellite),
    };
  }

  // Pre-compute full trajectory cache for smooth observer-sky rendering.
  // Start 600s before epoch so satellites already in the sky at t=0
  // have their full entry arc from the horizon included.
  const TRAJ_LOOKBACK_SEC = 600;
  // In test/CI environments, cap the trajectory window to reduce memory usage.
  // The full 6000s window is only needed for browser rendering.
  // __SIM_TEST_TRAJ_WINDOW_SEC__ is inlined by esbuild define in test builds.
  const testWindowOverride = typeof __SIM_TEST_TRAJ_WINDOW_SEC__ !== 'undefined'
    ? __SIM_TEST_TRAJ_WINDOW_SEC__ as number : undefined;
  const effectiveReplaySec = options.maxTrajWindowSec
    ?? testWindowOverride
    ?? (catalog.replayWindowDurationSec ?? 6000);
  const trajWindowSec = effectiveReplaySec + TRAJ_LOOKBACK_SEC;
  const trajCache = buildTrajectoryCache(
    catalog.records,
    observer,
    epochOriginMs - TRAJ_LOOKBACK_SEC * 1000,
    trajWindowSec,
    TRAJ_LOOKBACK_SEC,
  );

  const initialSatelliteFrame = buildSatellitesAt(0);
  const initialUes = buildInitialUEs({
    profile,
    seed: options.seed,
    kmToWorldScale,
    observerLat,
    observerLon,
  });
  // Assign initial serving satellite so tick-0 scene shows active links
  assignInitialServing(initialUes, initialSatelliteFrame.runtimeSatellites);

  const initialSnapshot: SimSnapshot = {
    tick: 0,
    timeSec: 0,
    scenarioId,
    profileId: profile.profileId,
    satellites: initialSatelliteFrame.runtimeSatellites,
    observerSkyPhysicalSatellites: initialSatelliteFrame.observerSkyPhysicalSatellites,
    ues: initialUes,
    hoEvents: [],
    kpiCumulative: { ...EMPTY_KPI },
    runtimeParameterAudit: runtimeParameterAudit.snapshot(0),
    policyRuntime: policyRuntime.snapshot(),
    beamScheduler: beamScheduler.buildSnapshot(0, 0, initialSatelliteFrame.runtimeSatellites),
    coupledDecisionStats: {
      mode: profile.scheduler.mode,
      blockedByScheduleHandoverCount: 0,
      schedulerInducedInterruptionSec: 0,
      blockedReasons: {},
    },
  };

  function nextSnapshot(previous: SimSnapshot, context: SimTickContext): SimSnapshot {
    const timeSec = previous.timeSec + context.timeStepSec;
    const movedUes = moveUesLinearX({
      ues: previous.ues,
      timeStepSec: context.timeStepSec,
      widthWorld: profile.scenario.areaKm.width * kmToWorldScale,
      kmToWorldScale,
      observerLat,
      observerLon,
    });

    const satelliteFrame = buildSatellitesAt(timeSec);
    const beamSchedulerSnapshot = beamScheduler.buildSnapshot(
      previous.tick + 1,
      timeSec,
      satelliteFrame.runtimeSatellites,
    );
    const decision = runHandoverBaseline({
      tick: previous.tick + 1,
      timeSec,
      timeStepSec: context.timeStepSec,
      profile,
      satellites: satelliteFrame.runtimeSatellites,
      ues: movedUes,
      baseline,
      triggerMemory,
      policyRuntime,
      beamScheduler: beamSchedulerSnapshot,
    });
    triggerMemory = decision.nextTriggerMemory;

    const stateMachine = applyHandoverStateMachine({
      profile,
      ues: decision.nextUes,
      events: decision.events,
      runtimeParameterAudit,
    });

    const satellitesWithConnections = attachUesToBeams(
      stateMachine.ues,
      satelliteFrame.runtimeSatellites,
    );
    const loadVector = satellitesWithConnections.map((satellite) =>
      satellite.beams.reduce((sum, beam) => sum + beam.connectedUeIds.length, 0),
    );

    const kpiCumulative = updateKpiAccumulator({
      previous: previous.kpiCumulative,
      previousTick: previous.tick,
      timeSec,
      ueCount: stateMachine.ues.length,
      handoverEvents: decision.events.length,
      meanSinrDb: decision.meanSinrDb,
      meanThroughputMbps: decision.meanThroughputMbps,
      fairness: computeJainFairness(loadVector),
      rlfDelta: stateMachine.rlfDelta,
      hofDelta: stateMachine.hofDelta,
    });

    return {
      tick: previous.tick + 1,
      timeSec,
      scenarioId,
      profileId: profile.profileId,
      satellites: satellitesWithConnections,
      observerSkyPhysicalSatellites: satelliteFrame.observerSkyPhysicalSatellites,
        ues: stateMachine.ues,
      hoEvents: decision.events,
      kpiCumulative,
      runtimeParameterAudit: runtimeParameterAudit.snapshot(previous.tick + 1),
      policyRuntime: policyRuntime.snapshot(),
      beamScheduler: beamSchedulerSnapshot,
      coupledDecisionStats: decision.coupledDecisionStats,
    };
  }

  return {
    id: scenarioId,
    profileId: profile.profileId,
    trajectoryCache: trajCache,
    createInitialSnapshot: () => {
      triggerMemory = new Map();
      runtimeParameterAudit.reset();
      policyRuntime.reset();
      beamScheduler.reset();
      return {
        ...initialSnapshot,
        satellites: initialSatelliteFrame.runtimeSatellites,
        observerSkyPhysicalSatellites: initialSatelliteFrame.observerSkyPhysicalSatellites,
        ues: initialUes,
        hoEvents: [],
        kpiCumulative: { ...EMPTY_KPI },
        runtimeParameterAudit: runtimeParameterAudit.snapshot(0),
        policyRuntime: policyRuntime.snapshot(),
        beamScheduler: beamScheduler.buildSnapshot(0, 0, initialSatelliteFrame.runtimeSatellites),
        coupledDecisionStats: {
          mode: profile.scheduler.mode,
          blockedByScheduleHandoverCount: 0,
          schedulerInducedInterruptionSec: 0,
          blockedReasons: {},
        },
      };
    },
    nextSnapshot,
  };
}
