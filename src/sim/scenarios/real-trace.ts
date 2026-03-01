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
import {
  computeTopocentricPoint,
  createObserverContext,
  geoToWorldXZ,
  loadOrbitCatalog,
  propagateOrbitElement,
} from '@/sim/orbit/sgp4';
import type { KpiResult, SatelliteState, SimScenario, SimSnapshot, SimTickContext, UEState } from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';
import { buildBeamsForSatellite, computeBeamSpacingWorld } from './common/beam-layout';
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

const DEFAULT_OBSERVER = {
  lat: 24.9441667,
  lon: 121.3713889,
};

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
}

const EMPTY_KPI: KpiResult = {
  throughput: 0,
  handoverRate: 0,
  hof: {
    state2: 0,
    state3: 0,
  },
  rlf: {
    state1: 0,
    state2: 0,
  },
  uho: 0,
  hopp: 0,
  avgDlSinr: 0,
  jainFairness: 0,
};

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
  const catalog = loadOrbitCatalog(profile);
  const baseline = options.baseline ?? 'max-rsrp';
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
  const observer = createObserverContext(observerLat, observerLon, 0);
  const beamRadiusKm = profile.beam.footprintDiameterKm / 2;
  const beamRadiusWorld = beamRadiusKm * kmToWorldScale;
  const beamSpacingWorld = computeBeamSpacingWorld(beamRadiusWorld, profile.beam.overlapRatio);
  const desiredSatCount =
    profile.constellation.activeSatellitesInWindow ?? profile.constellation.satellitesPerPlane;
  let triggerMemory: TriggerMemoryStore = new Map();

  function buildSatellitesAt(timeSec: number): SatelliteState[] {
    const simUtcMs = catalog.startTimeUtcMs + Math.round(timeSec * 1000);
    const minElevationDeg = profile.constellation.minElevationDeg;

    const propagated = catalog.records.map((record) => {
      const point = propagateOrbitElement(record, simUtcMs);
      const topo = computeTopocentricPoint(observer, point.ecefKm);
      return {
        record,
        point,
        topo,
      };
    });

    const visibleSorted = propagated
      // Source: PAP-2022-SEAMLESSNTN-CORE
      // Source: STD-3GPP-TR38.811-6.6.2-1
      // Visibility gate uses profile-configured minimum elevation.
      .filter((entry) => entry.topo.elevationDeg >= minElevationDeg)
      .sort((left, right) => right.topo.elevationDeg - left.topo.elevationDeg);

    const fallbackSorted = propagated
      .filter(
        (entry) =>
          !visibleSorted.some(
            (visible) => visible.record.noradId === entry.record.noradId,
          ),
      )
      .sort((left, right) => right.topo.elevationDeg - left.topo.elevationDeg);

    const selected = visibleSorted.slice(0, desiredSatCount);
    if (selected.length < desiredSatCount) {
      // Source: PAP-2024-MADRL-CORE
      // Keep fixed active-satellite window size for reproducible batch comparison.
      selected.push(...fallbackSorted.slice(0, desiredSatCount - selected.length));
    }

    return selected.map((entry) => {
      const satId = entry.record.noradId;
      const [groundX, groundZ] = geoToWorldXZ(
        entry.point.latDeg,
        entry.point.lonDeg,
        observerLat,
        observerLon,
        kmToWorldScale,
      );

      return {
        id: satId,
        positionEcef: entry.point.ecefKm,
        positionWorld: [
          entry.topo.eastKm * kmToWorldScale,
          entry.topo.upKm * kmToWorldScale,
          entry.topo.northKm * kmToWorldScale,
        ],
        positionLla: {
          lat: entry.point.latDeg,
          lon: entry.point.lonDeg,
          altKm: entry.point.altKm,
        },
        azimuthDeg: entry.topo.azimuthDeg,
        elevationDeg: entry.topo.elevationDeg,
        rangeKm: entry.topo.rangeKm,
        visible: entry.topo.elevationDeg >= minElevationDeg,
        beams: buildBeamsForSatellite({
          satelliteId: satId,
          beamIdMultiplier: 1000,
          centerWorld: [groundX, groundZ],
          beamCount: profile.beam.beamsPerSatellite,
          beamRadiusKm,
          beamRadiusWorld,
          spacingWorld: beamSpacingWorld,
          kmToWorldScale,
          observerLat,
          observerLon,
        }),
      };
    });
  }

  const initialSatellites = buildSatellitesAt(0);
  const initialUes = buildInitialUEs({
    profile,
    seed: options.seed,
    kmToWorldScale,
    observerLat,
    observerLon,
  });

  const initialSnapshot: SimSnapshot = {
    tick: 0,
    timeSec: 0,
    scenarioId,
    profileId: profile.profileId,
    satellites: initialSatellites,
    ues: initialUes,
    hoEvents: [],
    kpiCumulative: { ...EMPTY_KPI },
    runtimeParameterAudit: runtimeParameterAudit.snapshot(0),
    policyRuntime: policyRuntime.snapshot(),
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

    const satellitesAtTime = buildSatellitesAt(timeSec);
    const decision = runHandoverBaseline({
      tick: previous.tick + 1,
      timeSec,
      timeStepSec: context.timeStepSec,
      profile,
      satellites: satellitesAtTime,
      ues: movedUes,
      baseline,
      triggerMemory,
      policyRuntime,
    });
    triggerMemory = decision.nextTriggerMemory;

    const stateMachine = applyHandoverStateMachine({
      profile,
      ues: decision.nextUes,
      events: decision.events,
      runtimeParameterAudit,
    });

    const satellitesWithConnections = attachUesToBeams(stateMachine.ues, satellitesAtTime);
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
      ues: stateMachine.ues,
      hoEvents: decision.events,
      kpiCumulative,
      runtimeParameterAudit: runtimeParameterAudit.snapshot(previous.tick + 1),
      policyRuntime: policyRuntime.snapshot(),
    };
  }

  return {
    id: scenarioId,
    profileId: profile.profileId,
    createInitialSnapshot: () => {
      triggerMemory = new Map();
      runtimeParameterAudit.reset();
      policyRuntime.reset();
      return {
        ...initialSnapshot,
        satellites: initialSatellites,
        ues: initialUes,
        hoEvents: [],
        kpiCumulative: { ...EMPTY_KPI },
        runtimeParameterAudit: runtimeParameterAudit.snapshot(0),
        policyRuntime: policyRuntime.snapshot(),
      };
    },
    nextSnapshot,
  };
}
