import type { PaperProfile } from '@/config/paper-profiles/types';
import onewebFixtureJson from '@/data/tle/oneweb-sample.json';
import starlinkFixtureJson from '@/data/tle/starlink-sample.json';
import { json2satrec } from 'satellite.js';
import type { OMMJsonObject } from 'satellite.js';
import { degToRad } from './math';
import type {
  OrbitCatalog,
  OrbitElement,
  OrbitPropagationEngine,
  Provider,
} from './types';

interface TleFixtureRecord {
  objectName: string;
  objectId: string;
  noradId: number;
  epochUtc: string;
  meanMotionRevPerDay: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  bstar: number;
  meanMotionDot?: number;
  meanMotionDdot?: number;
  elementSetNo?: number;
  revAtEpoch?: number;
}

interface TleFixtureFile {
  generatedAtUtc: string;
  provider: Provider;
  sourceFile: string;
  sourceRecordCount: number;
  sampledRecordCount: number;
  records: TleFixtureRecord[];
}

const STARLINK_FIXTURE = starlinkFixtureJson as TleFixtureFile;
const ONEWEB_FIXTURE = onewebFixtureJson as TleFixtureFile;
let warnedUnknownPropagator = false;

function selectProvider(profile: PaperProfile): Provider {
  if (profile.constellation.tle?.provider === 'oneweb') {
    return 'oneweb';
  }
  return 'starlink';
}

function resolvePropagationEngine(): OrbitPropagationEngine {
  const envValue = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env?.VITE_ORBIT_PROPAGATOR;
  const normalized = envValue?.trim().toLowerCase();

  if (normalized === 'sgp4') {
    return 'sgp4-satellitejs';
  }
  if (!normalized || normalized === 'kepler') {
    return 'kepler-fallback';
  }

  if (!warnedUnknownPropagator) {
    warnedUnknownPropagator = true;
    console.warn(
      `[orbit] Unknown VITE_ORBIT_PROPAGATOR='${envValue}'. Falling back to 'kepler'.`,
    );
  }
  return 'kepler-fallback';
}

function resolveFixture(provider: Provider): TleFixtureFile {
  return provider === 'starlink' ? STARLINK_FIXTURE : ONEWEB_FIXTURE;
}

function buildOmmRecord(record: TleFixtureRecord): OMMJsonObject {
  // Source: PAP-2022-SEAMLESSNTN-CORE
  // Source: PAP-2024-MADRL-CORE
  // Local fixture originates from TLE/OMM fields; we preserve values for SGP4 replay.
  return {
    OBJECT_NAME: record.objectName || `NORAD-${record.noradId}`,
    OBJECT_ID: record.objectId || `UNKNOWN-${record.noradId}`,
    EPOCH: record.epochUtc,
    MEAN_MOTION: record.meanMotionRevPerDay,
    ECCENTRICITY: record.eccentricity,
    INCLINATION: record.inclinationDeg,
    RA_OF_ASC_NODE: record.raanDeg,
    ARG_OF_PERICENTER: record.argPerigeeDeg,
    MEAN_ANOMALY: record.meanAnomalyDeg,
    NORAD_CAT_ID: record.noradId,
    ELEMENT_SET_NO: record.elementSetNo ?? 1,
    REV_AT_EPOCH: record.revAtEpoch ?? 0,
    BSTAR: record.bstar,
    MEAN_MOTION_DOT: record.meanMotionDot ?? 0,
    MEAN_MOTION_DDOT: record.meanMotionDdot ?? 0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    CENTER_NAME: 'EARTH',
    REF_FRAME: 'TEME',
    TIME_SYSTEM: 'UTC',
    MEAN_ELEMENT_THEORY: 'SGP4',
  };
}

function parseOrbitElement(
  record: TleFixtureRecord,
  propagationEngine: OrbitPropagationEngine,
): OrbitElement | null {
  const epochUtcMs = Date.parse(record.epochUtc);
  if (!Number.isFinite(epochUtcMs)) {
    return null;
  }

  if (
    !Number.isFinite(record.noradId) ||
    record.noradId <= 0 ||
    !Number.isFinite(record.meanMotionRevPerDay) ||
    record.meanMotionRevPerDay <= 0 ||
    !Number.isFinite(record.eccentricity) ||
    record.eccentricity < 0 ||
    record.eccentricity >= 1 ||
    !Number.isFinite(record.inclinationDeg) ||
    !Number.isFinite(record.raanDeg) ||
    !Number.isFinite(record.argPerigeeDeg) ||
    !Number.isFinite(record.meanAnomalyDeg) ||
    !Number.isFinite(record.bstar)
  ) {
    return null;
  }

  const base: OrbitElement = {
    objectName: record.objectName || `NORAD-${record.noradId}`,
    objectId: record.objectId || `UNKNOWN-${record.noradId}`,
    noradId: record.noradId,
    epochUtcMs,
    meanMotionRevPerDay: record.meanMotionRevPerDay,
    meanMotionDot: record.meanMotionDot ?? 0,
    meanMotionDdot: record.meanMotionDdot ?? 0,
    elementSetNo: record.elementSetNo ?? 1,
    revAtEpoch: record.revAtEpoch ?? 0,
    eccentricity: record.eccentricity,
    inclinationRad: degToRad(record.inclinationDeg),
    raanRad: degToRad(record.raanDeg),
    argPerigeeRad: degToRad(record.argPerigeeDeg),
    meanAnomalyRad: degToRad(record.meanAnomalyDeg),
    bstar: record.bstar,
    satrec: null,
  };

  if (propagationEngine !== 'sgp4-satellitejs') {
    return base;
  }

  try {
    const satrec = json2satrec(buildOmmRecord(record), 'i');
    return {
      ...base,
      satrec: satrec.error === 0 ? satrec : null,
    };
  } catch {
    return base;
  }
}

export function loadOrbitCatalog(profile: PaperProfile): OrbitCatalog {
  const provider = selectProvider(profile);
  const propagationEngine = resolvePropagationEngine();
  const fixture = resolveFixture(provider);
  const maxSatellites = profile.constellation.tle?.selection?.maxSatellites;

  const parsed = fixture.records
    .map((record) => parseOrbitElement(record, propagationEngine))
    .filter((record): record is OrbitElement => record !== null);

  const limit =
    typeof maxSatellites === 'number' && maxSatellites > 0
      ? Math.min(maxSatellites, parsed.length)
      : parsed.length;
  const records = parsed.slice(0, limit);
  if (records.length === 0) {
    throw new Error(`No valid orbit records available for provider '${provider}'`);
  }

  const startTimeUtcMs = records.reduce(
    (maxValue, record) => Math.max(maxValue, record.epochUtcMs),
    0,
  );

  if (propagationEngine === 'sgp4-satellitejs') {
    const sgp4ReadyCount = records.reduce(
      (count, record) => count + (record.satrec ? 1 : 0),
      0,
    );
    if (sgp4ReadyCount < records.length) {
      console.warn(
        `[orbit] SGP4 initialized ${sgp4ReadyCount}/${records.length} records; others use Kepler fallback.`,
      );
    }
  }

  return {
    provider,
    propagationEngine,
    sourceFile: fixture.sourceFile,
    sourceRecordCount: fixture.sourceRecordCount,
    sampledRecordCount: records.length,
    records,
    startTimeUtcMs,
  };
}
