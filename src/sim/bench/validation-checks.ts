import type { BaselineBatchResult } from './runner';
import type { ValidationCheckResult } from './validation-types';

/**
 * Provenance:
 * - sdd/completed/beamHO-bench-validation-matrix.md
 *
 * Notes:
 * - Runtime consistency checks for KPI sanity and CHO/MC-HO link-state coherence.
 */

export function checkKpiSanity(batch: BaselineBatchResult): ValidationCheckResult {
  const failingBaseline = batch.runs.find((run) => {
    const kpi = run.result.summary.kpi;
    const finiteSet = [
      kpi.throughput,
      kpi.handoverRate,
      kpi.avgDlSinr,
      kpi.jainFairness,
      kpi.uho,
      kpi.hopp,
    ];
    const allFinite = finiteSet.every(Number.isFinite);
    const nonNegative =
      kpi.throughput >= 0 &&
      kpi.handoverRate >= 0 &&
      kpi.hof.state2 >= 0 &&
      kpi.hof.state3 >= 0 &&
      kpi.rlf.state1 >= 0 &&
      kpi.rlf.state2 >= 0 &&
      kpi.uho >= 0 &&
      kpi.hopp >= 0;

    return !allFinite || !nonNegative || kpi.hopp > kpi.uho + 1e-9;
  });

  if (failingBaseline) {
    return {
      checkId: 'kpi-sanity',
      pass: false,
      detail: `KPI sanity failed on baseline '${failingBaseline.baseline}'.`,
    };
  }

  return {
    checkId: 'kpi-sanity',
    pass: true,
    detail: 'All baseline runs satisfy KPI sanity checks.',
  };
}

export function checkFidelity(
  batch: BaselineBatchResult,
  requiresFullFidelity: boolean,
): ValidationCheckResult {
  if (!requiresFullFidelity) {
    return {
      checkId: 'fidelity-mode',
      pass: true,
      detail: 'No strict fidelity requirement for this validation case.',
    };
  }

  const nonFull = batch.runs.find(
    (run) => run.result.metadata.algorithmFidelity !== 'full',
  );

  if (nonFull) {
    return {
      checkId: 'fidelity-mode',
      pass: false,
      detail: `Baseline '${nonFull.baseline}' uses fidelity '${nonFull.result.metadata.algorithmFidelity}'.`,
    };
  }

  return {
    checkId: 'fidelity-mode',
    pass: true,
    detail: 'All baseline runs use full fidelity.',
  };
}

export function checkRuntimeParameterAudit(
  batch: BaselineBatchResult,
): ValidationCheckResult {
  const failing = batch.runs.find((run) => {
    const audit = run.result.metadata.runtimeParameterAudit;
    if (!audit) {
      return true;
    }
    return !audit.pass || audit.missingKeys.length > 0;
  });

  if (failing) {
    const audit = failing.result.metadata.runtimeParameterAudit;
    if (!audit) {
      return {
        checkId: 'runtime-parameter-audit',
        pass: false,
        detail: `Baseline '${failing.baseline}' has no runtime parameter audit payload.`,
      };
    }

    return {
      checkId: 'runtime-parameter-audit',
      pass: false,
      detail: `Baseline '${failing.baseline}' missing keys: ${audit.missingKeys.join(', ')}.`,
    };
  }

  return {
    checkId: 'runtime-parameter-audit',
    pass: true,
    detail: 'All baseline runs include FR-028 runtime parameter audit with full coverage.',
  };
}

