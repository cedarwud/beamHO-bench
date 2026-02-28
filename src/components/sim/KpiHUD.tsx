import type { KpiResult } from '@/sim/types';

interface KpiHUDProps {
  kpi: KpiResult;
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

export function KpiHUD({ kpi }: KpiHUDProps) {
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
    </div>
  );
}
