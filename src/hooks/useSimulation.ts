import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadPaperProfile,
  type CanonicalProfileId,
  type DeepPartial,
} from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import { SimEngine } from '@/sim/engine';
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
  seed?: number;
  autoStart?: boolean;
}

export interface UseSimulationResult {
  profile: PaperProfile;
  snapshot: SimSnapshot;
  isRunning: boolean;
  sourceTraceFileName: string;
  start: () => void;
  stop: () => void;
  step: () => void;
  reset: () => void;
  exportSourceTrace: () => Promise<SourceTraceArtifact>;
}

export function useSimulation(options: UseSimulationOptions = {}): UseSimulationResult {
  const {
    profileId = 'case9-default',
    runtimeOverrides = {},
    seed = 42,
    autoStart = false,
  } = options;

  const runtimeOverrideKey = JSON.stringify(runtimeOverrides);

  const setup = useMemo(() => {
    const profile = loadPaperProfile(profileId, runtimeOverrides);
    const scenario = createCase9AnalyticScenario({ profile, seed });
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
  }, [profileId, seed, runtimeOverrideKey]);

  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => setup.engine.getSnapshot());
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setSnapshot(setup.engine.getSnapshot());

    const unsubscribe = setup.engine.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
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
  }, [setup, autoStart]);

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
    setSnapshot(setup.engine.getSnapshot());
  }, [setup]);

  const exportSourceTrace = useCallback(async () => {
    const artifact = await createSourceTraceArtifact({
      scenarioId: setup.scenario.id,
      profileId,
      baseline: 'max-rsrp',
      seed,
      runtimeOverrides,
      assumptions: ['phase0-phase1 bootstrap implementation; pending full A3/A4/CHO/MC logic'],
    });

    const fileName = `source-trace_${setup.scenario.id}_${profileId}_${seed}_max-rsrp.json`;
    createSourceTraceDownload(artifact, fileName);
    return artifact;
  }, [setup, profileId, seed, runtimeOverrides]);

  return {
    profile: setup.profile,
    snapshot,
    isRunning,
    sourceTraceFileName: `source-trace_${setup.scenario.id}_${profileId}_${seed}_max-rsrp.json`,
    start,
    stop,
    step,
    reset,
    exportSourceTrace,
  };
}
