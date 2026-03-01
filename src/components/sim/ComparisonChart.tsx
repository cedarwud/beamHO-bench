import type { BaselineBatchResult } from '@/sim/bench/runner';

interface ComparisonChartProps {
  batch: BaselineBatchResult | null;
}

interface ComparisonRow {
  baseline: string;
  throughput: number;
  avgDlSinr: number;
  handoverRate: number;
  jainFairness: number;
  rlfTotal: number;
  hofTotal: number;
}

type NumericMetricKey = Exclude<keyof ComparisonRow, 'baseline'>;

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

function toRows(batch: BaselineBatchResult): ComparisonRow[] {
  return batch.runs.map((run) => {
    const kpi = run.result.summary.kpi;
    return {
      baseline: run.baseline,
      throughput: kpi.throughput,
      avgDlSinr: kpi.avgDlSinr,
      handoverRate: kpi.handoverRate,
      jainFairness: kpi.jainFairness,
      rlfTotal: kpi.rlf.state1 + kpi.rlf.state2,
      hofTotal: kpi.hof.state2 + kpi.hof.state3,
    };
  });
}

function bestValue(rows: ComparisonRow[], key: NumericMetricKey, lowerBetter = false): number {
  if (rows.length === 0) {
    return NaN;
  }

  let best = rows[0][key];
  for (let index = 1; index < rows.length; index += 1) {
    const candidate = rows[index][key];
    if (lowerBetter ? candidate < best : candidate > best) {
      best = candidate;
    }
  }
  return best;
}

function isBest(value: number, best: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(best)) {
    return false;
  }
  return Math.abs(value - best) <= 1e-9;
}

export function ComparisonChart({ batch }: ComparisonChartProps) {
  if (!batch) {
    return null;
  }

  const rows = toRows(batch);
  if (rows.length === 0) {
    return null;
  }

  const bestThroughput = bestValue(rows, 'throughput');
  const bestSinr = bestValue(rows, 'avgDlSinr');
  const bestFairness = bestValue(rows, 'jainFairness');
  const bestHoRate = bestValue(rows, 'handoverRate', true);
  const bestRlf = bestValue(rows, 'rlfTotal', true);
  const bestHof = bestValue(rows, 'hofTotal', true);

  return (
    <div className="sim-compare">
      <div className="sim-compare__header">
        Baseline comparison ({batch.tickCount} ticks, seed {batch.seed})
      </div>
      <div className="sim-compare__table-wrap">
        <table className="sim-compare__table">
          <thead>
            <tr>
              <th>baseline</th>
              <th>throughput</th>
              <th>avg SINR</th>
              <th>HO rate</th>
              <th>fairness</th>
              <th>RLF total</th>
              <th>HOF total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.baseline}>
                <td>{row.baseline}</td>
                <td className={isBest(row.throughput, bestThroughput) ? 'sim-compare__best' : ''}>
                  {fmt(row.throughput, 3)}
                </td>
                <td className={isBest(row.avgDlSinr, bestSinr) ? 'sim-compare__best' : ''}>
                  {fmt(row.avgDlSinr, 3)}
                </td>
                <td className={isBest(row.handoverRate, bestHoRate) ? 'sim-compare__best' : ''}>
                  {fmt(row.handoverRate, 5)}
                </td>
                <td className={isBest(row.jainFairness, bestFairness) ? 'sim-compare__best' : ''}>
                  {fmt(row.jainFairness, 5)}
                </td>
                <td className={isBest(row.rlfTotal, bestRlf) ? 'sim-compare__best' : ''}>
                  {row.rlfTotal}
                </td>
                <td className={isBest(row.hofTotal, bestHof) ? 'sim-compare__best' : ''}>
                  {row.hofTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
