#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'validation-suite');
const BUNDLE_PATH = path.join(TMP_DIR, 'validation-suite-cli.mjs');
const CROSS_MODE_BUNDLE_PATH = path.join(TMP_DIR, 'cross-mode-benchmark.mjs');
const BPE_BUNDLE_PATH = path.join(TMP_DIR, 'baseline-parameter-envelope-pack.mjs');
const SCB_BUNDLE_PATH = path.join(TMP_DIR, 'service-continuity-baseline-pack.mjs');
const REPRO_BUNDLE_PATH = path.join(TMP_DIR, 'repro-bundle-v1.mjs');
const ENTRY_POINT = path.join(ROOT, 'src/sim/bench/cli-validation-suite.ts');
const CROSS_MODE_ENTRY_POINT = path.join(ROOT, 'src/sim/bench/cross-mode-benchmark.ts');
const BPE_ENTRY_POINT = path.join(
  ROOT,
  'src',
  'sim',
  'bench',
  'baseline-parameter-envelope-pack.ts',
);
const SCB_ENTRY_POINT = path.join(
  ROOT,
  'src',
  'sim',
  'bench',
  'service-continuity-baseline-pack.ts',
);
const REPRO_BUNDLE_ENTRY_POINT = path.join(ROOT, 'src', 'sim', 'bench', 'repro-bundle-v1.ts');
const ARTIFACT_DIR = path.join(ROOT, 'dist');
const GATE_SUMMARY_PATH = path.join(ARTIFACT_DIR, 'validation-gate-summary.json');
const SUITE_JSON_PATH = path.join(ARTIFACT_DIR, 'validation-suite.json');
const SUITE_CSV_PATH = path.join(ARTIFACT_DIR, 'validation-suite.csv');
const RUNTIME_AUDIT_SUMMARY_PATH = path.join(
  ARTIFACT_DIR,
  'runtime-parameter-audit-summary.json',
);
const VALIDATION_MATRIX_PATH = path.join(
  ROOT,
  'sdd',
  'completed',
  'beamHO-bench-validation-matrix.md',
);
const VALIDATION_DEFINITIONS_DIR = path.join(
  ROOT,
  'src',
  'sim',
  'bench',
);
const MATRIX_CORE_SUBSECTION_HEADING = '### 5.1 Core Stage Runs';
const MATRIX_EXTENSION_SUBSECTION_HEADING = '### 5.2 Extension Runs (Nightly/Research)';
const REQUIRED_CROSS_MODE_PROFILE_IDS = ['case9-default', 'starlink-like', 'oneweb-like'];
const REQUIRED_BPE_PROFILE_IDS = ['case9-default', 'starlink-like', 'oneweb-like'];
const REQUIRED_SCB_PROFILE_IDS = ['case9-default', 'starlink-like', 'oneweb-like'];
const REQUIRED_RB1_PROFILE_IDS = ['case9-default', 'starlink-like', 'oneweb-like'];
const REQUIRED_BPE_VALIDATION_CASE_COUNTS = {
  'VAL-BPE-ELEVATION-THRESH-SWEEP': 3,
  'VAL-BPE-LOAD-MOBILITY-SWEEP': 4,
  'VAL-BPE-ONEWEB-PARAM-SMOKE': 1,
};
const REQUIRED_SCB_VALIDATION_CASE_COUNTS = {
  'VAL-SCB-STARLINK-SEAMLESS-SWEEP': 3,
  'VAL-SCB-ONEWEB-DAPS-TIMING-SWEEP': 3,
  'VAL-SCB-COUPLED-SCHEDULER-CONTINUITY-SWEEP': 3,
};

function unique(values) {
  return [...new Set(values)];
}

function parseScope(argv) {
  const arg = argv.find((entry) => entry.startsWith('--scope='));
  const value = arg ? arg.slice('--scope='.length) : null;
  if (value === 'all') {
    return 'all';
  }
  if (value === 'core') {
    return 'core';
  }
  return 'core';
}

function isCoreValidationId(validationId) {
  return (
    !validationId.startsWith('VAL-RL-') &&
    !validationId.startsWith('VAL-JBH-') &&
    !validationId.startsWith('VAL-BG-')
  );
}

function resolveAliasPath(importPath) {
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
}

