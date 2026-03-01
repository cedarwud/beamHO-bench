#!/usr/bin/env node

import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();

const ALLOWED_PAPER_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.txt',
  '.bib',
]);

const FORBIDDEN_BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.zip',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.epub',
]);

const DEFERRED_SCOPE_FORBIDDEN_PATTERNS = [
  {
    label: 'RSMA',
    pattern: /\brsma\b/i,
  },
  {
    label: 'soft-HO',
    pattern: /\bsoft[-\s]?ho\b/i,
  },
  {
    label: 'large-scale DRL',
    pattern: /\blarge[-\s]?scale\s+drl\b/i,
  },
  {
    label: 'multi-paper DRL',
    pattern: /\bmulti[-\s]?paper\s+drl\b/i,
  },
];

function listTrackedFiles() {
  const output = execSync('git ls-files', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function validateTrackedPaperFiles(files, errors) {
  const trackedPaperFiles = files.filter((file) => file.startsWith('papers/'));

  for (const file of trackedPaperFiles) {
    const extension = path.extname(file).toLowerCase();

    if (FORBIDDEN_BINARY_EXTENSIONS.has(extension)) {
      errors.push(`Tracked forbidden binary under papers/: ${file}`);
      continue;
    }

    if (!ALLOWED_PAPER_EXTENSIONS.has(extension)) {
      errors.push(`Tracked non-whitelisted papers/ file extension (${extension || 'none'}): ${file}`);
    }
  }
}

async function validateGitignorePolicy(errors) {
  const gitignore = await readFile(path.join(ROOT, '.gitignore'), 'utf8');

  const requiredPatterns = [
    'papers/**/*',
    '!papers/**/',
    '!papers/**/*.md',
    '!papers/**/*.json',
    '!papers/**/*.yml',
    '!papers/**/*.yaml',
    '!papers/**/*.txt',
    '!papers/**/*.bib',
  ];

  for (const pattern of requiredPatterns) {
    if (!gitignore.includes(pattern)) {
      errors.push(`.gitignore missing required papers policy pattern: '${pattern}'`);
    }
  }
}

async function validateDeferredScopePolicy(files, errors) {
  // Source: sdd/pending/beamHO-bench-baseline-generalization-sdd.md (BG-6)
  // Active runtime code must not introduce RSMA/large-scale DRL paths before scope reactivation.
  const runtimeCodeFiles = files.filter(
    (file) =>
      file.startsWith('src/') &&
      !file.includes('/tests/') &&
      /\.(ts|tsx|js|mjs|json)$/i.test(file),
  );

  for (const file of runtimeCodeFiles) {
    const content = await readFile(path.join(ROOT, file), 'utf8');
    for (const { label, pattern } of DEFERRED_SCOPE_FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `Deferred-scope keyword '${label}' found in runtime code: ${file}`,
        );
      }
    }
  }
}

async function main() {
  const errors = [];
  const trackedFiles = listTrackedFiles();
  validateTrackedPaperFiles(trackedFiles, errors);
  await validateGitignorePolicy(errors);
  await validateDeferredScopePolicy(trackedFiles, errors);

  if (errors.length > 0) {
    console.error('Repository policy validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
    return;
  }

  console.log('Repository policy validation passed.');
}

await main();
