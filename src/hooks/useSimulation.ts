import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { SimEngine } from '@/sim/engine';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import {
  buildKpiResultArtifact,
  buildTimeseriesCsv,
  downloadTextArtifact,
  type KpiResultArtifact,
} from '@/sim/kpi/reporter';
import { createCase9AnalyticScenario } from '@/sim/scenarios/case9-analytic';
import {
  createSourceTraceArtifact,
  createSourceTraceDownload,
  type SourceTraceArtifact,
} from '@/sim/reporting/source-trace';
import type { SimSnapshot } from '@/sim/types';

export interface UseSimulationOptions {
  profileId?: CanonicalProfileId;
  runtimeOverrides?: DeepPartial<PaperProfile>;
  baseline?: RuntimeBaseline;
  seed?: number;
  autoStart?: boolean;
}

export interface KpiExportArtifact {
  resultArtifact: KpiResultArtifact;
  timeseriesCsv: string;
}

export interface UseSimulationResult {
  profile: PaperProfile;
  snapshot: SimSnapshot;
  baseline: RuntimeBaseline;
  isRunning: boolean;
  sourceTraceFileName: string;
  kpiResultFileName: string;
  kpiTimeseriesFileName: string;
  start: () => void;
  stop: () => void;
  step: () => void;
  reset: () => void;
  exportSourceTrace: () => Promise<SourceTraceArtifact>;
  exportKpiReport: () => KpiExportArtifact;
}

export function useSimulation(options: UseSimulationOptions = {}): UseSimulationResult {
  const {
    profileId = 'case9-default',
    runtimeOverrides = {},
    baseline = 'max-rsrp',
    seed = 42,
    autoStart = false,
  } = options;

  const runtimeOverrideKey = JSON.stringify(runtimeOverrides);

  const setup = useMemo(() => {
    const profile = loadPaperProfile(profileId, runtimeOverrides);
    const scenario = createCase9AnalyticScenario({ profile, seed, baseline });
    const engine = new SimEngine({
      scenario,
      timeStepSec: profile.timeStepSec,
    });

    return {
      profile,
      scenario,
      engine,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, seed, baseline, runtimeOverrideKey]);

  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => setup.engine.getSnapshot());
  const [isRunning, setIsRunning] = useState(false);
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

  const exportSourceTrace = useCallback(async () => {
    const artifact = await createSourceTraceArtifact({
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      seed,
      runtimeOverrides,
      assumptions: ['phase0-phase2 implementation; CHO/MC-HO baselines pending'],
    });

    const fileName = `source-trace_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`;
    createSourceTraceDownload(artifact, fileName);
    return artifact;
  }, [setup, profileId, baseline, seed, runtimeOverrides]);

  const exportKpiReport = useCallback((): KpiExportArtifact => {
    const latestSnapshot = setup.engine.getSnapshot();
    const resultArtifact = buildKpiResultArtifact(latestSnapshot, {
      scenarioId: setup.scenario.id,
      profileId,
      baseline,
      seed,
    });

    const runTag = `${setup.scenario.id}_${profileId}_${seed}_${baseline}`;
    const resultFileName = `result_${runTag}.json`;
    const timeseriesFileName = `timeseries_${runTag}.csv`;
    const timeseriesCsv = buildTimeseriesCsv(historyRef.current);

    downloadTextArtifact(
      JSON.stringify(resultArtifact, null, 2),
      resultFileName,
      'application/json',
    );
    downloadTextArtifact(timeseriesCsv, timeseriesFileName, 'text/csv');

    return {
      resultArtifact,
      timeseriesCsv,
    };
  }, [setup, profileId, baseline, seed]);

  return {
    profile: setup.profile,
    snapshot,
    baseline,
    isRunning,
    sourceTraceFileName: `source-trace_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`,
    kpiResultFileName: `result_${setup.scenario.id}_${profileId}_${seed}_${baseline}.json`,
    kpiTimeseriesFileName: `timeseries_${setup.scenario.id}_${profileId}_${seed}_${baseline}.csv`,
    start,
    stop,
    step,
    reset,
    exportSourceTrace,
    exportKpiReport,
  };
}
