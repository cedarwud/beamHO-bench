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
import type { KpiResult, SatelliteState, SimScenario, SimSnapshot, SimTickContext, UEState } from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';
import {
  buildBeamsForSatellite,
  buildSatelliteGroundCenters,
  computeBeamSpacingWorld,
} from './common/beam-layout';
import { worldToLatLon } from './common/geo';
import { attachUesToBeams, moveUesLinearX, wrapValue } from './common/runtime';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 * - STD-3GPP-TR38.811-6.6.2-1
 */

const DEFAULT_OBSERVER = {
  lat: 24.9441667,
  lon: 121.3713889,
};

interface Case9AnalyticScenarioOptions {
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

interface SatelliteKinematicContext {
  profile: PaperProfile;
  timeSec: number;
  kmToWorldScale: number;
  observerLat: number;
  observerLon: number;
  baseCenters: Array<[number, number]>;
  beamRadiusKm: number;
  beamRadiusWorld: number;
  beamSpacingWorld: number;
  wrapWidthWorld: number;
}

function buildSatelliteStateAtTime(context: SatelliteKinematicContext): SatelliteState[] {
  const {
    profile,
    timeSec,
    kmToWorldScale,
    observerLat,
    observerLon,
    baseCenters,
    beamRadiusKm,
    beamRadiusWorld,
    beamSpacingWorld,
    wrapWidthWorld,
  } = context;

  const driftWorldPerSec = (profile.constellation.satelliteSpeedKmps ?? 7.56) * kmToWorldScale;
  const altitudeWorld = profile.constellation.altitudeKm * kmToWorldScale;

  return baseCenters.map(([baseX, baseZ], satIndex) => {
    const phasedDrift = driftWorldPerSec * timeSec + satIndex * 45;
    const groundX = wrapValue(baseX + phasedDrift, -wrapWidthWorld / 2, wrapWidthWorld / 2);
    const groundZ = baseZ;

    const satX = groundX * 0.35;
    const satY = altitudeWorld + (satIndex % 2 === 0 ? 40 : 0);
    const satZ = groundZ * 0.35;

    const horizontalDistanceWorld = Math.hypot(satX, satZ);
    const rangeWorld = Math.hypot(horizontalDistanceWorld, satY);
    const rangeKm = rangeWorld / kmToWorldScale;

    const azimuthDeg = (Math.atan2(satX, satZ) * 180) / Math.PI;
    const normalizedAzimuthDeg = azimuthDeg < 0 ? azimuthDeg + 360 : azimuthDeg;
    const elevationDeg = (Math.atan2(satY, horizontalDistanceWorld) * 180) / Math.PI;
    const [lat, lon] = worldToLatLon(groundX, groundZ, kmToWorldScale, observerLat, observerLon);

    return {
      id: satIndex,
      positionEcef: [satX, satY, satZ],
      positionWorld: [satX, satY, satZ],
      positionLla: {
        lat,
        lon,
        altKm: profile.constellation.altitudeKm,
      },
      azimuthDeg: normalizedAzimuthDeg,
      elevationDeg,
      rangeKm,
      visible: elevationDeg >= profile.constellation.minElevationDeg,
      beams: buildBeamsForSatellite({
        satelliteId: satIndex,
        beamIdMultiplier: 100,
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

export function createCase9AnalyticScenario(options: Case9AnalyticScenarioOptions): SimScenario {
  const profile = options.profile;
  const scenarioId = options.scenarioId ?? 'phase1a-case9-analytic';
  const baseline = options.baseline ?? 'max-rsrp';
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
  let triggerMemory: TriggerMemoryStore = new Map();

  const satCount =
    profile.constellation.activeSatellitesInWindow ?? profile.constellation.satellitesPerPlane;
  const beamRadiusKm = profile.beam.footprintDiameterKm / 2;
  const beamRadiusWorld = beamRadiusKm * kmToWorldScale;
  const beamSpacingWorld = computeBeamSpacingWorld(beamRadiusWorld, profile.beam.overlapRatio);
  const wrapWidthWorld = profile.scenario.areaKm.width * kmToWorldScale * 3.5;
  const baseCenters = buildSatelliteGroundCenters(satCount, beamRadiusWorld * 6.8);

  const initialSatellites = buildSatelliteStateAtTime({
    profile,
    timeSec: 0,
    kmToWorldScale,
    observerLat,
    observerLon,
    baseCenters,
    beamRadiusKm,
    beamRadiusWorld,
    beamSpacingWorld,
    wrapWidthWorld,
  });

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

    const satellitesAtTime = buildSatelliteStateAtTime({
      profile,
      timeSec,
      kmToWorldScale,
      observerLat,
      observerLon,
      baseCenters,
      beamRadiusKm,
      beamRadiusWorld,
      beamSpacingWorld,
      wrapWidthWorld,
    });

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
