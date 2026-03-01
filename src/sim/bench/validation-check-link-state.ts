import type { BaselineBatchResult } from './runner';
import type { ValidationCheckResult } from './validation-types';

interface LinkStateObservationFlags {
  hasLinkStateBaseline: boolean;
  observedChoPrepared: boolean;
  observedChoEvent: boolean;
  observedMcSecondary: boolean;
  observedMcEvent: boolean;
}

type SnapshotUe = NonNullable<BaselineBatchResult['runs'][number]['snapshots']>[number]['ues'][number];

function createObservationFlags(): LinkStateObservationFlags {
  return {
    hasLinkStateBaseline: false,
    observedChoPrepared: false,
    observedChoEvent: false,
    observedMcSecondary: false,
    observedMcEvent: false,
  };
}

function pushChoPreparedIssues(options: {
  runBaseline: string;
  tick: number;
  ue: SnapshotUe;
  issues: string[];
  flags: LinkStateObservationFlags;
}): void {
  const { runBaseline, tick, ue, issues, flags } = options;
  const preparedSatId = ue.choPreparedSatId ?? null;
  const preparedBeamId = ue.choPreparedBeamId ?? null;
  const preparedElapsedMs = ue.choPreparedElapsedMs ?? null;
  const preparedTargetMs = ue.choPreparedTargetMs ?? null;
  const preparedRemainingMs = ue.choPreparedRemainingMs ?? null;
  const geometryDistanceKm = ue.choGeometryDistanceKm ?? null;
  const geometryElevationDeg = ue.choGeometryElevationDeg ?? null;
  const geometryTimeToThresholdSec = ue.choGeometryTimeToThresholdSec ?? null;
  const hasPrepared =
    preparedSatId !== null ||
    preparedBeamId !== null ||
    preparedElapsedMs !== null ||
    preparedTargetMs !== null ||
    preparedRemainingMs !== null ||
    geometryDistanceKm !== null ||
    geometryElevationDeg !== null ||
    geometryTimeToThresholdSec !== null;

  if (!hasPrepared) {
    return;
  }

  flags.observedChoPrepared = true;

  if (preparedSatId === null || preparedBeamId === null) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} has incomplete prepared target.`);
  }

  if (ue.servingSatId === null || ue.servingBeamId === null) {
    issues.push(
      `baseline=${runBaseline} tick=${tick} ue=${ue.id} prepared target exists without serving link.`,
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
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} prepared target equals serving link.`);
  }

  if (preparedElapsedMs === null || preparedTargetMs === null) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} missing prepared timer fields.`);
  } else if (preparedElapsedMs < 0 || preparedTargetMs <= 0) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} has invalid prepared timer values.`);
  } else if (preparedElapsedMs >= preparedTargetMs) {
    issues.push(
      `baseline=${runBaseline} tick=${tick} ue=${ue.id} prepared timer should have executed already.`,
    );
  }

  if (preparedRemainingMs === null) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} missing ToS countdown remaining field.`);
  } else if (preparedRemainingMs < 0 || (preparedTargetMs !== null && preparedRemainingMs > preparedTargetMs + 1e-6)) {
    issues.push(
      `baseline=${runBaseline} tick=${tick} ue=${ue.id} has invalid ToS countdown remaining value.`,
    );
  }

  if (geometryDistanceKm === null || !Number.isFinite(geometryDistanceKm) || geometryDistanceKm < 0) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} missing/invalid CHO geometry distance field.`);
  }

  if (
    geometryElevationDeg === null ||
    !Number.isFinite(geometryElevationDeg) ||
    geometryElevationDeg < -90 ||
    geometryElevationDeg > 90
  ) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} missing/invalid CHO geometry elevation field.`);
  }

  if (
    geometryTimeToThresholdSec === null ||
    !Number.isFinite(geometryTimeToThresholdSec) ||
    geometryTimeToThresholdSec < 0
  ) {
    issues.push(
      `baseline=${runBaseline} tick=${tick} ue=${ue.id} missing/invalid CHO geometry time-to-threshold field.`,
    );
  }
}

function pushMcSecondaryIssues(options: {
  runBaseline: string;
  tick: number;
  ue: SnapshotUe;
  issues: string[];
  flags: LinkStateObservationFlags;
}): void {
  const { runBaseline, tick, ue, issues, flags } = options;
  const secondarySatId = ue.secondarySatId ?? null;
  const secondaryBeamId = ue.secondaryBeamId ?? null;
  const hasSecondary = secondarySatId !== null || secondaryBeamId !== null;
  if (!hasSecondary) {
    return;
  }

  flags.observedMcSecondary = true;

  if (secondarySatId === null || secondaryBeamId === null) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} has incomplete secondary link.`);
  }

  if (ue.servingSatId === null || ue.servingBeamId === null) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} secondary link exists without serving link.`);
  }

  if (
    secondarySatId !== null &&
    secondaryBeamId !== null &&
    ue.servingSatId !== null &&
    ue.servingBeamId !== null &&
    secondarySatId === ue.servingSatId &&
    secondaryBeamId === ue.servingBeamId
  ) {
    issues.push(`baseline=${runBaseline} tick=${tick} ue=${ue.id} secondary link equals serving link.`);
  }
}

export function checkLinkStateConsistency(batch: BaselineBatchResult): ValidationCheckResult {
  const flags = createObservationFlags();
  const issues: string[] = [];

  for (const run of batch.runs) {
    if (run.baseline !== 'cho' && run.baseline !== 'mc-ho') {
      continue;
    }
    flags.hasLinkStateBaseline = true;

    const snapshots = run.snapshots ?? [];
    for (const snapshot of snapshots) {
      for (const ue of snapshot.ues) {
        if (run.baseline === 'cho') {
          pushChoPreparedIssues({
            runBaseline: run.baseline,
            tick: snapshot.tick,
            ue,
            issues,
            flags,
          });
        }

        if (run.baseline === 'mc-ho') {
          pushMcSecondaryIssues({
            runBaseline: run.baseline,
            tick: snapshot.tick,
            ue,
            issues,
            flags,
          });
        }
      }

      for (const event of snapshot.hoEvents) {
        if (run.baseline === 'cho' && event.reason.startsWith('cho')) {
          flags.observedChoEvent = true;
          if (event.toSatId === null || event.toBeamId === null) {
            issues.push(
              `baseline=${run.baseline} tick=${snapshot.tick} ue=${event.ueId} event missing target sat/beam.`,
            );
          }
        }

        if (run.baseline === 'mc-ho' && event.reason.startsWith('mc-ho')) {
          flags.observedMcEvent = true;
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

  if (!flags.hasLinkStateBaseline) {
    return {
      checkId: 'link-state-consistency',
      pass: true,
      detail: 'No CHO/MC-HO baseline in this case; check not applicable.',
    };
  }

  const observedPatterns: string[] = [];
  if (flags.observedChoPrepared) {
    observedPatterns.push('cho-prepared');
  }
  if (flags.observedChoEvent) {
    observedPatterns.push('cho-event');
  }
  if (flags.observedMcSecondary) {
    observedPatterns.push('mc-secondary');
  }
  if (flags.observedMcEvent) {
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
