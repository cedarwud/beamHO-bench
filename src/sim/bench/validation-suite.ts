import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { buildValidationDefinitions } from './validation-definitions';
import { runBaselineBatch } from './runner';
import {
  checkDeterminismConsistency,
  checkFidelity,
  checkKpiSanity,
  checkLinkStateConsistency,
  checkRuntimeParameterAudit,
} from './validation-checks';
import type {
  ValidationCheckResult,
  ValidationSuiteCaseResult,
  ValidationSuiteOptions,
  ValidationSuiteResult,
  ValidationTrendPolicy,
} from './validation-types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-validation-matrix.md
 * - sdd/completed/beamHO-bench-experiment-protocol.md
 *
 * Notes:
 * - This module executes the core VAL-* suite in deterministic batches.
 */

export type {
  ValidationGateFailure,
  ValidationGateSummary,
  ValidationSuiteCaseDefinition,
  ValidationSuiteDefinition,
  ValidationCheckResult,
  ValidationSuiteCaseResult,
  ValidationSuiteResult,
  ValidationSuiteOptions,
} from './validation-types';

const EPSILON = 1e-9;
const TREND_DIRECTION_TOLERANCE = 1e-6;

function totalFailureCount(kpi: {
  rlf: { state1: number; state2: number };
  hof: { state2: number; state3: number };
}): number {
  return kpi.rlf.state1 + kpi.rlf.state2 + kpi.hof.state2 + kpi.hof.state3;
}

function pickTrendMetric(
  result: ValidationSuiteCaseResult,
  metric: ValidationTrendPolicy['metric'],
): number {
  const firstRun = result.batch.runs[0];
  if (!firstRun) {
    return Number.NaN;
  }
  const kpi = firstRun.result.summary.kpi;

  switch (metric) {
    case 'failure-total':
      return totalFailureCount(kpi);
    case 'handover-rate':
      return kpi.handoverRate;
    case 'hopp':
      return kpi.hopp;
    default:
      return kpi.handoverRate;
  }
}

function computeDirectionalCheck(
  group: ValidationSuiteCaseResult[],
  trendPolicy: ValidationTrendPolicy | undefined,
): ValidationCheckResult {
  if (group.length <= 1) {
    return {
      checkId: 'trend-directional',
      pass: true,
      detail: 'N/A (single-case validation group).',
      blocking: false,
    };
  }

  if (!trendPolicy) {
    return {
      checkId: 'trend-directional',
      pass: true,
      detail: 'N/A (no directional trend policy configured for this validation group).',
      blocking: false,
    };
  }

  const singleBaselineGroup = group.every((result) => result.batch.runs.length === 1);
  if (!singleBaselineGroup) {
    return {
      checkId: 'trend-directional',
      pass: true,
      detail: 'N/A (group has multi-baseline cases; directional sweep not evaluated).',
      blocking: false,
    };
  }

  const metrics = group.map((result) => pickTrendMetric(result, trendPolicy.metric));
  const allFinite = metrics.every((value) => Number.isFinite(value));
  if (!allFinite) {
    return {
      checkId: 'trend-directional',
      pass: false,
      detail: 'Directional trend metric contains non-finite values.',
      blocking: false,
    };
  }

  const minValue = Math.min(...metrics);
  const maxValue = Math.max(...metrics);
  const variation = maxValue - minValue;

  const violations: string[] = [];
  for (let index = 1; index < metrics.length; index += 1) {
    const previous = metrics[index - 1];
    const current = metrics[index];
    const delta = current - previous;
    const tolerance = trendPolicy.tolerance ?? TREND_DIRECTION_TOLERANCE;

    const violates =
      trendPolicy.direction === 'non-increasing'
        ? delta > tolerance
        : delta < -tolerance;

    if (violates) {
      const previousCase = group[index - 1];
      const currentCase = group[index];
      violations.push(
        `${previousCase.caseId}(${previous.toFixed(6)}) -> ${currentCase.caseId}(${current.toFixed(6)})`,
      );
    }
  }

  return {
    checkId: 'trend-directional',
    pass: violations.length === 0,
    detail:
      violations.length === 0
        ? `Directional trend satisfied (${trendPolicy.direction}, metric=${trendPolicy.metric}); variation min=${minValue.toFixed(6)}, max=${maxValue.toFixed(6)}.`
        : `Directional trend violated (${trendPolicy.direction}, metric=${trendPolicy.metric}): ${violations.slice(0, 2).join(' | ')}.`,
    blocking: false,
  };
}

