import type { PaperProfile } from '@/config/paper-profiles/types';
import type { KpiResult, SatelliteState, SimScenario, SimSnapshot, UEState } from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';
import {
  buildBeamsForSatellite,
  buildSatelliteGroundCenters,
  computeBeamSpacingWorld,
} from './common/beam-layout';
import { worldToLatLon } from './common/geo';

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

interface Case9StaticScenarioOptions {
  profile: PaperProfile;
  seed: number;
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

function buildSatellites(options: {
  profile: PaperProfile;
  kmToWorldScale: number;
  observerLat: number;
  observerLon: number;
}): SatelliteState[] {
  const { profile, kmToWorldScale, observerLat, observerLon } = options;

  const satCount =
    profile.constellation.activeSatellitesInWindow ?? profile.constellation.satellitesPerPlane;
  const beamCount = profile.beam.beamsPerSatellite;
  const beamRadiusKm = profile.beam.footprintDiameterKm / 2;
  const beamRadiusWorld = beamRadiusKm * kmToWorldScale;
  const spacingWorld = computeBeamSpacingWorld(beamRadiusWorld, profile.beam.overlapRatio);
  const groundCenters = buildSatelliteGroundCenters(satCount, beamRadiusWorld * 6.8);

  return groundCenters.map(([gx, gz], satIndex) => {
    const altitudeWorld = profile.constellation.altitudeKm * kmToWorldScale;
    const satX = gx * 0.35;
    const satY = altitudeWorld + (satIndex % 2 === 0 ? 40 : 0);
    const satZ = gz * 0.35;

    const horizontalDistanceWorld = Math.hypot(satX, satZ);
    const rangeWorld = Math.hypot(horizontalDistanceWorld, satY);
    const rangeKm = rangeWorld / kmToWorldScale;

    const azimuthDeg = (Math.atan2(satX, satZ) * 180) / Math.PI;
    const normalizedAzimuthDeg = azimuthDeg < 0 ? azimuthDeg + 360 : azimuthDeg;
    const elevationDeg = (Math.atan2(satY, horizontalDistanceWorld) * 180) / Math.PI;
    const [lat, lon] = worldToLatLon(gx, gz, kmToWorldScale, observerLat, observerLon);

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
        centerWorld: [gx, gz],
        beamCount,
        beamRadiusKm,
        beamRadiusWorld,
        spacingWorld,
        kmToWorldScale,
        observerLat,
        observerLon,
      }),
    };
  });
}

function buildUEs(options: {
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

export function createCase9StaticScenario(options: Case9StaticScenarioOptions): SimScenario {
  const profile = options.profile;
  const scenarioId = options.scenarioId ?? 'phase0-case9-static';
  const kmToWorldScale = options.kmToWorldScale ?? 0.6;
  const observerLat = options.observerLat ?? DEFAULT_OBSERVER.lat;
  const observerLon = options.observerLon ?? DEFAULT_OBSERVER.lon;

  const initialSatellites = buildSatellites({
    profile,
    kmToWorldScale,
    observerLat,
    observerLon,
  });

  const initialUEs = buildUEs({
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
    ues: initialUEs,
    hoEvents: [],
    kpiCumulative: { ...EMPTY_KPI },
  };

  return {
    id: scenarioId,
    profileId: profile.profileId,
    createInitialSnapshot: () => ({
      ...initialSnapshot,
      satellites: initialSatellites,
      ues: initialUEs,
      hoEvents: [],
      kpiCumulative: { ...EMPTY_KPI },
      tick: 0,
      timeSec: 0,
    }),
    nextSnapshot: (previous, context) => ({
      ...previous,
      tick: previous.tick + 1,
      timeSec: previous.timeSec + context.timeStepSec,
      hoEvents: [],
      // Source: PAP-2022-A4EVENT-CORE
      // Phase-0 is static geometry bootstrap, so KPI counters remain unchanged.
      kpiCumulative: previous.kpiCumulative,
    }),
  };
}
