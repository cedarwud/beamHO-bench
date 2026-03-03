#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'repro-bundle-v1');
const BUNDLE_PATH = path.join(TMP_DIR, 'repro-bundle-v1.mjs');
const ENTRY_POINT = path.join(ROOT, 'src', 'sim', 'bench', 'repro-bundle-v1.ts');

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
      return argv[index + 1] ?? 'dist/repro-bundle-v1';
    }
    if (token.startsWith('--out_dir=')) {
      return token.slice('--out_dir='.length);
    }
  }
  return 'dist/repro-bundle-v1';
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
  throw new Error(`Unsupported arguments: ${argv.join(' ')}. Only '--out_dir <path>' is allowed.`);
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

async function executeBundleBuild() {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);
  if (typeof moduleNamespace.buildReproBundleV1Artifact !== 'function') {
    throw new Error('Missing buildReproBundleV1Artifact() export.');
  }
  const artifact = moduleNamespace.buildReproBundleV1Artifact();
  const replay = moduleNamespace.buildReproBundleV1Artifact();
  if (JSON.stringify(artifact) !== JSON.stringify(replay)) {
    throw new Error('Repro bundle v1 artifact must be deterministic for fixed tuple options.');
  }
  return artifact;
}

async function writeArtifacts(artifact, outDirRelative) {
  const outDir = path.resolve(ROOT, outDirRelative);
  await mkdir(outDir, { recursive: true });

  const bundlePath = path.join(outDir, `repro-bundle-v1_${artifact.artifactDigest}.json`);
  const manifestPath = path.join(outDir, `repro-bundle-v1-manifest_${artifact.artifactDigest}.json`);
  const crossModePath = path.join(
    outDir,
    `cross-mode-run_${artifact.components.crossMode.artifactDigest}.json`,
  );
  const baselineEnvelopePath = path.join(
    outDir,
    `baseline-parameter-envelope_${artifact.components.baselineParameterEnvelope.tupleDigest}.json`,
  );

  const manifest = {
    artifactType: 'repro-bundle-v1-manifest',
    schemaVersion: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    tupleDigest: artifact.tupleDigest,
    artifactDigest: artifact.artifactDigest,
    profileCoverage: artifact.profileCoverage,
    componentDigests: artifact.componentDigests,
    files: {
      bundle: path.basename(bundlePath),
      crossModeRun: path.basename(crossModePath),
      baselineEnvelope: path.basename(baselineEnvelopePath),
    },
  };

  await Promise.all([
    writeFile(bundlePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8'),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(crossModePath, `${JSON.stringify(artifact.components.crossMode, null, 2)}\n`, 'utf8'),
    writeFile(
      baselineEnvelopePath,
      `${JSON.stringify(artifact.components.baselineParameterEnvelope, null, 2)}\n`,
      'utf8',
    ),
  ]);

  return {
    outDir,
    bundlePath,
    manifestPath,
    crossModePath,
    baselineEnvelopePath,
  };
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
    const artifact = await executeBundleBuild();
    const paths = await writeArtifacts(artifact, outDirRelative);

    console.log(`[repro-bundle-v1] artifacts directory: ${path.relative(ROOT, paths.outDir)}`);
    console.log(`[repro-bundle-v1] bundle artifact: ${path.relative(ROOT, paths.bundlePath)}`);
    console.log(`[repro-bundle-v1] manifest artifact: ${path.relative(ROOT, paths.manifestPath)}`);
    console.log(`[repro-bundle-v1] cross-mode artifact: ${path.relative(ROOT, paths.crossModePath)}`);
    console.log(
      `[repro-bundle-v1] baseline-envelope artifact: ${path.relative(ROOT, paths.baselineEnvelopePath)}`,
    );
    console.log(`[repro-bundle-v1] tuple digest: ${artifact.tupleDigest}`);
    console.log(`[repro-bundle-v1] bundle digest: ${artifact.artifactDigest}`);

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('[run-repro-bundle-v1] failed with unexpected error.');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

await main();
