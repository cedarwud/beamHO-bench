#!/usr/bin/env node

import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';

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
  // Source: sdd/completed/beamHO-bench-baseline-generalization-sdd.md (BG-6)
  // Active runtime code must not introduce RSMA/large-scale DRL paths before scope reactivation.
  const runtimeCodeFiles = files.filter(
    (file) =>
      file.startsWith('src/') &&
      !file.includes('/tests/') &&
      /\.(ts|tsx|js|mjs|json)$/i.test(file),
  );

  for (const file of runtimeCodeFiles) {
    let content;
    try {
      content = await readFile(path.join(ROOT, file), 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        // Ignore files deleted in working tree before commit finalization.
        continue;
      }
      throw error;
    }
    for (const { label, pattern } of DEFERRED_SCOPE_FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `Deferred-scope keyword '${label}' found in runtime code: ${file}`,
        );
      }
    }
  }
}

async function listMarkdownFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name);
}

function readMarkdownStatus(content) {
  const match = content.match(/^\*\*Status:\*\*\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

async function validateSddPendingBacklogSeparation(errors) {
  // Source: PROJECT_CONSTRAINTS.md §6.3
  // Active pending and long-term backlog SDD documents must remain separated by directory role.
  const pendingDir = path.join(ROOT, 'sdd', 'pending');
  const backlogDir = path.join(ROOT, 'sdd', 'backlog');

  let pendingMarkdownFiles = [];
  let backlogMarkdownFiles = [];
  try {
    pendingMarkdownFiles = await listMarkdownFiles(pendingDir);
  } catch {
    errors.push('Missing required SDD directory: sdd/pending');
    return;
  }
  try {
    backlogMarkdownFiles = await listMarkdownFiles(backlogDir);
  } catch {
    errors.push('Missing required SDD directory: sdd/backlog');
    return;
  }

  const pendingSpecs = pendingMarkdownFiles.filter((name) => name.toLowerCase() !== 'readme.md');
  const backlogSpecs = backlogMarkdownFiles.filter((name) => name.toLowerCase() !== 'readme.md');

  if (pendingSpecs.length === 0) {
    errors.push('sdd/pending must contain at least one active pending SDD spec (*.md, excluding README).');
  }
  if (backlogSpecs.length === 0) {
    errors.push('sdd/backlog must contain at least one backlog SDD spec (*.md, excluding README).');
  }

  for (const pendingSpec of pendingSpecs) {
    const pendingName = pendingSpec.toLowerCase();
    if (pendingName.includes('backlog') || pendingName.includes('multiorbit')) {
      errors.push(`Backlog-scoped SDD must not stay under pending/: sdd/pending/${pendingSpec}`);
    }
    const content = await readFile(path.join(pendingDir, pendingSpec), 'utf8');
    const status = readMarkdownStatus(content);
    if (!status) {
      errors.push(`Pending SDD must declare **Status:** line: sdd/pending/${pendingSpec}`);
      continue;
    }
    if (/\bbacklog\b/i.test(status)) {
      errors.push(`Pending SDD marked as backlog-only: sdd/pending/${pendingSpec}`);
    }
  }

  for (const backlogSpec of backlogSpecs) {
    const content = await readFile(path.join(backlogDir, backlogSpec), 'utf8');
    const status = readMarkdownStatus(content);
    if (!status) {
      errors.push(`Backlog SDD must declare **Status:** line: sdd/backlog/${backlogSpec}`);
      continue;
    }
    if (/\bactive pending\b/i.test(status)) {
      errors.push(`Backlog SDD must not be marked as active pending: sdd/backlog/${backlogSpec}`);
    }
    if (!/\bbacklog\b/i.test(status)) {
      errors.push(`Backlog SDD status must include 'Backlog': sdd/backlog/${backlogSpec}`);
    }
  }
}

async function main() {
  const errors = [];
  const trackedFiles = listTrackedFiles();
  validateTrackedPaperFiles(trackedFiles, errors);
  await validateGitignorePolicy(errors);
  await validateDeferredScopePolicy(trackedFiles, errors);
  await validateSddPendingBacklogSeparation(errors);

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
