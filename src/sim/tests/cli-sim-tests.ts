import { buildIntegrationTestCases } from './integration-cases';
import { buildUnitTestCases } from './unit-cases';
import type { SimTestCase, SimTestResult, SimTestSummary } from './types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md (Section 11 Verification Strategy)
 * - sdd/completed/beamHO-bench-requirements.md (FR-015, NFR-001)
 *
 * Notes:
 * - This CLI executes deterministic SimCore unit/integration tests without external test frameworks.
 */

declare const process: {
  argv: string[];
  exit: (code?: number) => never;
};

function buildTestCases(): SimTestCase[] {
  return [...buildUnitTestCases(), ...buildIntegrationTestCases()];
}

async function executeTestCase(testCase: SimTestCase): Promise<SimTestResult> {
  const startedAt = performance.now();
  try {
    await testCase.run();
    return {
      name: testCase.name,
      kind: testCase.kind,
      pass: true,
      durationMs: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      name: testCase.name,
      kind: testCase.kind,
      pass: false,
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
  }
}

function summarize(results: SimTestResult[]): SimTestSummary {
  const summary: SimTestSummary = {
    total: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    byKind: {
      unit: { total: 0, passed: 0, failed: 0 },
      integration: { total: 0, passed: 0, failed: 0 },
    },
    results,
  };

  for (const result of results) {
    const bucket = summary.byKind[result.kind];
    bucket.total += 1;
    if (result.pass) {
      bucket.passed += 1;
    } else {
      bucket.failed += 1;
    }
  }

  return summary;
}

function printSummary(summary: SimTestSummary): void {
  console.log(
    `[sim-tests] total=${summary.total} passed=${summary.passed} failed=${summary.failed} unit=${summary.byKind.unit.passed}/${summary.byKind.unit.total} integration=${summary.byKind.integration.passed}/${summary.byKind.integration.total}`,
  );

  for (const result of summary.results) {
    const marker = result.pass ? 'PASS' : 'FAIL';
    console.log(
      `[sim-tests] ${marker} [${result.kind}] ${result.name} (${result.durationMs.toFixed(2)}ms)`,
    );
    if (!result.pass && result.error) {
      console.error(result.error);
    }
  }
}

function resolveExitCode(summary: SimTestSummary): number {
  return summary.failed === 0 ? 0 : 1;
}

export interface SimTestsCliDetailedResult {
  summary: SimTestSummary;
  exitCode: number;
}

export async function runSimTestsCliDetailed(): Promise<SimTestsCliDetailedResult> {
  const testCases = buildTestCases();
  const results: SimTestResult[] = [];

  for (const testCase of testCases) {
    const result = await executeTestCase(testCase);
    results.push(result);
  }

  const summary = summarize(results);
  printSummary(summary);
  return { summary, exitCode: resolveExitCode(summary) };
}

export async function runSimTestsCli(): Promise<number> {
  const runResult = await runSimTestsCliDetailed();
  return runResult.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runSimTestsCli();
  process.exit(exitCode);
}
