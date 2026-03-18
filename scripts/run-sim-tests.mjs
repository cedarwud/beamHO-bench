#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'sim-tests');
const BUNDLE_PATH = path.join(TMP_DIR, 'sim-tests-cli.mjs');
const ENTRY_POINT = path.join(ROOT, 'src/sim/tests/cli-sim-tests.ts');
const ARTIFACT_DIR = path.join(ROOT, 'dist');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'sim-test-summary.json');

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
    define: {
      // Cap trajectory cache window to 300s in tests to avoid OOM from
      // SGP4 propagation of 400+ satellites over 6600s.
      '__SIM_TEST_TRAJ_WINDOW_SEC__': '300',
    },
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

async function executeCli() {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);

  if (typeof moduleNamespace.runSimTestsCliDetailed === 'function') {
    const detailedResult = await moduleNamespace.runSimTestsCliDetailed();
    if (
      typeof detailedResult !== 'object' ||
      detailedResult === null ||
      typeof detailedResult.exitCode !== 'number'
    ) {
      throw new Error('runSimTestsCliDetailed() returned malformed result.');
    }
    return detailedResult;
  }

  if (typeof moduleNamespace.runSimTestsCli === 'function') {
    const exitCode = await moduleNamespace.runSimTestsCli();
    return { exitCode: typeof exitCode === 'number' ? exitCode : 1, summary: null };
  }

  throw new Error(
    'Bundled sim test module does not export runSimTestsCliDetailed() or runSimTestsCli().',
  );
}

async function writeSummaryArtifact(summary) {
  if (!summary) {
    return;
  }

  const artifact = {
    generatedAtIso: new Date().toISOString(),
    runner: 'test:sim',
    summary,
  };

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(SUMMARY_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(`[sim-tests] summary artifact: ${path.relative(ROOT, SUMMARY_PATH)}`);
}

async function cleanup() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

async function main() {
  try {
    await bundleCli();
    const runResult = await executeCli();
    await writeSummaryArtifact(runResult.summary);
    await cleanup();
    process.exit(typeof runResult.exitCode === 'number' ? runResult.exitCode : 1);
  } catch (error) {
    console.error('[run-sim-tests] failed with unexpected error.');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

await main();
