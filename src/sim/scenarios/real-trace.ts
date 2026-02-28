import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  runHandoverBaseline,
  type RuntimeBaseline,
  type TriggerMemoryStore,
} from '@/sim/handover/baselines';
import { applyHandoverStateMachine } from '@/sim/handover/state-machine';
import { computeJainFairness, updateKpiAccumulator } from '@/sim/kpi/accumulator';
import {
  computeTopocentricPoint,
  createObserverContext,
  geoToWorldXZ,
  loadOrbitCatalog,
  propagateOrbitElement,
} from '@/sim/orbit/sgp4';
import type {
  BeamState,
  KpiResult,
  SatelliteState,
  SimScenario,
  SimSnapshot,
  SimTickContext,
  UEState,
} from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';

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

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function worldToLatLon(
  worldX: number,
  worldZ: number,
  kmToWorldScale: number,
  baseLat: number,
  baseLon: number,
): [number, number] {
  const kmEast = worldX / kmToWorldScale;
  const kmNorth = worldZ / kmToWorldScale;
  const lat = baseLat + kmNorth / 110.574;
  const lon = baseLon + kmEast / (111.32 * Math.cos(degToRad(baseLat)));
  return [lat, lon];
}

function buildHexOffsets(count: number): Array<[number, number]> {
  if (count <= 0) {
    return [];
  }

  const offsets: Array<[number, number]> = [[0, 0]];

  for (let radius = 1; offsets.length < count; radius += 1) {
    let q = radius;
    let r = 0;

    const directions: Array<[number, number]> = [
      [-1, 1],
      [-1, 0],
      [0, -1],
      [1, -1],
      [1, 0],
      [0, 1],
    ];

    for (const [dq, dr] of directions) {
      for (let step = 0; step < radius; step += 1) {
        if (offsets.length >= count) {
          return offsets;
        }
        offsets.push([q, r]);
        q += dq;
        r += dr;
      }
    }
  }

  return offsets;
}

function axialToWorld(q: number, r: number, spacing: number): [number, number] {
  const x = spacing * Math.sqrt(3) * (q + r / 2);
  const z = spacing * 1.5 * r;
  return [x, z];
}

function buildBeamsForSatellite(
  satelliteId: number,
  centerWorld: [number, number],
  beamCount: number,
  beamRadiusKm: number,
  beamRadiusWorld: number,
  spacingWorld: number,
  kmToWorldScale: number,
  observerLat: number,
  observerLon: number,
): BeamState[] {
  const offsets = buildHexOffsets(beamCount);

  return offsets.map(([q, r], index) => {
    const [dx, dz] = axialToWorld(q, r, spacingWorld);
    const centerX = centerWorld[0] + dx;
    const centerZ = centerWorld[1] + dz;
    const [lat, lon] = worldToLatLon(centerX, centerZ, kmToWorldScale, observerLat, observerLon);

    return {
      beamId: satelliteId * 1000 + index,
      centerLatLon: [lat, lon],
      centerWorld: [centerX, 0.25, centerZ],
      radiusKm: beamRadiusKm,
      radiusWorld: beamRadiusWorld,
      connectedUeIds: [],
    };
  });
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
      rsrpDbm: -140,
      sinrDb: -20,
      hoState: 1,
      rlfTimerMs: null,
    };
  });
}

function wrapValue(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) {
    return value;
  }

  let wrapped = value;
  while (wrapped < min) {
    wrapped += range;
  }
  while (wrapped > max) {
    wrapped -= range;
  }
  return wrapped;
}

