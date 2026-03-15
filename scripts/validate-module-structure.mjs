#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const HARD_LINE_LIMIT = 650;
const WARN_LINE_LIMIT = 500;

const TARGET_DIRS = [
  'src/sim',
  'src/hooks',
  'src/config/paper-profiles',
  'src/config/research-parameters',
  'src/components',
  'src/viz',
];

// Pure data-definition files exempt from line limits (PROJECT_CONSTRAINTS §6.5:
// "有意義拆分" — splitting a single declarative array across files harms readability).
const EXEMPT_FILES = new Set([
  'src/config/research-parameters/specs.ts',
]);

const SCENARIO_DUPLICATE_PATTERNS = [
  'function worldToLatLon(',
  'function buildHexOffsets(',
  'function axialToWorld(',
  'function attachUesToBeams(',
];

async function collectFiles(dir) {
  const absoluteDir = path.join(ROOT, dir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path.relative(ROOT, nextPath))));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(path.relative(ROOT, nextPath));
    }
  }

  return files;
}

async function countLines(filePath) {
  const content = await fs.readFile(path.join(ROOT, filePath), 'utf8');
  return content.split(/\r?\n/).length;
}

async function validateLineCounts(files) {
  const warnings = [];
  const failures = [];

  for (const file of files) {
    if (EXEMPT_FILES.has(file)) {
      continue;
    }
    const lineCount = await countLines(file);
    if (lineCount > HARD_LINE_LIMIT) {
      failures.push(`${file}: ${lineCount} lines (limit ${HARD_LINE_LIMIT})`);
      continue;
    }
    if (lineCount > WARN_LINE_LIMIT) {
      warnings.push(`${file}: ${lineCount} lines (warning > ${WARN_LINE_LIMIT})`);
    }
  }

  return { warnings, failures };
}

async function validateScenarioDuplication() {
  const scenariosDir = path.join(ROOT, 'src/sim/scenarios');
  const entries = await fs.readdir(scenariosDir, { withFileTypes: true });
  const failures = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue;
    }
    if (entry.name.startsWith('common.')) {
      continue;
    }

    const rel = path.join('src/sim/scenarios', entry.name);
    const content = await fs.readFile(path.join(ROOT, rel), 'utf8');
    for (const pattern of SCENARIO_DUPLICATE_PATTERNS) {
      if (content.includes(pattern)) {
        failures.push(`${rel}: duplicate helper "${pattern}" should live in scenarios/common`);
      }
    }
  }

  return failures;
}

async function main() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    files.push(...(await collectFiles(dir)));
  }

  const { warnings, failures } = await validateLineCounts(files);
  const duplicationFailures = await validateScenarioDuplication();
  failures.push(...duplicationFailures);

  if (warnings.length > 0) {
    console.log('Module structure warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error('Module structure validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Module structure validation passed.');
}

main().catch((error) => {
  console.error('Module structure validation failed with unexpected error.');
  console.error(error);
  process.exit(1);
});
