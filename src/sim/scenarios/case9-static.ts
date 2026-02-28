import type { PaperProfile } from '@/config/paper-profiles/types';
import type {
  BeamState,
  KpiResult,
  SatelliteState,
  SimScenario,
  SimSnapshot,
  UEState,
} from '@/sim/types';
import { SeededRng } from '@/sim/util/rng';

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

function buildSatelliteGroundCenters(satCount: number, radiusWorld: number): Array<[number, number]> {
  if (satCount <= 0) {
    return [];
  }

  if (satCount === 1) {
    return [[0, 0]];
  }

  if (satCount === 7) {
    const centers: Array<[number, number]> = [[0, 0]];

    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      centers.push([Math.cos(angle) * radiusWorld, Math.sin(angle) * radiusWorld]);
    }

    return centers;
  }

  const centers: Array<[number, number]> = [[0, 0]];

  for (let i = 1; i < satCount; i += 1) {
    const angle = (Math.PI * 2 * (i - 1)) / (satCount - 1);
    centers.push([Math.cos(angle) * radiusWorld, Math.sin(angle) * radiusWorld]);
  }

  return centers;
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
      beamId: satelliteId * 100 + index,
      centerLatLon: [lat, lon],
      centerWorld: [centerX, 0.25, centerZ],
      radiusKm: beamRadiusKm,
      radiusWorld: beamRadiusWorld,
      connectedUeIds: [],
    };
  });
}

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
  const overlapRatio = profile.beam.overlapRatio ?? 0;

  // Source: PAP-2024-MCCHO-CORE
  // Apply overlap ratio to beam spacing so overlap visualization follows profile assumptions.
  const spacingWorld = beamRadiusWorld * Math.max(0.8, 2 - overlapRatio);
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
      beams: buildBeamsForSatellite(
        satIndex,
        [gx, gz],
        beamCount,
        beamRadiusKm,
        beamRadiusWorld,
        spacingWorld,
        kmToWorldScale,
        observerLat,
        observerLon,
      ),
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
      hoState: 1,
      rlfTimerMs: null,
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
