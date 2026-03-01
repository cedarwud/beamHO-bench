#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'validation-suite');
const BUNDLE_PATH = path.join(TMP_DIR, 'validation-suite-cli.mjs');
const ENTRY_POINT = path.join(ROOT, 'src/sim/bench/cli-validation-suite.ts');
const ARTIFACT_DIR = path.join(ROOT, 'dist');
const GATE_SUMMARY_PATH = path.join(ARTIFACT_DIR, 'validation-gate-summary.json');
const SUITE_JSON_PATH = path.join(ARTIFACT_DIR, 'validation-suite.json');
const SUITE_CSV_PATH = path.join(ARTIFACT_DIR, 'validation-suite.csv');
const RUNTIME_AUDIT_SUMMARY_PATH = path.join(
  ARTIFACT_DIR,
  'runtime-parameter-audit-summary.json',
);

async function bundleCli() {
  await mkdir(TMP_DIR, { recursive: true });

  const resolveAliasPath = (importPath) => {
    const basePath = path.join(ROOT, 'src', importPath.slice(2));
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.json`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.tsx'),
      path.join(basePath, 'index.js'),
      path.join(basePath, 'index.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return basePath;
  };

  await build({
    entryPoints: [ENTRY_POINT],
    outfile: BUNDLE_PATH,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node20'],
    sourcemap: false,
    plugins: [
      {
        name: 'alias-at',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveAliasPath(args.path),
          }));
        },
      },
    ],
  });
}

async function executeGate() {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);

  if (typeof moduleNamespace.runValidationSuiteGate !== 'function') {
    throw new Error('Bundled validation gate module does not export runValidationSuiteGate().');
  }

  const seedRaw = process.env.VALIDATION_SEED;
  const seed = Number.isFinite(Number(seedRaw)) ? Math.round(Number(seedRaw)) : undefined;

  return moduleNamespace.runValidationSuiteGate(seed);
}

function printGateSummary(summary) {
  console.log(
    `[validation-suite] seed=${summary.seed} cases=${summary.totalCases} passed=${summary.passedCases} failed=${summary.failedCases} warnings=${summary.warningCases}`,
  );
  for (const stat of summary.checkStats) {
    console.log(
      `[validation-suite] check=${stat.checkId} blocking=${stat.blocking} pass=${stat.passedCases}/${stat.evaluatedCases} passRate=${stat.passRate} coverage=${stat.coverageRate}`,
    );
  }

  if (!summary.pass) {
    for (const failure of summary.failures.slice(0, 10)) {
      console.error(
        `[validation-suite] FAIL ${failure.validationId}/${failure.caseId} checks=${failure.failedChecks.join('|')}`,
      );
    }
    if (summary.failures.length > 10) {
      console.error(
        `[validation-suite] ... ${summary.failures.length - 10} more failed case(s) omitted`,
      );
    }
  }

  if (summary.warnings.length > 0) {
    for (const warning of summary.warnings.slice(0, 10)) {
      console.warn(
        `[validation-suite] WARN ${warning.validationId}/${warning.caseId} checks=${warning.failedChecks.join('|')}`,
      );
    }
    if (summary.warnings.length > 10) {
      console.warn(
        `[validation-suite] ... ${summary.warnings.length - 10} more warning case(s) omitted`,
      );
    }
  }
}

async function writeGateSummaryArtifact(summary) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(GATE_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[validation-suite] gate summary artifact: ${path.relative(ROOT, GATE_SUMMARY_PATH)}`);
}

function buildCompactSuiteArtifact(suite) {
  return {
    generatedAtUtc: suite.generatedAtUtc,
    seed: suite.seed,
    summaryCsv: suite.summaryCsv,
    results: suite.results.map((result) => ({
      validationId: result.validationId,
      caseId: result.caseId,
      profileId: result.profileId,
      seed: result.seed,
      trendPolicy: result.trendPolicy ?? null,
      runtimeOverrides: result.runtimeOverrides,
      checks: result.checks,
      batch: {
        profileId: result.batch.profileId,
        seed: result.batch.seed,
        tickCount: result.batch.tickCount,
        generatedAtUtc: result.batch.generatedAtUtc,
        summaryCsv: result.batch.summaryCsv,
        runs: result.batch.runs.map((run) => ({
          baseline: run.baseline,
          result: run.result,
        })),
      },
    })),
  };
}

async function writeSuiteArtifacts(suite) {
  const compactSuite = buildCompactSuiteArtifact(suite);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(SUITE_JSON_PATH, `${JSON.stringify(compactSuite, null, 2)}\n`, 'utf8');
  await writeFile(SUITE_CSV_PATH, suite.summaryCsv, 'utf8');
  console.log(`[validation-suite] suite artifact: ${path.relative(ROOT, SUITE_JSON_PATH)}`);
  console.log(`[validation-suite] suite artifact: ${path.relative(ROOT, SUITE_CSV_PATH)}`);
}

async function writeRuntimeAuditSummaryArtifact(summary) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(RUNTIME_AUDIT_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(
    `[validation-suite] runtime audit artifact: ${path.relative(ROOT, RUNTIME_AUDIT_SUMMARY_PATH)}`,
  );
}

async function cleanup() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

async function main() {
  try {
    await bundleCli();
    const gateResult = await executeGate();
    printGateSummary(gateResult.summary);
    await writeSuiteArtifacts(gateResult.suite);
    await writeGateSummaryArtifact(gateResult.summary);
    if (gateResult.runtimeParameterAuditSummary) {
      await writeRuntimeAuditSummaryArtifact(gateResult.runtimeParameterAuditSummary);
    }
    await cleanup();
    process.exit(gateResult.exitCode);
  } catch (error) {
    console.error('[validate-validation-suite] failed with unexpected error.');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

await main();
