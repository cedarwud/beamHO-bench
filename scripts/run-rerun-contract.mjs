#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, '.tmp', 'rerun-contract');
const BUNDLE_PATH = path.join(TMP_DIR, 'rerun-contract-cli.mjs');
const ENTRY_POINT = path.join(ROOT, 'src/sim/bench/cli-rerun-contract.ts');

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
      return argv[index + 1] ?? 'dist/rerun';
    }
    if (token.startsWith('--out_dir=')) {
      return token.slice('--out_dir='.length);
    }
  }
  return 'dist/rerun';
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

async function executeCli(args) {
  const moduleUrl = `${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`;
  const moduleNamespace = await import(moduleUrl);

  if (typeof moduleNamespace.runRerunContractCli !== 'function') {
    throw new Error('Bundled rerun contract module does not export runRerunContractCli().');
  }

  return moduleNamespace.runRerunContractCli(args);
}

async function writeArtifacts(result, outDirRelative) {
  const outDir = path.resolve(ROOT, outDirRelative);
  await mkdir(outDir, { recursive: true });
  const tag = result.outputTag;

  const writes = [
    writeFile(
      path.join(outDir, `manifest_${tag}.json`),
      `${JSON.stringify(result.manifest, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outDir, `source-trace_${tag}.json`),
      `${JSON.stringify(result.sourceTrace, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outDir, `kpi-result_${tag}.json`),
      `${JSON.stringify(result.result, null, 2)}\n`,
      'utf8',
    ),
    writeFile(path.join(outDir, `summary_${tag}.csv`), result.summaryCsv, 'utf8'),
    writeFile(path.join(outDir, `timeseries_${tag}.csv`), result.timeseriesCsv, 'utf8'),
    writeFile(
      path.join(outDir, `rerun-digest-summary_${tag}.json`),
      `${JSON.stringify(result.digestSummary, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outDir, `rerun-contract_${tag}.json`),
      `${JSON.stringify(
        {
          scenario_id: result.scenarioId,
          profile_id: result.profileId,
          seed: result.seed,
          baseline_or_policy: result.baselineOrPolicy,
          tick_count: result.tickCount,
          digest_summary: result.digestSummary,
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
  ];

  await Promise.all(writes);
  return outDir;
}

async function cleanup() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

async function main() {
  const argv = process.argv.slice(2);
  const outDirRelative = parseOutDir(argv);
  const cliArgs = stripOutDirArg(argv);

  try {
    await bundleCli();
    const output = await executeCli(cliArgs);

    if (!output || typeof output.exitCode !== 'number') {
      throw new Error('runRerunContractCli() returned malformed result.');
    }

    if (output.exitCode !== 0 || !output.result) {
      if (output.error) {
        console.error(`[rerun-contract] ${output.error}`);
      } else {
        console.error('[rerun-contract] execution failed without detailed error.');
      }
      await cleanup();
      process.exit(1);
    }

    const outDir = await writeArtifacts(output.result, outDirRelative);
    console.log(`[rerun-contract] artifacts directory: ${path.relative(ROOT, outDir)}`);
    console.log(
      `[rerun-contract] digest tuple=${output.result.digestSummary.tupleHashSha256}`,
    );
    console.log(
      `[rerun-contract] digest manifest=${output.result.digestSummary.manifestHashSha256}`,
    );

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('[run-rerun-contract] failed with unexpected error.');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

await main();
