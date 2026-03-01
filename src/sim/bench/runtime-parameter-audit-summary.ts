import { REQUIRED_RUNTIME_PARAMETER_AUDIT_KEYS } from '@/sim/audit/runtime-parameter-audit';
import type { RuntimeParameterAuditKey } from '@/sim/audit/runtime-parameter-audit';
import type { ValidationSuiteResult } from './validation-types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-requirements.md (FR-028)
 * - sdd/completed/beamHO-bench-validation-matrix.md
 *
 * Notes:
 * - This summary is designed for CI artifacts and paper appendix citation.
 */

export interface RuntimeParameterAuditFailureEntry {
  validationId: string;
  caseId: string;
  baseline: string;
  reason: 'missing-audit-payload' | 'missing-required-keys' | 'audit-pass-false';
  auditedTick: number | null;
  missingKeys: string[];
}

export interface RuntimeParameterAuditKeyCoverage {
  key: RuntimeParameterAuditKey;
  touchedRuns: number;
  missingRuns: number;
  touchedRate: number;
  missingRate: number;
}

export interface RuntimeParameterAuditSummary {
  generatedAtUtc: string;
  seed: number;
  totalCases: number;
  totalRuns: number;
  requiredKeys: RuntimeParameterAuditKey[];
  pass: boolean;
  passingRuns: number;
  failingRuns: number;
  missingAuditPayloadRuns: number;
  failingCases: number;
  keyCoverage: RuntimeParameterAuditKeyCoverage[];
  failures: RuntimeParameterAuditFailureEntry[];
}

export function buildRuntimeParameterAuditSummary(
  suite: ValidationSuiteResult,
): RuntimeParameterAuditSummary {
  const requiredKeys = [...REQUIRED_RUNTIME_PARAMETER_AUDIT_KEYS];
  const touchedCountByKey = new Map<RuntimeParameterAuditKey, number>();
  const missingCountByKey = new Map<RuntimeParameterAuditKey, number>();
  for (const key of requiredKeys) {
    touchedCountByKey.set(key, 0);
    missingCountByKey.set(key, 0);
  }

  let totalRuns = 0;
  let passingRuns = 0;
  let failingRuns = 0;
  let missingAuditPayloadRuns = 0;
  const failedCases = new Set<string>();
  const failures: RuntimeParameterAuditFailureEntry[] = [];

  for (const caseResult of suite.results) {
    for (const run of caseResult.batch.runs) {
      totalRuns += 1;
      const audit = run.result.metadata.runtimeParameterAudit;

      if (!audit) {
        failingRuns += 1;
        missingAuditPayloadRuns += 1;
        failedCases.add(`${caseResult.validationId}::${caseResult.caseId}`);
        failures.push({
          validationId: caseResult.validationId,
          caseId: caseResult.caseId,
          baseline: run.baseline,
          reason: 'missing-audit-payload',
          auditedTick: null,
          missingKeys: [...requiredKeys],
        });
        for (const key of requiredKeys) {
          missingCountByKey.set(key, (missingCountByKey.get(key) ?? 0) + 1);
        }
        continue;
      }

      const missingKeys = requiredKeys.filter((key) => !audit.touchedKeys.includes(key));
      for (const key of requiredKeys) {
        if (missingKeys.includes(key)) {
          missingCountByKey.set(key, (missingCountByKey.get(key) ?? 0) + 1);
        } else {
          touchedCountByKey.set(key, (touchedCountByKey.get(key) ?? 0) + 1);
        }
      }

      if (!audit.pass) {
        failingRuns += 1;
        failedCases.add(`${caseResult.validationId}::${caseResult.caseId}`);
        failures.push({
          validationId: caseResult.validationId,
          caseId: caseResult.caseId,
          baseline: run.baseline,
          reason: 'audit-pass-false',
          auditedTick: audit.tick,
          missingKeys: [...missingKeys],
        });
        continue;
      }

      if (missingKeys.length > 0) {
        failingRuns += 1;
        failedCases.add(`${caseResult.validationId}::${caseResult.caseId}`);
        failures.push({
          validationId: caseResult.validationId,
          caseId: caseResult.caseId,
          baseline: run.baseline,
          reason: 'missing-required-keys',
          auditedTick: audit.tick,
          missingKeys: [...missingKeys],
        });
        continue;
      }

      passingRuns += 1;
    }
  }

  const denominator = Math.max(totalRuns, 1);
  const keyCoverage: RuntimeParameterAuditKeyCoverage[] = requiredKeys.map((key) => {
    const touchedRuns = touchedCountByKey.get(key) ?? 0;
    const missingRuns = missingCountByKey.get(key) ?? 0;
    return {
      key,
      touchedRuns,
      missingRuns,
      touchedRate: touchedRuns / denominator,
      missingRate: missingRuns / denominator,
    };
  });

  failures.sort((left, right) => {
    if (left.validationId !== right.validationId) {
      return left.validationId.localeCompare(right.validationId);
    }
    if (left.caseId !== right.caseId) {
      return left.caseId.localeCompare(right.caseId);
    }
    return left.baseline.localeCompare(right.baseline);
  });

  return {
    generatedAtUtc: new Date().toISOString(),
    seed: suite.seed,
    totalCases: suite.results.length,
    totalRuns,
    requiredKeys,
    pass: failingRuns === 0,
    passingRuns,
    failingRuns,
    missingAuditPayloadRuns,
    failingCases: failedCases.size,
    keyCoverage,
    failures,
  };
}