function compareBaselineRanking(
  left: ValidationSuiteCaseResult['batch']['runs'][number],
  right: ValidationSuiteCaseResult['batch']['runs'][number],
): number {
  const leftKpi = left.result.summary.kpi;
  const rightKpi = right.result.summary.kpi;

  if (Math.abs(leftKpi.throughput - rightKpi.throughput) > EPSILON) {
    return rightKpi.throughput - leftKpi.throughput;
  }

  const leftFailures = totalFailureCount(leftKpi);
  const rightFailures = totalFailureCount(rightKpi);
  if (leftFailures !== rightFailures) {
    return leftFailures - rightFailures;
  }

  if (Math.abs(leftKpi.handoverRate - rightKpi.handoverRate) > EPSILON) {
    return leftKpi.handoverRate - rightKpi.handoverRate;
  }

  return left.baseline.localeCompare(right.baseline);
}

function computeRankCheck(group: ValidationSuiteCaseResult[]): ValidationCheckResult {
  const comparableCases = group.filter((result) => result.batch.runs.length >= 2);
  if (comparableCases.length === 0) {
    return {
      checkId: 'rank-consistency',
      pass: true,
      detail: 'N/A (no multi-baseline case in validation group).',
      blocking: false,
    };
  }

  const winners = new Set<string>();
  for (const result of comparableCases) {
    const sortedRuns = [...result.batch.runs].sort(compareBaselineRanking);
    const winner = sortedRuns[0];
    if (!winner) {
      return {
        checkId: 'rank-consistency',
        pass: false,
        detail: `Unable to derive ranking winner for ${result.validationId}/${result.caseId}.`,
        blocking: false,
      };
    }
    winners.add(winner.baseline);
  }

  return {
    checkId: 'rank-consistency',
    pass: winners.size <= 1,
    detail:
      winners.size <= 1
        ? `Ranking winner is consistent across comparable cases: ${[...winners][0] ?? 'N/A'}.`
        : `Ranking winner drift detected: ${[...winners].join(', ')}.`,
    blocking: false,
  };
}

function appendTrendAndRankChecks(results: ValidationSuiteCaseResult[]): void {
  const grouped = new Map<string, ValidationSuiteCaseResult[]>();

  for (const result of results) {
    const group = grouped.get(result.validationId) ?? [];
    group.push(result);
    grouped.set(result.validationId, group);
  }

  for (const group of grouped.values()) {
    const directionalCheck = computeDirectionalCheck(group, group[0]?.trendPolicy ?? undefined);
    const rankCheck = computeRankCheck(group);

    for (const result of group) {
      result.checks.push(
        {
          ...directionalCheck,
          detail: `${directionalCheck.detail} [group=${result.validationId}]`,
        },
        {
          ...rankCheck,
          detail: `${rankCheck.detail} [group=${result.validationId}]`,
        },
      );
    }
  }
}

