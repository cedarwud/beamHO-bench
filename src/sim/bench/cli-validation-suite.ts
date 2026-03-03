import { runCoreValidationSuite } from './validation-suite';
import { buildValidationGateSummary } from './validation-gate';
import {
  buildRuntimeParameterAuditSummary,
  type RuntimeParameterAuditSummary,
} from './runtime-parameter-audit-summary';
import type { ValidationExecutionScope } from './validation-scope';
import type { ValidationGateSummary, ValidationSuiteResult } from './validation-types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-validation-matrix.md
 *
 * Notes:
 * - CLI gate for deterministic VAL-* execution in CI/stage validation.
 */

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

function parseSeed(raw: string | undefined): number {
  if (!raw) {
    return 42;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 42;
  }
  return Math.round(parsed);
}

function parseScope(raw: string | undefined): ValidationExecutionScope {
  return raw === 'core' ? 'core' : 'all';
}

export interface ValidationSuiteGateResult {
  suite: ValidationSuiteResult;
  summary: ValidationGateSummary;
  runtimeParameterAuditSummary: RuntimeParameterAuditSummary;
  exitCode: number;
}

export function runValidationSuiteGate(
  seed = parseSeed(process.env.VALIDATION_SEED),
  scope: ValidationExecutionScope = parseScope(process.env.VALIDATION_SCOPE),
): ValidationSuiteGateResult {
  const suite = runCoreValidationSuite({ seed, scope });
  const summary = buildValidationGateSummary(suite);
  const runtimeParameterAuditSummary = buildRuntimeParameterAuditSummary(suite);

  return {
    suite,
    summary,
    runtimeParameterAuditSummary,
    exitCode: summary.pass ? 0 : 1,
  };
}

export function runValidationSuiteCli(
  seed = parseSeed(process.env.VALIDATION_SEED),
  scope: ValidationExecutionScope = parseScope(process.env.VALIDATION_SCOPE),
): number {
  const gate = runValidationSuiteGate(seed, scope);
  const { suite, summary } = gate;

  console.log(
    `[validation-suite] scope=${scope} seed=${suite.seed} cases=${summary.totalCases} passed=${summary.passedCases} failed=${summary.failedCases} warnings=${summary.warningCases} checkPassRate=${summary.overallCheckPassRate}`,
  );
  for (const stat of summary.checkStats) {
    console.log(
      `[validation-suite] check=${stat.checkId} blocking=${stat.blocking} pass=${stat.passedCases}/${stat.evaluatedCases} passRate=${stat.passRate} coverage=${stat.coverageRate}`,
    );
  }

  console.log(
    `[validation-suite] runtime-parameter-audit pass=${gate.runtimeParameterAuditSummary.pass} failingRuns=${gate.runtimeParameterAuditSummary.failingRuns}/${gate.runtimeParameterAuditSummary.totalRuns}`,
  );

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

  return gate.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runValidationSuiteCli();
  process.exit(exitCode);
}