function extractValidationIdsFromSubsection(markdown, subsectionHeading) {
  const sectionStart = markdown.indexOf(subsectionHeading);
  if (sectionStart < 0) {
    throw new Error(
      `Validation matrix is missing subsection '${subsectionHeading}': ${path.relative(ROOT, VALIDATION_MATRIX_PATH)}`,
    );
  }

  const sectionTail = markdown.slice(sectionStart + subsectionHeading.length);
  const nextSectionIndex = sectionTail.search(/\n###\s+5\.\d+/);
  const sectionBody =
    nextSectionIndex >= 0 ? sectionTail.slice(0, nextSectionIndex) : sectionTail;
  const matches = sectionBody.matchAll(/`(VAL-[A-Z0-9-]+)`/g);
  return unique([...matches].map((match) => match[1]));
}

function extractDefinedValidationIdsFromDefinitions(sourceText) {
  const matches = sourceText.matchAll(/validationId:\s*['"]([^'"]+)['"]/g);
  return unique([...matches].map((match) => match[1]));
}

async function collectTypeScriptFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(fullPath);
      }
      if (entry.isFile() && fullPath.endsWith('.ts')) {
        return [fullPath];
      }
      return [];
    }),
  );
  return nested.flat().sort();
}

async function readValidationDefinitionSources() {
  const definitionFiles = await collectTypeScriptFiles(VALIDATION_DEFINITIONS_DIR);
  const contents = await Promise.all(definitionFiles.map((filePath) => readFile(filePath, 'utf8')));
  return contents.join('\n');
}

async function validateMatrixDefinitionAlignment(scope) {
  const [matrixMarkdown, definitionsSource] = await Promise.all([
    readFile(VALIDATION_MATRIX_PATH, 'utf8'),
    readValidationDefinitionSources(),
  ]);

  const coreRequiredIds = extractValidationIdsFromSubsection(
    matrixMarkdown,
    MATRIX_CORE_SUBSECTION_HEADING,
  );
  const extensionRequiredIds = extractValidationIdsFromSubsection(
    matrixMarkdown,
    MATRIX_EXTENSION_SUBSECTION_HEADING,
  );
  const requiredIds =
    scope === 'all'
      ? unique([...coreRequiredIds, ...extensionRequiredIds])
      : coreRequiredIds;
  const definedIds = extractDefinedValidationIdsFromDefinitions(definitionsSource);
  const scopedDefinedIds = scope === 'all' ? definedIds : definedIds.filter(isCoreValidationId);
  const definedIdSet = new Set(scopedDefinedIds);
  const requiredIdSet = new Set(requiredIds);

  const missingInDefinitions = requiredIds.filter((id) => !definedIdSet.has(id));
  const extraInDefinitions = scopedDefinedIds.filter((id) => !requiredIdSet.has(id));

  if (missingInDefinitions.length > 0) {
    throw new Error(
      `Validation matrix IDs missing in validation definitions: ${missingInDefinitions.join(', ')}`,
    );
  }

  if (extraInDefinitions.length > 0) {
    console.warn(
      `[validation-suite] WARN ${scope} validation definitions include IDs not listed in matrix section 5: ${extraInDefinitions.join(', ')}`,
    );
  }
}

