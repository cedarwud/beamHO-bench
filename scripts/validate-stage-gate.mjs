#!/usr/bin/env node

import path from 'node:path';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const REQUIRED_ARTIFACTS = [
  'dist/sim-test-summary.json',
  'dist/validation-suite.json',
  'dist/validation-gate-summary.json',
];

const STAGE_COMMANDS = [
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'test:sim']],
  ['npm', ['run', 'validate:rigor']],
  ['npm', ['run', 'validate:structure']],
  ['npm', ['run', 'validate:repo-policy']],
  ['npm', ['run', 'validate:val-suite']],
];

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: ROOT,
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit=${code ?? -1})`));
    });
  });
}

async function validateArtifactFreshness(stageStartMs) {
  for (const relativePath of REQUIRED_ARTIFACTS) {
    const absolutePath = path.join(ROOT, relativePath);
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch {
      throw new Error(`Required stage artifact is missing: ${relativePath}`);
    }

    if (!Number.isFinite(fileStat.mtimeMs) || fileStat.mtimeMs <= stageStartMs) {
      throw new Error(
        `Artifact is stale for current stage run: ${relativePath} (mtimeMs=${fileStat.mtimeMs}, stageStartMs=${stageStartMs})`,
      );
    }
  }
}

async function main() {
  const stageStartMs = Date.now();
  console.log(`[validate:stage] start_ms=${stageStartMs}`);

  for (const [command, args] of STAGE_COMMANDS) {
    await runCommand(command, args);
  }

  await validateArtifactFreshness(stageStartMs);
  console.log('[validate:stage] artifact freshness check passed.');
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error('[validate:stage] failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
