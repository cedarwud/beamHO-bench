import { loadPaperProfile } from '@/config/paper-profiles/loader';
import {
  createGreedySinrPolicyPlugin,
  createInvalidActionProbePolicyPlugin,
  createNoOpPolicyPlugin,
} from '@/sim/policy/builtin-plugins';
import { buildValidationDefinitions } from './validation-definitions';
import { runBaselineBatch } from './runner';
import {
  checkDeterminismConsistency,
  checkFidelity,
  checkKpiSanity,
  checkLinkStateConsistency,
  checkPolicyActionSafety,
  checkRuntimeParameterAudit,
  checkSchedulerStateSanity,
} from './validation-checks';
import { appendValidationGroupChecks } from './validation-group-checks';
import { isCoreValidationId } from './validation-scope';
import type {
  ValidationCheckResult,
  ValidationSuiteCaseDefinition,
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
      'check_policy_action_safety',
      'check_scheduler_state_sanity',
      'check_trend_directional',
      'check_rank_consistency',
      'check_small_scale_effect',
      'trend_metric',
      'trend_direction',
      'trend_tolerance',
      'baseline',
      'algorithm_fidelity',
      'throughput_model',
      'small_scale_model',
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
    const policyActionSafetyPass = result.checks.find(
      (check) => check.checkId === 'policy-action-safety',
    )?.pass;
    const schedulerStateSanityPass = result.checks.find(
      (check) => check.checkId === 'scheduler-state-sanity',
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
    const smallScaleEffectPass = result.checks.find(
      (check) => check.checkId === 'small-scale-effect',
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
          policyActionSafetyPass ? 'PASS' : 'FAIL',
          schedulerStateSanityPass ? 'PASS' : 'FAIL',
          trendDirectionalPass ? 'PASS' : 'FAIL',
          rankConsistencyPass ? 'PASS' : 'FAIL',
          smallScaleEffectPass ? 'PASS' : 'FAIL',
          trendMetric,
          trendDirection,
          trendTolerance,
          run.baseline,
          run.result.metadata.algorithmFidelity,
          run.result.metadata.throughputModel,
          run.result.metadata.smallScaleModel,
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
  const requestedScope = options.scope ?? 'all';
  const definitions = buildValidationDefinitions().filter((definition) =>
    requestedScope === 'core' ? isCoreValidationId(definition.validationId) : true,
  );
  const results: ValidationSuiteCaseResult[] = [];

  function resolvePolicyRuntimeForCase(
    suiteCase: ValidationSuiteCaseDefinition,
  ) {
    const mode = suiteCase.policyRuntime?.mode ?? 'off';
    if (mode !== 'on') {
      return { mode: 'off' as const };
    }

    const pluginFactory = () => {
      switch (suiteCase.policyRuntime?.pluginId) {
        case 'invalid-action-probe':
          return createInvalidActionProbePolicyPlugin();
        case 'noop':
          return createNoOpPolicyPlugin();
        case 'greedy-sinr':
        default:
          return createGreedySinrPolicyPlugin();
      }
    };

    return {
      mode: 'on' as const,
      pluginFactory,
    };
  }

  for (const definition of definitions) {
    for (const suiteCase of definition.cases) {
      const profile = loadPaperProfile(definition.profileId, suiteCase.runtimeOverrides ?? {});
      const policyRuntime = resolvePolicyRuntimeForCase(suiteCase);
      const batch = runBaselineBatch({
        profile,
        seed,
        baselines: suiteCase.baselines,
        tickCount: suiteCase.tickCount,
        captureSnapshots: true,
        policyRuntime,
      });
      const replayBatch = runBaselineBatch({
        profile,
        seed,
        baselines: suiteCase.baselines,
        tickCount: suiteCase.tickCount,
        captureSnapshots: false,
        policyRuntime,
      });

      const checks: ValidationCheckResult[] = [
        checkDeterminismConsistency(batch, replayBatch),
        checkFidelity(batch, definition.requiresFullFidelity ?? false),
        checkKpiSanity(batch),
        checkRuntimeParameterAudit(batch),
        checkLinkStateConsistency(batch),
        checkPolicyActionSafety(batch),
        checkSchedulerStateSanity(batch),
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

  appendValidationGroupChecks(results);

  return {
    generatedAtUtc: new Date().toISOString(),
    seed,
    results,
    summaryCsv: buildSuiteSummaryCsv(results),
  };
}
