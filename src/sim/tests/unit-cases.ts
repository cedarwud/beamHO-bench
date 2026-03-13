import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { computeThroughputMbps, evaluateLinksForUe, selectBestLink } from '@/sim/channel/link-budget';
import { applyHandoverStateMachine } from '@/sim/handover/state-machine';
import { sampleKey } from '@/sim/handover/baseline-helpers';
import { resolveCoupledHandoverConflicts } from '@/sim/scheduler/coupled-resolver';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { BeamState, SatelliteState } from '@/sim/types';
import { assertCondition, createBaseUe, createInvisibleSatellite } from './helpers';
import { buildGainModelUnitCases } from './unit-cases-gain-model';
import { buildObserverSkyCompositionUnitCases } from './unit-cases-observer-sky-composition';
import { buildObserverSkyViewUnitCases } from './unit-cases-observer-sky-view';
import { buildSatelliteRenderUnitCases } from './unit-cases-satellite-render';
import { buildSmallScaleUnitCases } from './unit-cases-small-scale';
import { buildTimerChoUnitCases } from './unit-cases-timer-cho';
import type { SimTestCase } from './types';

export function buildUnitTestCases(): SimTestCase[] {
  const createBeam = (
    beamId: number,
    centerX: number,
    centerZ: number,
    radiusWorld = 10,
  ): BeamState => ({
    beamId,
    centerLatLon: [0, 0],
    centerWorld: [centerX, 0, centerZ],
    radiusKm: 10,
    radiusWorld,
    connectedUeIds: [],
  });

  const createVisibleSatellite = (
    id: number,
    beam: BeamState,
    positionWorld: [number, number, number] = [0, 120, 0],
  ): SatelliteState => ({
    id,
    positionEcef: [0, 0, 0],
    positionWorld,
    positionLla: { lat: 0, lon: 0, altKm: 600 },
    azimuthDeg: 0,
    elevationDeg: 60,
    rangeKm: 120,
    visible: true,
    beams: [beam],
  });

  const createSchedulerSnapshot = (
    states: BeamSchedulerSnapshot['states'],
  ): BeamSchedulerSnapshot => ({
    tick: 1,
    timeSec: 1,
    summary: {
      mode: 'coupled',
      windowId: 0,
      totalBeamCount: states.length,
      activeBeamCount: states.filter((state) => state.isActive).length,
      utilizationRatio:
        states.length > 0
          ? states.filter((state) => state.isActive).length / states.length
          : 0,
      fairnessIndex: 1,
      scheduleStateHash: 'sched-unit-test',
    },
    states,
    events: [],
  });

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
      name: 'unit: mcs-mapped throughput is non-decreasing with SINR',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          channel: {
            throughputModel: {
              model: 'mcs-mapped',
              mcsTable: [
                { minSinrDb: -5, spectralEfficiencyBpsHz: 0.2 },
                { minSinrDb: 0, spectralEfficiencyBpsHz: 0.6 },
                { minSinrDb: 5, spectralEfficiencyBpsHz: 1.2 },
              ],
            },
          },
        });

        const low = computeThroughputMbps(profile, -6);
        const mid = computeThroughputMbps(profile, 0);
        const high = computeThroughputMbps(profile, 8);

        assertCondition(low <= mid && mid <= high, 'MCS-mapped throughput must be non-decreasing.');
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
      name: 'unit: reuse-4 link-budget partitions cross-color interference',
      kind: 'unit',
      run: () => {
        const fr1Profile = loadPaperProfile('case9-default', {
          beam: {
            frequencyReuse: 'FR1',
          },
        });
        const reuse4Profile = loadPaperProfile('case9-default', {
          beam: {
            frequencyReuse: 'reuse-4',
          },
        });

        const ue = createBaseUe({
          id: 99,
          servingSatId: 1,
          servingBeamId: 100,
          positionWorld: [0, 0, 0],
          positionLatLon: [0, 0],
        });
        const satellites = [
          createVisibleSatellite(1, createBeam(100, 0, 0, 40), [0, 120, 0]),
          createVisibleSatellite(2, createBeam(101, 0, 0, 40), [1, 120, 0]),
        ];

        const fr1Samples = evaluateLinksForUe(fr1Profile, ue, satellites);
        const reuse4Samples = evaluateLinksForUe(reuse4Profile, ue, satellites);

        const fr1Target = fr1Samples.find((sample) => sample.satId === 1 && sample.beamId === 100);
        const reuse4Target = reuse4Samples.find(
          (sample) => sample.satId === 1 && sample.beamId === 100,
        );

        assertCondition(fr1Samples.length === 2, 'Expected two candidate links in FR1 test setup.');
        assertCondition(
          reuse4Samples.length === 2,
          'Expected two candidate links in reuse-4 test setup.',
        );
        if (!fr1Target) {
          throw new Error('Missing FR1 target sample for sat=1/beam=100.');
        }
        if (!reuse4Target) {
          throw new Error('Missing reuse-4 target sample for sat=1/beam=100.');
        }
        assertCondition(
          reuse4Target.sinrDb > fr1Target.sinrDb,
          'reuse-4 should reduce cross-color interference and improve SINR.',
        );
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
    {
      name: 'unit: coupled resolver enforces per-beam capacity with deterministic tie-break',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
            maxUsersPerActiveBeam: 1,
            fairnessTargetJain: 0,
          },
        });
        const beam11 = createBeam(11, 0, 0);
        const beam12 = createBeam(12, 5, 0);
        const beamByKey = new Map([
          [sampleKey(1, 11), beam11],
          [sampleKey(1, 12), beam12],
        ]);
        const scheduler = createSchedulerSnapshot([
          {
            tick: 1,
            satId: 1,
            beamId: 11,
            isActive: true,
            freqBlockId: 1,
            powerClass: 'active',
            windowId: 0,
          },
          {
            tick: 1,
            satId: 1,
            beamId: 12,
            isActive: true,
            freqBlockId: 2,
            powerClass: 'active',
            windowId: 0,
          },
        ]);

        const result = resolveCoupledHandoverConflicts({
          profile,
          beamScheduler: scheduler,
          beamByKey,
          currentUes: [
            createBaseUe({ id: 1, servingSatId: 1, servingBeamId: 11, rsrpDbm: -100 }),
            createBaseUe({ id: 2, servingSatId: 1, servingBeamId: 11, rsrpDbm: -95 }),
          ],
          timeStepSec: 1,
          proposals: [
            {
              ueId: 1,
              servingSatId: 1,
              servingBeamId: 11,
              servingRsrpDbm: -100,
              targetSatId: 1,
              targetBeamId: 12,
              targetRsrpDbm: -85,
              targetSinrDb: 5,
              triggerEvent: true,
            },
            {
              ueId: 2,
              servingSatId: 1,
              servingBeamId: 11,
              servingRsrpDbm: -95,
              targetSatId: 1,
              targetBeamId: 12,
              targetRsrpDbm: -84,
              targetSinrDb: 6,
              triggerEvent: true,
            },
          ],
        });

        assertCondition(
          result.stats.blockedByScheduleHandoverCount === 1,
          'Expected exactly one capacity-blocked proposal.',
        );
        assertCondition(
          result.rejectedByUeId.size === 1,
          'Expected exactly one rejected UE for capacity guard.',
        );
        assertCondition(
          [...result.rejectedByUeId.values()][0] === 'blocked-by-schedule-capacity',
          'Expected capacity rejection reason.',
        );
      },
    },
    {
      name: 'unit: coupled resolver enforces overlap constraint',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
            fairnessTargetJain: 0,
          },
          beam: {
            overlapRatio: 0.1,
          },
        });
        const beam11 = createBeam(11, 0, 0, 10);
        const beam13 = createBeam(13, 80, 0, 10);
        const beamByKey = new Map([
          [sampleKey(1, 11), beam11],
          [sampleKey(1, 13), beam13],
        ]);
        const scheduler = createSchedulerSnapshot([
          {
            tick: 1,
            satId: 1,
            beamId: 11,
            isActive: true,
            freqBlockId: 1,
            powerClass: 'active',
            windowId: 0,
          },
          {
            tick: 1,
            satId: 1,
            beamId: 13,
            isActive: true,
            freqBlockId: 2,
            powerClass: 'active',
            windowId: 0,
          },
        ]);

        const result = resolveCoupledHandoverConflicts({
          profile,
          beamScheduler: scheduler,
          beamByKey,
          currentUes: [createBaseUe({ id: 7, servingSatId: 1, servingBeamId: 11 })],
          timeStepSec: 1,
          proposals: [
            {
              ueId: 7,
              servingSatId: 1,
              servingBeamId: 11,
              servingRsrpDbm: -90,
              targetSatId: 1,
              targetBeamId: 13,
              targetRsrpDbm: -88,
              targetSinrDb: 3,
              triggerEvent: true,
            },
          ],
        });

        assertCondition(
          result.rejectedByUeId.get(7) === 'blocked-by-schedule-overlap-constraint',
          'Expected overlap constraint rejection.',
        );
      },
    },
    {
      name: 'unit: coupled resolver enforces fairness guard target',
      kind: 'unit',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
            maxUsersPerActiveBeam: 10,
            fairnessTargetJain: 0.9,
          },
        });
        const beam11 = createBeam(11, 0, 0);
        const beam12 = createBeam(12, 6, 0);
        const beamByKey = new Map([
          [sampleKey(1, 11), beam11],
          [sampleKey(1, 12), beam12],
        ]);
        const scheduler = createSchedulerSnapshot([
          {
            tick: 1,
            satId: 1,
            beamId: 11,
            isActive: true,
            freqBlockId: 1,
            powerClass: 'active',
            windowId: 0,
          },
          {
            tick: 1,
            satId: 1,
            beamId: 12,
            isActive: true,
            freqBlockId: 2,
            powerClass: 'active',
            windowId: 0,
          },
        ]);

        const result = resolveCoupledHandoverConflicts({
          profile,
          beamScheduler: scheduler,
          beamByKey,
          currentUes: [
            createBaseUe({ id: 1, servingSatId: 1, servingBeamId: 11 }),
            createBaseUe({ id: 2, servingSatId: 1, servingBeamId: 12 }),
          ],
          timeStepSec: 1,
          proposals: [
            {
              ueId: 2,
              servingSatId: 1,
              servingBeamId: 12,
              servingRsrpDbm: -80,
              targetSatId: 1,
              targetBeamId: 11,
              targetRsrpDbm: -70,
              targetSinrDb: 10,
              triggerEvent: true,
            },
          ],
        });

        assertCondition(
          result.rejectedByUeId.get(2) === 'blocked-by-schedule-fairness-guard',
          'Expected fairness guard rejection.',
        );
      },
    },
    ...buildGainModelUnitCases(),
    ...buildObserverSkyCompositionUnitCases(),
    ...buildObserverSkyViewUnitCases(),
    ...buildSatelliteRenderUnitCases(),
    ...buildSmallScaleUnitCases(),
    ...buildTimerChoUnitCases(),
  ];
}
