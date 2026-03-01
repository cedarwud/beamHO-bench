#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = process.env.TLE_SOURCE_ROOT
  ? path.resolve(process.env.TLE_SOURCE_ROOT)
  : path.resolve(PROJECT_ROOT, '../tle_data');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'src/data/tle');

const PROVIDERS = [
  { name: 'starlink', maxRecords: Number(process.env.TLE_MAX_STARLINK ?? 320) },
  { name: 'oneweb', maxRecords: Number(process.env.TLE_MAX_ONEWEB ?? 180) },
];

function listJsonFiles(provider) {
  const dir = path.join(SOURCE_ROOT, provider, 'json');
  if (!fs.existsSync(dir)) {
    throw new Error(`missing source directory: ${dir}`);
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
}

function sampleEvenly(records, maxRecords) {
  if (records.length <= maxRecords) {
    return records;
  }

  const sampled = [];
  for (let index = 0; index < maxRecords; index += 1) {
    const sourceIndex = Math.floor((index * records.length) / maxRecords);
    sampled.push(records[sourceIndex]);
  }
  return sampled;
}

function normalizeRecord(raw) {
  return {
    objectName: String(raw.OBJECT_NAME ?? ''),
    objectId: String(raw.OBJECT_ID ?? ''),
    noradId: Number(raw.NORAD_CAT_ID ?? 0),
    epochUtc: String(raw.EPOCH ?? ''),
    meanMotionRevPerDay: Number(raw.MEAN_MOTION ?? 0),
    eccentricity: Number(raw.ECCENTRICITY ?? 0),
    inclinationDeg: Number(raw.INCLINATION ?? 0),
    raanDeg: Number(raw.RA_OF_ASC_NODE ?? 0),
    argPerigeeDeg: Number(raw.ARG_OF_PERICENTER ?? 0),
    meanAnomalyDeg: Number(raw.MEAN_ANOMALY ?? 0),
    bstar: Number(raw.BSTAR ?? 0),
    meanMotionDot: Number(raw.MEAN_MOTION_DOT ?? 0),
    meanMotionDdot: Number(raw.MEAN_MOTION_DDOT ?? 0),
    elementSetNo: Number(raw.ELEMENT_SET_NO ?? 1),
    revAtEpoch: Number(raw.REV_AT_EPOCH ?? 0),
  };
}

function isValidRecord(record) {
  return (
    Number.isFinite(record.noradId) &&
    record.noradId > 0 &&
    Number.isFinite(record.meanMotionRevPerDay) &&
    record.meanMotionRevPerDay > 0 &&
    Number.isFinite(record.eccentricity) &&
    record.eccentricity >= 0 &&
    record.eccentricity < 1 &&
    record.epochUtc.length > 0
  );
}

function buildFixture(provider, latestFile, maxRecords) {
  const rawRecords = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
  const normalized = rawRecords.map(normalizeRecord).filter(isValidRecord);
  const sampled = sampleEvenly(normalized, maxRecords).sort(
    (left, right) => left.noradId - right.noradId,
  );
  const sourceRootHint = path.relative(PROJECT_ROOT, SOURCE_ROOT) || '.';
  const sourceFile = path.relative(SOURCE_ROOT, latestFile);

  return {
    generatedAtUtc: new Date().toISOString(),
    provider,
    sourceRootHint,
    sourceFile,
    sourceRecordCount: normalized.length,
    sampledRecordCount: sampled.length,
    records: sampled,
  };
}

function writeFixture(provider, fixture) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${provider}-sample.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf-8');
  return outPath;
}

function run() {
  const outputs = [];

  for (const provider of PROVIDERS) {
    const files = listJsonFiles(provider.name);
    if (files.length === 0) {
      throw new Error(`no json files found for provider: ${provider.name}`);
    }

    const latestFile = files[files.length - 1];
    const fixture = buildFixture(provider.name, latestFile, provider.maxRecords);
    const outPath = writeFixture(provider.name, fixture);

    outputs.push({
      provider: provider.name,
      latestFile,
      outPath,
      count: fixture.sampledRecordCount,
    });
  }

  for (const output of outputs) {
    console.log(
      `[sync-tle] ${output.provider}: ${output.count} records -> ${output.outPath} (source ${output.latestFile})`,
    );
  }
}

run();