export function checkLinkStateConsistency(
  batch: BaselineBatchResult,
): ValidationCheckResult {
  let hasLinkStateBaseline = false;
  let observedChoPrepared = false;
  let observedChoEvent = false;
  let observedMcSecondary = false;
  let observedMcEvent = false;
  const issues: string[] = [];

  for (const run of batch.runs) {
    if (run.baseline !== 'cho' && run.baseline !== 'mc-ho') {
      continue;
    }
    hasLinkStateBaseline = true;

    const snapshots = run.snapshots ?? [];
    for (const snapshot of snapshots) {
      for (const ue of snapshot.ues) {
        if (run.baseline === 'cho') {
          const preparedSatId = ue.choPreparedSatId ?? null;
          const preparedBeamId = ue.choPreparedBeamId ?? null;
          const preparedElapsedMs = ue.choPreparedElapsedMs ?? null;
          const preparedTargetMs = ue.choPreparedTargetMs ?? null;
          const hasPrepared =
            preparedSatId !== null ||
            preparedBeamId !== null ||
            preparedElapsedMs !== null ||
            preparedTargetMs !== null;

          if (!hasPrepared) {
            continue;
          }

          observedChoPrepared = true;

          if (preparedSatId === null || preparedBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} has incomplete prepared target.`,
            );
          }

          if (ue.servingSatId === null || ue.servingBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} prepared target exists without serving link.`,
            );
          }

          if (
            preparedSatId !== null &&
            preparedBeamId !== null &&
            ue.servingSatId !== null &&
            ue.servingBeamId !== null &&
            preparedSatId === ue.servingSatId &&
            preparedBeamId === ue.servingBeamId
          ) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} prepared target equals serving link.`,
            );
          }

          if (preparedElapsedMs === null || preparedTargetMs === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} missing prepared timer fields.`,
            );
          } else if (preparedElapsedMs < 0 || preparedTargetMs <= 0) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} has invalid prepared timer values.`,
            );
          } else if (preparedElapsedMs >= preparedTargetMs) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} prepared timer should have executed already.`,
            );
          }
        }

        if (run.baseline === 'mc-ho') {
          const secondarySatId = ue.secondarySatId ?? null;
          const secondaryBeamId = ue.secondaryBeamId ?? null;
          const hasSecondary = secondarySatId !== null || secondaryBeamId !== null;
          if (!hasSecondary) {
            continue;
          }

          observedMcSecondary = true;

          if (secondarySatId === null || secondaryBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} has incomplete secondary link.`,
            );
          }

          if (ue.servingSatId === null || ue.servingBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} secondary link exists without serving link.`,
            );
          }

          if (
            secondarySatId !== null &&
            secondaryBeamId !== null &&
            ue.servingSatId !== null &&
            ue.servingBeamId !== null &&
            secondarySatId === ue.servingSatId &&
            secondaryBeamId === ue.servingBeamId
          ) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${ue.id} secondary link equals serving link.`,
            );
          }
        }
      }

      for (const event of snapshot.hoEvents) {
        if (run.baseline === 'cho' && event.reason.startsWith('cho')) {
          observedChoEvent = true;
          if (event.toSatId === null || event.toBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${event.ueId} event missing target sat/beam.`,
            );
          }
        }

        if (run.baseline === 'mc-ho' && event.reason.startsWith('mc-ho')) {
          observedMcEvent = true;
          if (event.toSatId === null || event.toBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${event.ueId} event missing target sat/beam.`,
            );
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    return {
      checkId: 'link-state-consistency',
      pass: false,
      detail: issues.slice(0, 3).join(' | '),
    };
  }

  if (!hasLinkStateBaseline) {
    return {
      checkId: 'link-state-consistency',
      pass: true,
      detail: 'No CHO/MC-HO baseline in this case; check not applicable.',
    };
  }

  const observedPatterns: string[] = [];
  if (observedChoPrepared) {
    observedPatterns.push('cho-prepared');
  }
  if (observedChoEvent) {
    observedPatterns.push('cho-event');
  }
  if (observedMcSecondary) {
    observedPatterns.push('mc-secondary');
  }
  if (observedMcEvent) {
    observedPatterns.push('mc-event');
  }

  return {
    checkId: 'link-state-consistency',
    pass: true,
    detail:
      observedPatterns.length > 0
        ? `Observed patterns: ${observedPatterns.join(', ')}.`
        : 'No CHO/MC-HO link-state patterns observed in this case; no inconsistency detected.',
  };
}

export function checkPolicyActionSafety(
  batch: BaselineBatchResult,
): ValidationCheckResult {
  const policyEnabledRuns = batch.runs.filter(
    (run) => run.result.metadata.policyRuntime.policyMode === 'on',
  );

  if (policyEnabledRuns.length === 0) {
    return {
      checkId: 'policy-action-safety',
      pass: true,
      detail: 'No policy-enabled run in this case; check not applicable.',
      blocking: false,
    };
  }

  const missingMetadataRun = policyEnabledRuns.find((run) => {
    const policy = run.result.metadata.policyRuntime;
    return (
      !policy.policyId ||
      !policy.policyVersion ||
      !policy.checkpointHash ||
      !policy.runtimeConfigHash
    );
  });
  if (missingMetadataRun) {
    return {
      checkId: 'policy-action-safety',
      pass: false,
      detail: `Policy metadata incomplete for baseline '${missingMetadataRun.baseline}'.`,
    };
  }

  const noDecisionRun = policyEnabledRuns.find(
    (run) => run.result.metadata.policyRuntime.decisionCount <= 0,
  );
  if (noDecisionRun) {
    return {
      checkId: 'policy-action-safety',
      pass: false,
      detail: `Policy run '${noDecisionRun.baseline}' has non-positive decisionCount.`,
    };
  }

  const invalidProbeRuns = policyEnabledRuns.filter(
    (run) => run.result.metadata.policyRuntime.policyId === 'policy-invalid-action-probe',
  );
  for (const run of invalidProbeRuns) {
    const policy = run.result.metadata.policyRuntime;
    if (policy.rejectionCount <= 0) {
      return {
        checkId: 'policy-action-safety',
        pass: false,
        detail: `Invalid-action probe run '${run.baseline}' produced no policy rejection.`,
      };
    }

    const hasRejectionEvent = (run.snapshots ?? []).some((snapshot) =>
      snapshot.hoEvents.some((event) => event.reason.startsWith('policy-reject:')),
    );
    if (!hasRejectionEvent) {
      return {
        checkId: 'policy-action-safety',
        pass: false,
        detail: `Invalid-action probe run '${run.baseline}' has no policy-reject event.`,
      };
    }
  }

  return {
    checkId: 'policy-action-safety',
    pass: true,
    detail: `Policy metadata and guardrail checks passed for ${policyEnabledRuns.length} run(s).`,
  };
}

function fingerprintBatch(batch: BaselineBatchResult): string {
  const normalized = {
    profileId: batch.profileId,
    seed: batch.seed,
    tickCount: batch.tickCount,
    runs: batch.runs.map((run) => ({
      baseline: run.baseline,
      metadata: {
        scenarioId: run.result.metadata.scenarioId,
        profileId: run.result.metadata.profileId,
        baseline: run.result.metadata.baseline,
        algorithmFidelity: run.result.metadata.algorithmFidelity,
        seed: run.result.metadata.seed,
        playbackRate: run.result.metadata.playbackRate,
        resolvedAssumptionIds: [...run.result.metadata.resolvedAssumptionIds].sort(),
        runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
        policyRuntime: run.result.metadata.policyRuntime,
      },
      summary: run.result.summary,
      timeseriesCsv: run.timeseriesCsv,
    })),
  };

  return JSON.stringify(normalized);
}

export function checkDeterminismConsistency(
  reference: BaselineBatchResult,
  replay: BaselineBatchResult,
): ValidationCheckResult {
  const lhs = fingerprintBatch(reference);
  const rhs = fingerprintBatch(replay);

  if (lhs === rhs) {
    return {
      checkId: 'determinism',
      pass: true,
      detail: 'Replay batch fingerprint matched reference batch.',
    };
  }

  const mismatchBaseline = reference.runs.find((run, index) => {
    const replayRun = replay.runs[index];
    if (!replayRun) {
      return true;
    }
    const left = JSON.stringify({
      baseline: run.baseline,
      summary: run.result.summary,
      timeseriesCsv: run.timeseriesCsv,
    });
    const right = JSON.stringify({
      baseline: replayRun.baseline,
      summary: replayRun.result.summary,
      timeseriesCsv: replayRun.timeseriesCsv,
    });
    return left !== right;
  });

  return {
    checkId: 'determinism',
    pass: false,
    detail: mismatchBaseline
      ? `Determinism mismatch detected at baseline '${mismatchBaseline.baseline}'.`
      : 'Determinism mismatch detected (batch fingerprints differ).',
  };
}