async function bundleCli() {
  await mkdir(TMP_DIR, { recursive: true });

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

async function validateCrossModeBenchmarkContract() {
  await mkdir(TMP_DIR, { recursive: true });
  await build({
    entryPoints: [CROSS_MODE_ENTRY_POINT],
    outfile: CROSS_MODE_BUNDLE_PATH,
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

  const moduleUrl = `${pathToFileURL(CROSS_MODE_BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (typeof moduleNamespace.buildCrossModeBenchmarkPlan !== 'function') {
    throw new Error(
      'Cross-mode benchmark module does not export buildCrossModeBenchmarkPlan().',
    );
  }

  const first = moduleNamespace.buildCrossModeBenchmarkPlan();
  const replay = moduleNamespace.buildCrossModeBenchmarkPlan();
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error(
      'Cross-mode benchmark plan must be deterministic for identical tuple options.',
    );
  }

  if (!Number.isFinite(first.caseCount) || first.caseCount !== first.cases.length) {
    throw new Error(
      `Cross-mode benchmark plan has invalid caseCount (${first.caseCount}) vs cases.length (${first.cases.length}).`,
    );
  }

  const profileIds = new Set(first.cases.map((suiteCase) => suiteCase.profileId));
  const missingProfileIds = REQUIRED_CROSS_MODE_PROFILE_IDS.filter((id) => !profileIds.has(id));
  if (missingProfileIds.length > 0) {
    throw new Error(
      `Cross-mode benchmark plan missing canonical profile IDs: ${missingProfileIds.join(', ')}`,
    );
  }

  const matrixCaseIds = first.cases.map((suiteCase) => suiteCase.matrixCaseId);
  if (new Set(matrixCaseIds).size !== matrixCaseIds.length) {
    throw new Error('Cross-mode benchmark plan matrixCaseId values must be unique.');
  }

  const invalidTupleDigestCase = first.cases.find(
    (suiteCase) =>
      typeof suiteCase.tupleDigest !== 'string' || suiteCase.tupleDigest.length === 0,
  );
  if (invalidTupleDigestCase) {
    throw new Error(
      `Cross-mode benchmark plan case '${invalidTupleDigestCase.matrixCaseId}' has invalid tupleDigest.`,
    );
  }

  console.log(
    `[validation-suite] cross-mode contract pass cases=${first.caseCount} profiles=${REQUIRED_CROSS_MODE_PROFILE_IDS.join('|')}`,
  );
}

async function validateBaselineParameterEnvelopeContract() {
  await mkdir(TMP_DIR, { recursive: true });
  await build({
    entryPoints: [BPE_ENTRY_POINT],
    outfile: BPE_BUNDLE_PATH,
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

  const moduleUrl = `${pathToFileURL(BPE_BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (typeof moduleNamespace.buildBaselineParameterEnvelopeValidationDefinitions !== 'function') {
    throw new Error(
      'Baseline-parameter envelope pack module does not export buildBaselineParameterEnvelopeValidationDefinitions().',
    );
  }

  const first = moduleNamespace.buildBaselineParameterEnvelopeValidationDefinitions();
  const replay = moduleNamespace.buildBaselineParameterEnvelopeValidationDefinitions();
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error(
      'Baseline-parameter envelope validation definitions must be deterministic for fixed input.',
    );
  }

  const byId = new Map(first.map((definition) => [definition.validationId, definition]));
  for (const [id, expectedCaseCount] of Object.entries(REQUIRED_BPE_VALIDATION_CASE_COUNTS)) {
    const definition = byId.get(id);
    if (!definition) {
      throw new Error(`Missing required baseline-parameter envelope validation ID: ${id}`);
    }
    if (definition.cases.length !== expectedCaseCount) {
      throw new Error(
        `Baseline-parameter envelope validation '${id}' expected case count=${expectedCaseCount}, got ${definition.cases.length}.`,
      );
    }
    if (definition.requiresFullFidelity !== true) {
      throw new Error(`Baseline-parameter envelope validation '${id}' must require full fidelity.`);
    }
    for (const suiteCase of definition.cases) {
      if (!Array.isArray(suiteCase.baselines) || suiteCase.baselines.length === 0) {
        throw new Error(
          `Baseline-parameter envelope validation '${id}' has empty baseline list in case '${suiteCase.caseId}'.`,
        );
      }
      if (!Number.isFinite(suiteCase.tickCount) || suiteCase.tickCount <= 0) {
        throw new Error(
          `Baseline-parameter envelope validation '${id}' has invalid tickCount in case '${suiteCase.caseId}'.`,
        );
      }
    }
  }

  const profileIds = new Set(first.map((definition) => definition.profileId));
  const missingProfileIds = REQUIRED_BPE_PROFILE_IDS.filter((id) => !profileIds.has(id));
  if (missingProfileIds.length > 0) {
    throw new Error(
      `Baseline-parameter envelope validation pack missing canonical profile coverage: ${missingProfileIds.join(', ')}`,
    );
  }

  console.log(
    `[validation-suite] bpe contract pass validations=${Object.keys(REQUIRED_BPE_VALIDATION_CASE_COUNTS).length} profiles=${REQUIRED_BPE_PROFILE_IDS.join('|')}`,
  );
}

async function validateServiceContinuityBaselineContract() {
  await mkdir(TMP_DIR, { recursive: true });
  await build({
    entryPoints: [SCB_ENTRY_POINT],
    outfile: SCB_BUNDLE_PATH,
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

  const moduleUrl = `${pathToFileURL(SCB_BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (
    typeof moduleNamespace.buildServiceContinuityBaselineValidationDefinitions !== 'function'
  ) {
    throw new Error(
      'Service continuity baseline pack module does not export buildServiceContinuityBaselineValidationDefinitions().',
    );
  }

  const first = moduleNamespace.buildServiceContinuityBaselineValidationDefinitions();
  const replay = moduleNamespace.buildServiceContinuityBaselineValidationDefinitions();
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error(
      'Service continuity baseline validation definitions must be deterministic for fixed input.',
    );
  }

  const byId = new Map(first.map((definition) => [definition.validationId, definition]));
  for (const [id, expectedCaseCount] of Object.entries(REQUIRED_SCB_VALIDATION_CASE_COUNTS)) {
    const definition = byId.get(id);
    if (!definition) {
      throw new Error(`Missing required service continuity validation ID: ${id}`);
    }
    if (definition.cases.length !== expectedCaseCount) {
      throw new Error(
        `Service continuity validation '${id}' expected case count=${expectedCaseCount}, got ${definition.cases.length}.`,
      );
    }
    if (definition.requiresFullFidelity !== true) {
      throw new Error(`Service continuity validation '${id}' must require full fidelity.`);
    }
    for (const suiteCase of definition.cases) {
      if (!Array.isArray(suiteCase.baselines) || suiteCase.baselines.length === 0) {
        throw new Error(
          `Service continuity validation '${id}' has empty baseline list in case '${suiteCase.caseId}'.`,
        );
      }
      if (!Number.isFinite(suiteCase.tickCount) || suiteCase.tickCount <= 0) {
        throw new Error(
          `Service continuity validation '${id}' has invalid tickCount in case '${suiteCase.caseId}'.`,
        );
      }
    }
  }

  const profileIds = new Set(first.map((definition) => definition.profileId));
  const missingProfileIds = REQUIRED_SCB_PROFILE_IDS.filter((id) => !profileIds.has(id));
  if (missingProfileIds.length > 0) {
    throw new Error(
      `Service continuity validation pack missing canonical profile coverage: ${missingProfileIds.join(', ')}`,
    );
  }

  console.log(
    `[validation-suite] scb contract pass validations=${Object.keys(REQUIRED_SCB_VALIDATION_CASE_COUNTS).length} profiles=${REQUIRED_SCB_PROFILE_IDS.join('|')}`,
  );
}

async function validateReproBundleV1Contract() {
  await mkdir(TMP_DIR, { recursive: true });
  await build({
    entryPoints: [REPRO_BUNDLE_ENTRY_POINT],
    outfile: REPRO_BUNDLE_PATH,
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

  const moduleUrl = `${pathToFileURL(REPRO_BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (typeof moduleNamespace.buildReproBundleV1Artifact !== 'function') {
    throw new Error('Repro bundle module does not export buildReproBundleV1Artifact().');
  }

  const first = moduleNamespace.buildReproBundleV1Artifact();
  const replay = moduleNamespace.buildReproBundleV1Artifact();
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error(
      'Repro bundle v1 artifact must be deterministic for identical tuple options.',
    );
  }

  if (
    !first.components ||
    !first.components.crossMode ||
    !first.components.baselineParameterEnvelope
  ) {
    throw new Error('Repro bundle v1 artifact missing required component payloads.');
  }

  if (
    first.componentDigests.crossModeArtifactDigest !== first.components.crossMode.artifactDigest
  ) {
    throw new Error('Repro bundle v1 cross-mode digest mismatch.');
  }
  if (
    first.componentDigests.crossModePlanTupleDigest !== first.components.crossMode.plan.tupleDigest
  ) {
    throw new Error('Repro bundle v1 cross-mode plan tuple digest mismatch.');
  }
  if (
    first.componentDigests.baselineEnvelopeTupleDigest !==
    first.components.baselineParameterEnvelope.tupleDigest
  ) {
    throw new Error('Repro bundle v1 baseline-envelope digest mismatch.');
  }
  if (
    first.componentDigests.baselineEnvelopeCaseCount !==
    first.components.baselineParameterEnvelope.caseCount
  ) {
    throw new Error('Repro bundle v1 baseline-envelope case-count mismatch.');
  }

  const missingProfileIds = REQUIRED_RB1_PROFILE_IDS.filter(
    (id) => !first.profileCoverage.includes(id),
  );
  if (missingProfileIds.length > 0) {
    throw new Error(
      `Repro bundle v1 missing canonical profile coverage: ${missingProfileIds.join(', ')}`,
    );
  }

  if (typeof first.tupleDigest !== 'string' || first.tupleDigest.length === 0) {
    throw new Error('Repro bundle v1 tupleDigest must be non-empty.');
  }
  if (typeof first.artifactDigest !== 'string' || first.artifactDigest.length === 0) {
    throw new Error('Repro bundle v1 artifactDigest must be non-empty.');
  }

  console.log(
    `[validation-suite] rb1 contract pass profiles=${REQUIRED_RB1_PROFILE_IDS.join('|')}`,
  );
}

async function executeGate(scope) {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);

  if (typeof moduleNamespace.runValidationSuiteGate !== 'function') {
    throw new Error('Bundled validation gate module does not export runValidationSuiteGate().');
  }

  const seedRaw = process.env.VALIDATION_SEED;
  const seed = Number.isFinite(Number(seedRaw)) ? Math.round(Number(seedRaw)) : undefined;

  return moduleNamespace.runValidationSuiteGate(seed, scope);
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
    const scope = parseScope(process.argv.slice(2));
    await validateMatrixDefinitionAlignment(scope);
    await validateBaselineParameterEnvelopeContract();
    await validateServiceContinuityBaselineContract();
    if (scope === 'all') {
      await validateCrossModeBenchmarkContract();
      await validateReproBundleV1Contract();
    }
    await bundleCli();
    const gateResult = await executeGate(scope);
    console.log(`[validation-suite] scope=${scope}`);
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
