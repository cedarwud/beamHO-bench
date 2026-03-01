import type {
  ValidationGateCheckStat,
  ValidationGateFailure,
  ValidationGateSummary,
  ValidationSuiteResult,
} from './validation-types';

export function buildValidationGateSummary(
  suite: ValidationSuiteResult,
): ValidationGateSummary {
  const failures: ValidationGateFailure[] = [];
  const warnings: ValidationGateFailure[] = [];
  const checkStatsMap = new Map<
    string,
    { blocking: boolean; evaluatedCases: number; passedCases: number; failedCases: number }
  >();

  for (const result of suite.results) {
    for (const check of result.checks) {
      const entry = checkStatsMap.get(check.checkId) ?? {
        blocking: check.blocking !== false,
        evaluatedCases: 0,
        passedCases: 0,
        failedCases: 0,
      };

      entry.blocking = check.blocking !== false;
      entry.evaluatedCases += 1;
      if (check.pass) {
        entry.passedCases += 1;
      } else {
        entry.failedCases += 1;
      }
      checkStatsMap.set(check.checkId, entry);
    }

    const failedBlockingChecks = result.checks
      .filter((check) => !check.pass && check.blocking !== false)
      .map((check) => check.checkId);
    if (failedBlockingChecks.length > 0) {
      failures.push({
        validationId: result.validationId,
        caseId: result.caseId,
        failedChecks: failedBlockingChecks,
      });
    }

    const failedNonBlockingChecks = result.checks
      .filter((check) => !check.pass && check.blocking === false)
      .map((check) => check.checkId);
    if (failedNonBlockingChecks.length > 0) {
      warnings.push({
        validationId: result.validationId,
        caseId: result.caseId,
        failedChecks: failedNonBlockingChecks,
      });
    }
  }

  const totalCases = suite.results.length;
  const failedCases = failures.length;
  const passedCases = totalCases - failedCases;
  const warningCases = warnings.length;
  const checkStats: ValidationGateCheckStat[] = [...checkStatsMap.entries()]
    .map(([checkId, stat]) => ({
      checkId,
      blocking: stat.blocking,
      evaluatedCases: stat.evaluatedCases,
      passedCases: stat.passedCases,
      failedCases: stat.failedCases,
      passRate:
        stat.evaluatedCases > 0 ? Number((stat.passedCases / stat.evaluatedCases).toFixed(6)) : 0,
      coverageRate:
        totalCases > 0 ? Number((stat.evaluatedCases / totalCases).toFixed(6)) : 0,
    }))
    .sort((left, right) => left.checkId.localeCompare(right.checkId));

  const totalCheckEvaluations = checkStats.reduce(
    (sum, stat) => sum + stat.evaluatedCases,
    0,
  );
  const passedCheckEvaluations = checkStats.reduce(
    (sum, stat) => sum + stat.passedCases,
    0,
  );
  const failedCheckEvaluations = totalCheckEvaluations - passedCheckEvaluations;
  const failedBlockingCheckEvaluations = checkStats
    .filter((stat) => stat.blocking)
    .reduce((sum, stat) => sum + stat.failedCases, 0);
  const failedNonBlockingCheckEvaluations =
    failedCheckEvaluations - failedBlockingCheckEvaluations;

  return {
    generatedAtUtc: suite.generatedAtUtc,
    seed: suite.seed,
    totalCases,
    passedCases,
    failedCases,
    warningCases,
    totalCheckEvaluations,
    passedCheckEvaluations,
    failedCheckEvaluations,
    failedBlockingCheckEvaluations,
    failedNonBlockingCheckEvaluations,
    overallCheckPassRate:
      totalCheckEvaluations > 0
        ? Number((passedCheckEvaluations / totalCheckEvaluations).toFixed(6))
        : 0,
    pass: failedCases === 0,
    checkStats,
    failures,
    warnings,
  };
}
