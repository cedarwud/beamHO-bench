import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { KpiResult, UEState } from '@/sim/types';

interface KpiHUDProps {
  kpi: KpiResult;
  ues: UEState[];
  baseline: RuntimeBaseline;
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

function fmtNullable(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

function computeMean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function KpiHUD({ kpi, ues, baseline }: KpiHUDProps) {
  const preparedUes = ues.filter(
    (ue) =>
      ue.choPreparedSatId !== null &&
      ue.choPreparedSatId !== undefined &&
      ue.choPreparedBeamId !== null &&
      ue.choPreparedBeamId !== undefined,
  );
  const minRemainingSec =
    preparedUes.length > 0
      ? Math.min(
          ...preparedUes.map((ue) => Math.max((ue.choPreparedRemainingMs ?? 0) / 1000, 0)),
        )
      : null;
  const meanDistanceKm = computeMean(
    preparedUes
      .map((ue) => ue.choGeometryDistanceKm)
      .filter((value): value is number => Number.isFinite(value as number)),
  );
  const meanElevationDeg = computeMean(
    preparedUes
      .map((ue) => ue.choGeometryElevationDeg)
      .filter((value): value is number => Number.isFinite(value as number)),
  );
  const meanTimeToThresholdSec = computeMean(
    preparedUes
      .map((ue) => ue.choGeometryTimeToThresholdSec)
      .filter((value): value is number => Number.isFinite(value as number)),
  );
  const choActive = baseline === 'cho';

  return (
    <div className="sim-kpi-grid" role="status" aria-live="polite">
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">Avg DL SINR</span>
        <strong className="sim-kpi-card__value">{fmt(kpi.avgDlSinr)} dB</strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">Throughput</span>
        <strong className="sim-kpi-card__value">{fmt(kpi.throughput)} Mbps</strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">HO Rate</span>
        <strong className="sim-kpi-card__value">{fmt(kpi.handoverRate, 4)}</strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">Jain Fairness</span>
        <strong className="sim-kpi-card__value">{fmt(kpi.jainFairness, 4)}</strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">RLF S1/S2</span>
        <strong className="sim-kpi-card__value">
          {kpi.rlf.state1}/{kpi.rlf.state2}
        </strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">HOF S2/S3</span>
        <strong className="sim-kpi-card__value">
          {kpi.hof.state2}/{kpi.hof.state3}
        </strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">CHO Prepared UEs</span>
        <strong className="sim-kpi-card__value">{choActive ? preparedUes.length : '-'}</strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">CHO ToS Countdown (min)</span>
        <strong className="sim-kpi-card__value">
          {choActive ? `${fmtNullable(minRemainingSec)} s` : '-'}
        </strong>
      </div>
      <div className="sim-kpi-card">
        <span className="sim-kpi-card__label">CHO Geo (d/e/t)</span>
        <strong className="sim-kpi-card__value">
          {choActive
            ? `${fmtNullable(meanDistanceKm)} km / ${fmtNullable(meanElevationDeg)} deg / ${fmtNullable(
                meanTimeToThresholdSec,
              )} s`
            : '-'}
        </strong>
      </div>
    </div>
  );
}
