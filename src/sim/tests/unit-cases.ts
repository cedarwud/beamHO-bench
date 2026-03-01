import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { computeThroughputMbps, evaluateLinksForUe, selectBestLink } from '@/sim/channel/link-budget';
import { applyHandoverStateMachine } from '@/sim/handover/state-machine';
import { assertCondition, createBaseUe, createInvisibleSatellite } from './helpers';
import type { SimTestCase } from './types';

export function buildUnitTestCases(): SimTestCase[] {
  return [
    {
      name: 'unit: throughput monotonic with SINR',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const low = computeThroughputMbps(profile, -10);
        const mid = computeThroughputMbps(profile, 0);
        const high = computeThroughputMbps(profile, 10);

        assertCondition(low < mid && mid < high, 'Throughput must increase with SINR.');
      },
    },
    {
      name: 'unit: selectBestLink picks max-RSRP sample',
      kind: 'unit',
      run: () => {
        const selected = selectBestLink([
          { satId: 1, beamId: 1, rsrpDbm: -95, sinrDb: 1 },
          { satId: 2, beamId: 1, rsrpDbm: -85, sinrDb: 1 },
          { satId: 3, beamId: 1, rsrpDbm: -90, sinrDb: 1 },
        ]);

        assertCondition(selected !== null, 'selectBestLink should return a sample for non-empty input.');
        assertCondition(
          selected.satId === 2 && selected.beamId === 1,
          'selectBestLink should return highest-RSRP candidate.',
        );
      },
    },
    {
      name: 'unit: evaluateLinksForUe returns no samples for invisible satellite set',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const ue = createBaseUe();
        const samples = evaluateLinksForUe(profile, ue, [createInvisibleSatellite()]);
        assertCondition(samples.length === 0, 'No visible beam should produce no link samples.');
      },
    },
    {
      name: 'unit: state machine transitions 1 -> 2 -> 3 -> 1',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          rlfStateMachine: {
            n310: 1000,
            n311: 1,
          },
        });

        const first = applyHandoverStateMachine({
          profile,
          ues: [createBaseUe({ id: 11, hoState: 1, sinrDb: 20 })],
          events: [
            {
              tick: 1,
              ueId: 11,
              fromSatId: 1,
              toSatId: 2,
              fromBeamId: 1,
              toBeamId: 1,
              reason: 'test-event',
            },
          ],
        });
        assertCondition(first.ues[0].hoState === 2, 'Expected state transition 1 -> 2.');

        const second = applyHandoverStateMachine({
          profile,
          ues: first.ues,
          events: [],
        });
        assertCondition(second.ues[0].hoState === 3, 'Expected state transition 2 -> 3.');

        const third = applyHandoverStateMachine({
          profile,
          ues: second.ues,
          events: [],
        });
        assertCondition(third.ues[0].hoState === 1, 'Expected state transition 3 -> 1.');
      },
    },
    {
      name: 'unit: RLF declaration clears serving link under sustained out-of-sync',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          rlfStateMachine: {
            qOutDb: 10,
            qInDb: 20,
            t310Ms: 1000,
            n310: 1,
            n311: 999,
            l3FilterK: 0,
            harqMaxRetx: 1,
            rlcMaxRetx: 1,
            preambleMsg3MaxRetx: 1,
            raResponseTimerSubframes: 1,
            contentionResolutionTimerSubframes: 1,
          },
        });

        const result = applyHandoverStateMachine({
          profile,
          ues: [createBaseUe({ id: 12, sinrDb: -30, hoState: 1 })],
          events: [],
        });

        assertCondition(result.rlfDelta.state1 === 1, 'Expected one state1 RLF increment.');
        assertCondition(result.ues[0].servingSatId === null, 'RLF should clear servingSatId.');
        assertCondition(result.ues[0].servingBeamId === null, 'RLF should clear servingBeamId.');
      },
    },
  ];
}
