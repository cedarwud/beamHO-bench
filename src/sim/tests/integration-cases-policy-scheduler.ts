import { loadPaperProfile } from '@/config/paper-profiles/loader';
import { runBaselineBatch } from '@/sim/bench/runner';
import {
  createGreedySinrPolicyPlugin,
  createInvalidActionProbePolicyPlugin,
} from '@/sim/policy/builtin-plugins';
import { buildRunManifest } from '@/sim/reporting/manifest';
import { createSourceTraceArtifact } from '@/sim/reporting/source-trace';
import { assertCondition, normalizeBatchForDeterminism } from './helpers';
import type { SimTestCase } from './types';

export function buildPolicySchedulerIntegrationCases(): SimTestCase[] {
  return [
    {
      name: 'integration: scheduler uncoupled mode preserves baseline parity',
      kind: 'integration',
      run: () => {
        const baseProfile = loadPaperProfile('case9-default');
        const uncoupledProfile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'uncoupled',
          },
        });

        const baseBatch = runBaselineBatch({
          profile: baseProfile,
          seed: 13,
          baselines: ['max-rsrp'],
          tickCount: 30,
        });
        const uncoupledBatch = runBaselineBatch({
          profile: uncoupledProfile,
          seed: 13,
          baselines: ['max-rsrp'],
          tickCount: 30,
        });

        assertCondition(
          JSON.stringify(normalizeBatchForDeterminism(baseBatch)) ===
            JSON.stringify(normalizeBatchForDeterminism(uncoupledBatch)),
          'Explicit uncoupled scheduler mode should preserve baseline parity.',
        );
      },
    },
    {
      name: 'integration: scheduler coupled mode emits constrained active beam state',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
          },
        });
        const batch = runBaselineBatch({
          profile,
          seed: 15,
          baselines: ['max-rsrp'],
          tickCount: 20,
          captureSnapshots: true,
        });

        const run = batch.runs[0];
        const scheduler = run.result.metadata.beamScheduler;
        assertCondition(scheduler.mode === 'coupled', 'Expected coupled scheduler mode metadata.');
        assertCondition(
          scheduler.activeBeamCount < scheduler.totalBeamCount,
          'Expected coupled mode to activate a subset of beams.',
        );
        const snapshots = run.snapshots ?? [];
        assertCondition(
          snapshots.every((snapshot) => Boolean(snapshot.beamScheduler)),
          'Expected beamScheduler snapshot payload on each captured tick.',
        );
      },
    },
    {
      name: 'integration: scheduler coupled mode is deterministic for fixed seed/profile',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
          },
        });

        const first = runBaselineBatch({
          profile,
          seed: 19,
          baselines: ['max-rsrp'],
          tickCount: 40,
        });
        const second = runBaselineBatch({
          profile,
          seed: 19,
          baselines: ['max-rsrp'],
          tickCount: 40,
        });

        assertCondition(
          JSON.stringify(normalizeBatchForDeterminism(first)) ===
            JSON.stringify(normalizeBatchForDeterminism(second)),
          'Coupled scheduler deterministic replay mismatch.',
        );
      },
    },
    {
      name: 'integration: scheduler metadata is exported to source-trace and manifest artifacts',
      kind: 'integration',
      run: async () => {
        const profile = loadPaperProfile('case9-default', {
          scheduler: {
            mode: 'coupled',
          },
        });
        const batch = runBaselineBatch({
          profile,
          seed: 21,
          baselines: ['max-rsrp'],
          tickCount: 10,
          captureSnapshots: true,
        });
        const run = batch.runs[0];
        const beamScheduler = run.result.metadata.beamScheduler;
        const latestSchedulerSnapshot =
          run.snapshots?.[run.snapshots.length - 1]?.beamScheduler ?? null;

        const sourceTrace = await createSourceTraceArtifact({
          scenarioId: run.result.metadata.scenarioId,
          profileId: 'case9-default',
          baseline: run.baseline,
          algorithmFidelity: profile.handover.algorithmFidelity,
          seed: 21,
          playbackRate: 1,
          beamScheduler: latestSchedulerSnapshot,
        });

        const manifest = buildRunManifest({
          scenarioId: run.result.metadata.scenarioId,
          profile,
          baseline: run.baseline,
          seed: 21,
          playbackRate: 1,
          profileChecksumSha256: 'test-profile-checksum',
          sourceCatalogChecksumSha256: 'test-source-catalog-checksum',
          resolvedAssumptionIds: run.result.metadata.resolvedAssumptionIds,
          runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
          beamScheduler: latestSchedulerSnapshot,
          validationGate: {
            pass: true,
            totalCases: 1,
            failedCases: 0,
          },
        });

        assertCondition(beamScheduler.mode === 'coupled', 'Expected coupled scheduler metadata.');
        assertCondition(
          sourceTrace.scheduler_mode === 'coupled',
          'Expected source-trace scheduler_mode to be coupled.',
        );
        assertCondition(
          manifest.scheduler_mode === 'coupled',
          'Expected manifest scheduler_mode to be coupled.',
        );
        assertCondition(
          sourceTrace.scheduler_state_hash.length > 0 &&
            manifest.scheduler_state_hash.length > 0,
          'Expected non-empty scheduler_state_hash in artifacts.',
        );
      },
    },
    {
      name: 'integration: policy-off batch path keeps deterministic parity with baseline path',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const baseBatch = runBaselineBatch({
          profile,
          seed: 17,
          baselines: ['a4'],
          tickCount: 30,
        });
        const policyOffBatch = runBaselineBatch({
          profile,
          seed: 17,
          baselines: ['a4'],
          tickCount: 30,
          policyRuntime: {
            mode: 'off',
          },
        });

        assertCondition(
          JSON.stringify(normalizeBatchForDeterminism(baseBatch)) ===
            JSON.stringify(normalizeBatchForDeterminism(policyOffBatch)),
          'Policy-off path must match baseline batch output for identical input tuple.',
        );
      },
    },
    {
      name: 'integration: policy-on greedy plugin is deterministic for same seed/profile/metadata',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const execute = () =>
          runBaselineBatch({
            profile,
            seed: 23,
            baselines: ['max-rsrp'],
            tickCount: 40,
            policyRuntime: {
              mode: 'on',
              pluginFactory: createGreedySinrPolicyPlugin,
            },
          });

        const first = execute();
        const second = execute();
        assertCondition(
          JSON.stringify(normalizeBatchForDeterminism(first)) ===
            JSON.stringify(normalizeBatchForDeterminism(second)),
          'Policy-on deterministic replay mismatch for identical input tuple.',
        );
      },
    },
    {
      name: 'integration: invalid policy action is rejected with deterministic hold fallback and audit event',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('case9-default');
        const batch = runBaselineBatch({
          profile,
          seed: 29,
          baselines: ['max-rsrp'],
          tickCount: 20,
          captureSnapshots: true,
          policyRuntime: {
            mode: 'on',
            pluginFactory: createInvalidActionProbePolicyPlugin,
          },
        });

        const run = batch.runs[0];
        assertCondition(Boolean(run), 'Expected one run for invalid-action policy test.');

        const policyRuntime = run.result.metadata.policyRuntime;
        assertCondition(policyRuntime.policyMode === 'on', 'Expected policy mode on.');
        assertCondition(
          policyRuntime.policyId === 'policy-invalid-action-probe',
          'Expected invalid-action probe policy metadata.',
        );
        assertCondition(
          policyRuntime.rejectionCount > 0,
          'Expected rejectionCount > 0 for invalid-action policy run.',
        );
        assertCondition(
          policyRuntime.decisionCount > 0,
          'Expected decisionCount > 0 for policy-on run.',
        );

        const snapshots = run.snapshots ?? [];
        const rejectionEvents = snapshots.flatMap((snapshot) =>
          snapshot.hoEvents.filter((event) => event.reason.startsWith('policy-reject:')),
        );
        assertCondition(
          rejectionEvents.length > 0,
          'Expected policy-reject events when invalid action is emitted.',
        );
      },
    },
    {
      name: 'integration: policy-on run works in real-trace mode with metadata populated',
      kind: 'integration',
      run: () => {
        const profile = loadPaperProfile('starlink-like');
        const batch = runBaselineBatch({
          profile,
          seed: 31,
          baselines: ['max-rsrp'],
          tickCount: 12,
          policyRuntime: {
            mode: 'on',
            pluginFactory: createGreedySinrPolicyPlugin,
          },
        });

        const run = batch.runs[0];
        assertCondition(Boolean(run), 'Expected one policy-on real-trace run.');
        assertCondition(
          run.result.summary.satelliteCount > 0,
          'Expected satellites in real-trace policy-on run.',
        );
        assertCondition(
          run.result.metadata.policyRuntime.policyMode === 'on',
          'Expected policy mode on in real-trace run metadata.',
        );
      },
    },
    {
      name: 'integration: policy metadata is exported to source-trace and manifest artifacts',
      kind: 'integration',
      run: async () => {
        const profile = loadPaperProfile('case9-default');
        const batch = runBaselineBatch({
          profile,
          seed: 37,
          baselines: ['max-rsrp'],
          tickCount: 10,
          policyRuntime: {
            mode: 'on',
            pluginFactory: createGreedySinrPolicyPlugin,
          },
        });
        const run = batch.runs[0];
        const policyRuntime = run.result.metadata.policyRuntime;

        const sourceTrace = await createSourceTraceArtifact({
          scenarioId: run.result.metadata.scenarioId,
          profileId: 'case9-default',
          baseline: run.baseline,
          algorithmFidelity: profile.handover.algorithmFidelity,
          seed: 37,
          playbackRate: 1,
          policyRuntime,
        });

        const manifest = buildRunManifest({
          scenarioId: run.result.metadata.scenarioId,
          profile,
          baseline: run.baseline,
          seed: 37,
          playbackRate: 1,
          profileChecksumSha256: 'test-profile-checksum',
          sourceCatalogChecksumSha256: 'test-source-catalog-checksum',
          resolvedAssumptionIds: run.result.metadata.resolvedAssumptionIds,
          runtimeParameterAudit: run.result.metadata.runtimeParameterAudit,
          policyRuntime,
          validationGate: {
            pass: true,
            totalCases: 1,
            failedCases: 0,
          },
        });

        assertCondition(sourceTrace.policy_mode === 'on', 'Expected source-trace policy_mode=on.');
        assertCondition(
          sourceTrace.policy_id === 'policy-greedy-sinr',
          'Expected source-trace policy_id to match runtime plugin.',
        );
        assertCondition(
          Object.keys(sourceTrace.policy_state_feature_sources).length > 0,
          'Expected policy state feature source map in source-trace.',
        );
        assertCondition(manifest.policy_mode === 'on', 'Expected manifest policy_mode=on.');
        assertCondition(
          manifest.policy_runtime_config_hash.length > 0,
          'Expected non-empty policy_runtime_config_hash in manifest.',
        );
      },
    },
  ];
}
