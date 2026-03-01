import { buildValidationDefinitions } from '@/sim/bench/validation-definitions';
import { runCoreValidationSuite } from '@/sim/bench/validation-suite';
import { assertAlmostEqual, assertCondition } from './helpers';
import type { SimTestCase } from './types';

const BEAM_SWEEP_VALIDATION_ID = 'VAL-BG-BEAM-COUNT-SWEEP';

function getCsvCell(row: string[], header: string[], key: string): string {
  const index = header.indexOf(key);
  assertCondition(index >= 0, `Expected CSV header to include '${key}'.`);
  return row[index] ?? '';
}

export function buildBaselineGeneralizationIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: deferred rsma/drl scope is excluded from active validation gates',
      kind: 'integration',
      run: () => {
        const definitions = buildValidationDefinitions();
        const forbiddenPattern =
          /\brsma\b|\bsoft[-\s]?ho\b|\blarge[-\s]?scale\s+drl\b|\bmulti[-\s]?paper\s+drl\b/i;

        for (const definition of definitions) {
          assertCondition(
            !forbiddenPattern.test(definition.validationId),
            `Deferred scope keyword found in validationId '${definition.validationId}'.`,
          );
          for (const suiteCase of definition.cases) {
            assertCondition(
              !forbiddenPattern.test(suiteCase.caseId),
              `Deferred scope keyword found in caseId '${definition.validationId}/${suiteCase.caseId}'.`,
            );
          }
        }
      },
    },
    {
      name: 'integration: beam-count sweep emits metadata and normalized KPI output',
      kind: 'integration',
      run: () => {
        const suite = runCoreValidationSuite({ seed: 42 });
        const sweepResults = suite.results.filter(
          (result) => result.validationId === BEAM_SWEEP_VALIDATION_ID,
        );

        assertCondition(
          sweepResults.length === 3,
          `Expected 3 beam-count sweep cases, got ${sweepResults.length}.`,
        );

        const expectedBeamCounts = new Set([7, 16, 50]);
        const observedBeamCounts = new Set<number>();

        for (const result of sweepResults) {
          const beamCount = result.runtimeOverrides.beam?.beamsPerSatellite;
          assertCondition(
            typeof beamCount === 'number' && expectedBeamCounts.has(beamCount),
            `Expected beam-count override 7/16/50 in ${result.caseId}.`,
          );
          observedBeamCounts.add(beamCount);

          const run = result.batch.runs[0];
          assertCondition(Boolean(run), `Expected single baseline run in ${result.caseId}.`);
          const totalBeamCount = run.result.metadata.beamScheduler.totalBeamCount;
          const satelliteCount = run.result.summary.satelliteCount;
          assertCondition(
            totalBeamCount === satelliteCount * beamCount,
            `Expected totalBeamCount=${satelliteCount * beamCount}, got ${totalBeamCount} in ${result.caseId}.`,
          );

          const csvLines = result.batch.summaryCsv.trim().split('\n');
          assertCondition(csvLines.length >= 2, `Expected summary CSV rows in ${result.caseId}.`);
          const header = csvLines[0].split(',');
          const row = csvLines[1].split(',');

          const csvBeamCount = Number(getCsvCell(row, header, 'profile_beams_per_satellite'));
          const csvTotalBeams = Number(getCsvCell(row, header, 'scheduler_total_beams'));
          const csvThroughput = Number(getCsvCell(row, header, 'throughput_mbps'));
          const csvHandoverRate = Number(getCsvCell(row, header, 'handover_rate'));
          const normalizedThroughput = Number(
            getCsvCell(row, header, 'normalized_throughput_per_total_beam_mbps'),
          );
          const normalizedHandoverRate = Number(
            getCsvCell(row, header, 'normalized_handover_rate_per_total_beam'),
          );

          assertCondition(
            csvBeamCount === beamCount,
            `Expected profile_beams_per_satellite=${beamCount} in ${result.caseId}.`,
          );
          assertCondition(
            getCsvCell(row, header, 'profile_beam_layout').startsWith('hex-'),
            `Expected profile_beam_layout to be hex-* in ${result.caseId}.`,
          );
          assertCondition(
            Number.isFinite(normalizedThroughput) && normalizedThroughput >= 0,
            `Expected finite normalized throughput in ${result.caseId}.`,
          );
          assertCondition(
            Number.isFinite(normalizedHandoverRate) && normalizedHandoverRate >= 0,
            `Expected finite normalized handover rate in ${result.caseId}.`,
          );

          assertAlmostEqual(
            normalizedThroughput,
            csvThroughput / Math.max(csvTotalBeams, 1),
            1e-6,
          );
          assertAlmostEqual(
            normalizedHandoverRate,
            csvHandoverRate / Math.max(csvTotalBeams, 1),
            1e-6,
          );
        }

        assertCondition(
          observedBeamCounts.size === expectedBeamCounts.size,
          `Expected observed beam-count set size=${expectedBeamCounts.size}, got ${observedBeamCounts.size}.`,
        );
      },
    },
  ];
}
