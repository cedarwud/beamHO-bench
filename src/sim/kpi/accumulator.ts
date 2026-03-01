import type { KpiResult } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2022-A4EVENT-CORE
 * - PAP-2024-MCCHO-CORE
 *
 * Notes:
 * - KPI field semantics (HOF/RLF by HO state) follow paper baseline definitions.
 * - Jain fairness index is used as the load-balance KPI in baseline comparisons.
 */

interface TickKpiInput {
  previous: KpiResult;
  previousTick: number;
  timeSec: number;
  ueCount: number;
  handoverEvents: number;
  meanSinrDb: number;
  meanThroughputMbps: number;
  fairness: number;
  rlfDelta: {
    state1: number;
    state2: number;
  };
  hofDelta: {
    state2: number;
    state3: number;
  };
}

export function computeJainFairness(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }

  const sum = values.reduce((acc, value) => acc + value, 0);
  const squareSum = values.reduce((acc, value) => acc + value * value, 0);

  if (squareSum <= 0) {
    return 1;
  }

  return (sum * sum) / (values.length * squareSum);
}

export function updateKpiAccumulator(input: TickKpiInput): KpiResult {
  const samples = Math.max(input.previousTick, 0);
  const nextSamples = samples + 1;

  const avgDlSinr = (input.previous.avgDlSinr * samples + input.meanSinrDb) / nextSamples;
  const throughput = (input.previous.throughput * samples + input.meanThroughputMbps) / nextSamples;
  const jainFairness = (input.previous.jainFairness * samples + input.fairness) / nextSamples;

  const handoverRatePerTick = input.handoverEvents / Math.max(input.ueCount, 1);
  const handoverRate =
    input.timeSec > 0 ? (input.previous.handoverRate * samples + handoverRatePerTick) / nextSamples : 0;

  return {
    throughput,
    handoverRate,
    hof: {
      state2: input.previous.hof.state2 + input.hofDelta.state2,
      state3: input.previous.hof.state3 + input.hofDelta.state3,
    },
    rlf: {
      state1: input.previous.rlf.state1 + input.rlfDelta.state1,
      state2: input.previous.rlf.state2 + input.rlfDelta.state2,
    },
    uho: input.previous.uho,
    hopp: input.previous.hopp,
    avgDlSinr,
    jainFairness,
  };
}