function buildSuiteSummaryCsv(results: ValidationSuiteCaseResult[]): string {
  const lines = [
    [
      'validation_id',
      'case_id',
      'profile_id',
      'seed',
      'check_determinism',
      'check_fidelity_mode',
      'check_kpi_sanity',
      'check_runtime_parameter_audit',
      'check_link_state_consistency',
      'check_trend_directional',
      'check_rank_consistency',
      'trend_metric',
      'trend_direction',
      'trend_tolerance',
      'baseline',
      'algorithm_fidelity',
      'playback_rate',
      'tick',
      'time_sec',
      'throughput_mbps',
      'handover_rate',
      'avg_dl_sinr_db',
      'jain_fairness',
      'rlf_state1',
      'rlf_state2',
      'hof_state2',
      'hof_state3',
      'uho',
      'hopp',
    ].join(','),
  ];

  for (const result of results) {
    const fidelityPass = result.checks.find((check) => check.checkId === 'fidelity-mode')?.pass;
    const kpiPass = result.checks.find((check) => check.checkId === 'kpi-sanity')?.pass;
    const runtimeParameterAuditPass = result.checks.find(
      (check) => check.checkId === 'runtime-parameter-audit',
    )?.pass;
    const linkStatePass = result.checks.find(
      (check) => check.checkId === 'link-state-consistency',
    )?.pass;
    const determinismPass = result.checks.find(
      (check) => check.checkId === 'determinism',
    )?.pass;
    const trendDirectionalPass = result.checks.find(
      (check) => check.checkId === 'trend-directional',
    )?.pass;
    const rankConsistencyPass = result.checks.find(
      (check) => check.checkId === 'rank-consistency',
    )?.pass;
    const trendMetric = result.trendPolicy?.metric ?? '';
    const trendDirection = result.trendPolicy?.direction ?? '';
    const trendTolerance =
      result.trendPolicy && Number.isFinite(result.trendPolicy.tolerance)
        ? String(result.trendPolicy.tolerance)
        : '';

    for (const run of result.batch.runs) {
      const kpi = run.result.summary.kpi;
      lines.push(
        [
          result.validationId,
          result.caseId,
          result.profileId,
          result.seed,
          determinismPass ? 'PASS' : 'FAIL',
          fidelityPass ? 'PASS' : 'FAIL',
          kpiPass ? 'PASS' : 'FAIL',
          runtimeParameterAuditPass ? 'PASS' : 'FAIL',
          linkStatePass ? 'PASS' : 'FAIL',
          trendDirectionalPass ? 'PASS' : 'FAIL',
          rankConsistencyPass ? 'PASS' : 'FAIL',
          trendMetric,
          trendDirection,
          trendTolerance,
          run.baseline,
          run.result.metadata.algorithmFidelity,
          run.result.metadata.playbackRate.toFixed(2),
          run.result.summary.tick,
          run.result.summary.timeSec.toFixed(3),
          kpi.throughput.toFixed(6),
          kpi.handoverRate.toFixed(6),
          kpi.avgDlSinr.toFixed(6),
          kpi.jainFairness.toFixed(6),
          kpi.rlf.state1,
          kpi.rlf.state2,
          kpi.hof.state2,
          kpi.hof.state3,
          kpi.uho.toFixed(6),
          kpi.hopp.toFixed(6),
        ].join(','),
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

export function runCoreValidationSuite(
  options: ValidationSuiteOptions = {},
): ValidationSuiteResult {
  const seed = Number.isFinite(options.seed) ? Math.round(options.seed as number) : 42;
  const definitions = buildValidationDefinitions();
  const results: ValidationSuiteCaseResult[] = [];

  for (const definition of definitions) {
    for (const suiteCase of definition.cases) {
      const profile = loadPaperProfile(definition.profileId, suiteCase.runtimeOverrides ?? {});
      const batch = runBaselineBatch({
        profile,
        seed,
        baselines: suiteCase.baselines,
        tickCount: suiteCase.tickCount,
        captureSnapshots: true,
      });
      const replayBatch = runBaselineBatch({
        profile,
        seed,
        baselines: suiteCase.baselines,
        tickCount: suiteCase.tickCount,
        captureSnapshots: false,
      });

      const checks: ValidationCheckResult[] = [
        checkDeterminismConsistency(batch, replayBatch),
        checkFidelity(batch, definition.requiresFullFidelity ?? false),
        checkKpiSanity(batch),
        checkRuntimeParameterAudit(batch),
        checkLinkStateConsistency(batch),
      ];

      results.push({
        validationId: definition.validationId,
        caseId: suiteCase.caseId,
        profileId: definition.profileId,
        seed,
        trendPolicy: definition.trendPolicy ?? null,
        runtimeOverrides: suiteCase.runtimeOverrides ?? {},
        checks,
        batch,
      });
    }
  }

  appendTrendAndRankChecks(results);

  return {
    generatedAtUtc: new Date().toISOString(),
    seed,
    results,
    summaryCsv: buildSuiteSummaryCsv(results),
  };
}
