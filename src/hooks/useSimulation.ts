import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  extractAssumptionIdsFromSourceMap,
  isCanonicalProfileId,
  loadPaperProfile,
  loadProfileSourceMap,
} from '@/config/paper-profiles/loader';
import { SimEngine } from '@/sim/engine';
import { createCase9AnalyticScenario } from '@/sim/scenarios/case9-analytic';
import { createRealTraceScenario } from '@/sim/scenarios/real-trace';
import type { SimSnapshot } from '@/sim/types';
import { createSimulationExporters } from './useSimulation.exporters';
import {
  type BaselineComparisonExportArtifact,
  type KpiExportArtifact,
  type RunBundleExportArtifact,
  type UseSimulationOptions,
  type UseSimulationResult,
  type ValidationSuiteExportArtifact,
} from './useSimulation.types';

export type {
  UseSimulationOptions,
  UseSimulationResult,
  KpiExportArtifact,
  BaselineComparisonExportArtifact,
  ValidationSuiteExportArtifact,
  RunBundleExportArtifact,
} from './useSimulation.types';

function normalizePlaybackRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 0.25), 8);
}

export function useSimulation(options: UseSimulationOptions = {}): UseSimulationResult {
  const {
    profileId = 'case9-default',
    runtimeOverrides = {},
    researchConsistency = null,
    baseline = 'max-rsrp',
    seed = 42,
    autoStart = false,
    playbackRate: initialPlaybackRate = 1,
  } = options;

  const runtimeOverrideKey = JSON.stringify(runtimeOverrides);

  const setup = useMemo(() => {
    const profile = loadPaperProfile(profileId, runtimeOverrides);
    const scenario =
      profile.mode === 'real-trace'
        ? createRealTraceScenario({ profile, seed, baseline })
        : createCase9AnalyticScenario({ profile, seed, baseline });
    const engine = new SimEngine({
      scenario,
      timeStepSec: profile.timeStepSec,
    });

    return {
      profile,
      scenario,
      engine,
      resolvedAssumptionIds: isCanonicalProfileId(profile.profileId)
        ? extractAssumptionIdsFromSourceMap(loadProfileSourceMap(profile.profileId))
        : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, seed, baseline, runtimeOverrideKey]);

  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => setup.engine.getSnapshot());
  const [isRunning, setIsRunning] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(() =>
    normalizePlaybackRate(initialPlaybackRate),
  );
  const historyRef = useRef<SimSnapshot[]>([]);

  const cloneSnapshot = useCallback((value: SimSnapshot): SimSnapshot => {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as SimSnapshot;
  }, []);

  useEffect(() => {
    const initialSnapshot = setup.engine.getSnapshot();
    setSnapshot(initialSnapshot);
    historyRef.current = [];

    const unsubscribe = setup.engine.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);

      historyRef.current.push(cloneSnapshot(nextSnapshot));
      if (historyRef.current.length > 7200) {
        historyRef.current.shift();
      }
    });

    if (autoStart) {
      setup.engine.start();
      setIsRunning(true);
    } else {
      setup.engine.stop();
      setIsRunning(false);
    }

    return () => {
      unsubscribe();
      setup.engine.stop();
      setIsRunning(false);
    };
  }, [setup, autoStart, cloneSnapshot]);

  useEffect(() => {
    setup.engine.setPlaybackRate(normalizePlaybackRate(playbackRate));
  }, [setup, playbackRate]);

  const start = useCallback(() => {
    setup.engine.start();
    setIsRunning(true);
  }, [setup]);

  const stop = useCallback(() => {
    setup.engine.stop();
    setIsRunning(false);
  }, [setup]);

  const step = useCallback(() => {
    setup.engine.step();
  }, [setup]);

  const reset = useCallback(() => {
    setup.engine.reset();
    const resetSnapshot = setup.engine.getSnapshot();
    historyRef.current = [cloneSnapshot(resetSnapshot)];
    setSnapshot(resetSnapshot);
  }, [setup, cloneSnapshot]);

  const setPlaybackRate = useCallback(
    (nextPlaybackRate: number) => {
      setup.engine.setPlaybackRate(nextPlaybackRate);
      setPlaybackRateState(setup.engine.getPlaybackRate());
    },
    [setup],
  );

  const exporters = useMemo(
    () =>
      createSimulationExporters({
        setup,
        profileId,
        baseline,
        seed,
        runtimeOverrides,
        researchConsistency,
        historyRef,
      }),
    [setup, profileId, baseline, seed, runtimeOverrides, researchConsistency],
  );

  return {
    profile: setup.profile,
    snapshot,
    baseline,
    isRunning,
    playbackRate,
    sourceTraceFileName: `source-trace_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`,
    kpiResultFileName: `result_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`,
    kpiTimeseriesFileName: `timeseries_${setup.scenario.id}_${profileId}_${seed}_${baseline}.csv`,
    start,
    stop,
    step,
    reset,
    setPlaybackRate,
    exportSourceTrace: exporters.exportSourceTrace,
    exportKpiReport: exporters.exportKpiReport,
    exportBaselineComparison: exporters.exportBaselineComparison,
    exportValidationSuite: exporters.exportValidationSuite,
    exportRunBundle: exporters.exportRunBundle,
  };
}