function moveUes(
  previousUes: UEState[],
  timeStepSec: number,
  widthWorld: number,
  heightWorld: number,
  kmToWorldScale: number,
  observerLat: number,
  observerLon: number,
): UEState[] {
  return previousUes.map((ue) => {
    const speedWorldPerSec = (ue.speedKmph / 3600) * kmToWorldScale;
    const dx = speedWorldPerSec * timeStepSec;
    const nextX = wrapValue(ue.positionWorld[0] + dx, -widthWorld / 2, widthWorld / 2);
    const nextZ = ue.positionWorld[2];
    const [lat, lon] = worldToLatLon(nextX, nextZ, kmToWorldScale, observerLat, observerLon);

    return {
      ...ue,
      positionWorld: [nextX, ue.positionWorld[1], nextZ],
      positionLatLon: [lat, lon],
    };
  });
}

function attachUesToBeams(ues: UEState[], satellites: SatelliteState[]): SatelliteState[] {
  const attached: SatelliteState[] = satellites.map((satellite) => ({
    ...satellite,
    beams: satellite.beams.map((beam): BeamState => ({
      ...beam,
      connectedUeIds: [],
    })),
  }));

  const satelliteById = new Map(attached.map((satellite) => [satellite.id, satellite]));

  for (const ue of ues) {
    if (ue.servingSatId === null || ue.servingBeamId === null) {
      continue;
    }

    const satellite = satelliteById.get(ue.servingSatId);
    if (!satellite) {
      continue;
    }

    const beam = satellite.beams.find((candidate) => candidate.beamId === ue.servingBeamId);
    if (!beam) {
      continue;
    }

    beam.connectedUeIds.push(ue.id);
  }

  return attached;
}

export function createRealTraceScenario(options: RealTraceScenarioOptions): SimScenario {
  const profile = options.profile;
  const catalog = loadOrbitCatalog(profile);
  const baseline = options.baseline ?? 'max-rsrp';
  const scenarioId = options.scenarioId ?? `phase1b-real-trace-${catalog.provider}`;
  const kmToWorldScale = options.kmToWorldScale ?? 0.6;
  const observerLat = options.observerLat ?? DEFAULT_OBSERVER.lat;
  const observerLon = options.observerLon ?? DEFAULT_OBSERVER.lon;
  const observer = createObserverContext(observerLat, observerLon, 0);
  const beamRadiusKm = profile.beam.footprintDiameterKm / 2;
  const beamRadiusWorld = beamRadiusKm * kmToWorldScale;
  const overlapRatio = profile.beam.overlapRatio ?? 0;
  const beamSpacingWorld = beamRadiusWorld * Math.max(0.8, 2 - overlapRatio);
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
        beams: buildBeamsForSatellite(
          satId,
          [groundX, groundZ],
          profile.beam.beamsPerSatellite,
          beamRadiusKm,
          beamRadiusWorld,
          beamSpacingWorld,
          kmToWorldScale,
          observerLat,
          observerLon,
        ),
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
  };

  function nextSnapshot(previous: SimSnapshot, context: SimTickContext): SimSnapshot {
    const timeSec = previous.timeSec + context.timeStepSec;
    const movedUes = moveUes(
      previous.ues,
      context.timeStepSec,
      profile.scenario.areaKm.width * kmToWorldScale,
      profile.scenario.areaKm.height * kmToWorldScale,
      kmToWorldScale,
      observerLat,
      observerLon,
    );

    const satellitesAtTime = buildSatellitesAt(timeSec);
    const decision = runHandoverBaseline({
      tick: previous.tick + 1,
      timeStepSec: context.timeStepSec,
      profile,
      satellites: satellitesAtTime,
      ues: movedUes,
      baseline,
      triggerMemory,
    });
    triggerMemory = decision.nextTriggerMemory;

    const stateMachine = applyHandoverStateMachine({
      profile,
      ues: decision.nextUes,
      events: decision.events,
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
    };
  }

  return {
    id: scenarioId,
    profileId: profile.profileId,
    createInitialSnapshot: () => {
      triggerMemory = new Map();
      return {
        ...initialSnapshot,
        satellites: initialSatellites,
        ues: initialUes,
        hoEvents: [],
        kpiCumulative: { ...EMPTY_KPI },
      };
    },
    nextSnapshot,
  };
}

