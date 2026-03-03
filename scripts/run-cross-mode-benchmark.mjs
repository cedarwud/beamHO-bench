#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'cross-mode-benchmark');
const BUNDLE_PATH = path.join(TMP_DIR, 'cross-mode-benchmark.mjs');
const ENTRY_POINT = path.join(ROOT, 'src', 'sim', 'bench', 'cross-mode-benchmark.ts');

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

function parseOutDir(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out_dir') {
      return argv[index + 1] ?? 'dist/cross-mode-benchmark';
    }
    if (token.startsWith('--out_dir=')) {
      return token.slice('--out_dir='.length);
    }
  }
  return 'dist/cross-mode-benchmark';
}

function stripOutDirArg(argv) {
  const filtered = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out_dir') {
      index += 1;
      continue;
    }
    if (token.startsWith('--out_dir=')) {
      continue;
    }
    filtered.push(token);
  }
  return filtered;
}

function assertNoUnsupportedArgs(argv) {
  if (argv.length === 0) {
    return;
  }
  throw new Error(
    `Unsupported arguments: ${argv.join(' ')}. Only '--out_dir <path>' is allowed.`,
  );
}

async function bundleModule() {
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

async function executeBenchmark() {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (typeof moduleNamespace.buildCrossModeBenchmarkPlan !== 'function') {
    throw new Error('Missing buildCrossModeBenchmarkPlan() export.');
  }
  if (typeof moduleNamespace.runCrossModeBaselineBenchmark !== 'function') {
    throw new Error('Missing runCrossModeBaselineBenchmark() export.');
  }

  const plan = moduleNamespace.buildCrossModeBenchmarkPlan();
  const run = moduleNamespace.runCrossModeBaselineBenchmark();
  if (run.plan?.tupleDigest !== plan.tupleDigest) {
    throw new Error('Cross-mode plan digest mismatch between plan/run exports.');
  }

  return { plan, run };
}

async function writeArtifacts(output, outDirRelative) {
  const outDir = path.resolve(ROOT, outDirRelative);
  await mkdir(outDir, { recursive: true });
  const planPath = path.join(outDir, `cross-mode-plan_${output.plan.tupleDigest}.json`);
  const runPath = path.join(outDir, `cross-mode-run_${output.run.artifactDigest}.json`);
  const summaryPath = path.join(outDir, `cross-mode-summary_${output.run.artifactDigest}.json`);

  const summary = {
    artifactType: 'cross-mode-benchmark-summary',
    schemaVersion: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    caseCount: output.run.plan.caseCount,
    profileIds: output.run.plan.cases.map((suiteCase) => suiteCase.profileId),
    planTupleDigest: output.plan.tupleDigest,
    runArtifactDigest: output.run.artifactDigest,
  };

  await Promise.all([
    writeFile(planPath, `${JSON.stringify(output.plan, null, 2)}\n`, 'utf8'),
    writeFile(runPath, `${JSON.stringify(output.run, null, 2)}\n`, 'utf8'),
    writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
  ]);

  return { outDir, planPath, runPath, summaryPath };
}

async function cleanup() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

async function main() {
  const argv = process.argv.slice(2);
  const outDirRelative = parseOutDir(argv);
  const remainingArgs = stripOutDirArg(argv);
  assertNoUnsupportedArgs(remainingArgs);

  try {
    await bundleModule();
    const output = await executeBenchmark();
    const artifacts = await writeArtifacts(output, outDirRelative);

    console.log(`[cross-mode-benchmark] artifacts directory: ${path.relative(ROOT, artifacts.outDir)}`);
    console.log(`[cross-mode-benchmark] plan artifact: ${path.relative(ROOT, artifacts.planPath)}`);
    console.log(`[cross-mode-benchmark] run artifact: ${path.relative(ROOT, artifacts.runPath)}`);
    console.log(
      `[cross-mode-benchmark] summary artifact: ${path.relative(ROOT, artifacts.summaryPath)}`,
    );
    console.log(`[cross-mode-benchmark] tuple digest: ${output.plan.tupleDigest}`);
    console.log(`[cross-mode-benchmark] run digest: ${output.run.artifactDigest}`);

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('[run-cross-mode-benchmark] failed with unexpected error.');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

await main();
