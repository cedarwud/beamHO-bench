import type { ValidationCheckResult, ValidationSuiteCaseResult, ValidationTrendPolicy } from './validation-types';

const EPSILON = 1e-9;
const TREND_DIRECTION_TOLERANCE = 1e-6;
const SMALL_SCALE_EFFECT_TOLERANCE = 1e-6;

function totalFailureCount(kpi: {
  rlf: { state1: number; state2: number };
  hof: { state2: number; state3: number };
}): number {
  return kpi.rlf.state1 + kpi.rlf.state2 + kpi.hof.state2 + kpi.hof.state3;
}

function countWindowTransitions(result: ValidationSuiteCaseResult): number {
  const firstRun = result.batch.runs[0];
  if (!firstRun) {
    return Number.NaN;
  }

  const snapshots = firstRun.snapshots ?? [];
  if (snapshots.length <= 1) {
    return 0;
  }

  if (snapshots.some((snapshot) => !snapshot.beamScheduler)) {
    return Number.NaN;
  }

  let transitions = 0;
  let previousWindowId = snapshots[0]?.beamScheduler?.summary.windowId ?? null;

  for (let index = 1; index < snapshots.length; index += 1) {
    const currentWindowId = snapshots[index]?.beamScheduler?.summary.windowId ?? null;
    if (previousWindowId === null || currentWindowId === null) {
      return Number.NaN;
    }
    if (currentWindowId !== previousWindowId) {
      transitions += 1;
    }
    previousWindowId = currentWindowId;
  }

  return transitions;
}

function countOverlapBlockedEvents(result: ValidationSuiteCaseResult): number {
  const firstRun = result.batch.runs[0];
  if (!firstRun) {
    return Number.NaN;
  }

  const snapshots = firstRun.snapshots ?? [];
  let blockedCount = 0;
  for (const snapshot of snapshots) {
    blockedCount += snapshot.hoEvents.filter(
      (event) =>
        event.reason ===
        'scheduler-block:blocked-by-schedule-overlap-constraint',
    ).length;
  }

  return blockedCount;
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
    case 'scheduler-window-transition-count':
      return countWindowTransitions(result);
    case 'scheduler-overlap-blocked-count':
      return countOverlapBlockedEvents(result);
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

function resolveSmallScaleModel(result: ValidationSuiteCaseResult): string | null {
  const overrideModel = result.runtimeOverrides.channel?.smallScaleModel;
  if (typeof overrideModel === 'string' && overrideModel.length > 0) {
    return overrideModel;
  }

  const run = result.batch.runs[0];
  return run ? run.result.metadata.smallScaleModel : null;
}

function hasKpiDelta(
  left: ValidationSuiteCaseResult['batch']['runs'][number],
  right: ValidationSuiteCaseResult['batch']['runs'][number],
): boolean {
  const leftKpi = left.result.summary.kpi;
  const rightKpi = right.result.summary.kpi;
  return (
    Math.abs(leftKpi.avgDlSinr - rightKpi.avgDlSinr) > SMALL_SCALE_EFFECT_TOLERANCE ||
    Math.abs(leftKpi.throughput - rightKpi.throughput) > SMALL_SCALE_EFFECT_TOLERANCE ||
    Math.abs(leftKpi.handoverRate - rightKpi.handoverRate) > SMALL_SCALE_EFFECT_TOLERANCE ||
    Math.abs(leftKpi.uho - rightKpi.uho) > SMALL_SCALE_EFFECT_TOLERANCE ||
    Math.abs(leftKpi.hopp - rightKpi.hopp) > SMALL_SCALE_EFFECT_TOLERANCE ||
    leftKpi.rlf.state1 !== rightKpi.rlf.state1 ||
    leftKpi.rlf.state2 !== rightKpi.rlf.state2 ||
    leftKpi.hof.state2 !== rightKpi.hof.state2 ||
    leftKpi.hof.state3 !== rightKpi.hof.state3
  );
}

function computeSmallScaleEffectCheck(group: ValidationSuiteCaseResult[]): ValidationCheckResult {
  const rows = group
    .map((result) => ({
      model: resolveSmallScaleModel(result),
      run: result.batch.runs[0],
      caseId: result.caseId,
    }))
    .filter(
      (entry): entry is { model: string; run: ValidationSuiteCaseResult['batch']['runs'][number]; caseId: string } =>
        Boolean(entry.model) && Boolean(entry.run),
    );

  if (rows.length <= 1) {
    return {
      checkId: 'small-scale-effect',
      pass: true,
      detail: 'N/A (insufficient single-baseline model rows for small-scale sweep check).',
    };
  }

  const noneRow = rows.find((entry) => entry.model === 'none');
  const nonNoneRows = rows.filter((entry) => entry.model !== 'none');

  if (!noneRow || nonNoneRows.length === 0) {
    return {
      checkId: 'small-scale-effect',
      pass: true,
      detail: 'N/A (validation group does not include none + non-none small-scale model pairs).',
    };
  }

  const changedRows = nonNoneRows.filter((entry) => hasKpiDelta(entry.run, noneRow.run));

  return {
    checkId: 'small-scale-effect',
    pass: changedRows.length > 0,
    detail:
      changedRows.length > 0
        ? `Small-scale switch changed KPI fingerprint vs none for ${changedRows.map((entry) => `${entry.caseId}:${entry.model}`).join(', ')}.`
        : `No KPI/SINR delta detected versus none model in group cases: ${nonNoneRows.map((entry) => `${entry.caseId}:${entry.model}`).join(', ')}.`,
  };
}

export function appendValidationGroupChecks(results: ValidationSuiteCaseResult[]): void {
  const grouped = new Map<string, ValidationSuiteCaseResult[]>();

  for (const result of results) {
    const group = grouped.get(result.validationId) ?? [];
    group.push(result);
    grouped.set(result.validationId, group);
  }

  for (const group of grouped.values()) {
    const directionalCheck = computeDirectionalCheck(group, group[0]?.trendPolicy ?? undefined);
    const rankCheck = computeRankCheck(group);
    const smallScaleEffectCheck = computeSmallScaleEffectCheck(group);

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
        {
          ...smallScaleEffectCheck,
          detail: `${smallScaleEffectCheck.detail} [group=${result.validationId}]`,
        },
      );
    }
  }
}
