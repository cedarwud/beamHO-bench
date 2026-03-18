import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Stats } from '@react-three/drei';
import { NTPUScene } from './NTPUScene';
import { UAV } from './UAV';
import { SatelliteSkyLayer } from './SatelliteSkyLayer';
import { BeamSkyLayer } from './BeamSkyLayer';
import { ObserverSkyCameraRig } from './ObserverSkyCameraRig';
import { ConnectionLegend, type LinkVisibility } from '../sim/ConnectionLegend';
import { KpiHUD } from '../sim/KpiHUD';
import { HOEventTimeline, type HOEventTimelineRow } from '../sim/HOEventTimeline';
import { ResearchParameterPanel, type ResearchPanelTab } from '../sim/ResearchParameterPanel';
import { TimelineControls } from '../sim/TimelineControls';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import { Starfield } from '../ui/Starfield';
import { ACESFilmicToneMapping } from 'three';
import { SceneLoader } from '../ui/SceneLoader';
import { SceneErrorBoundary } from '../ui/SceneErrorBoundary';
import { useSimulation } from '@/hooks/useSimulation';
import { loadPaperProfile, type CanonicalProfileId } from '@/config/paper-profiles/loader';
import type { PaperProfile } from '@/config/paper-profiles/types';
import {
  buildResearchRuntimeOverridesWithConsistency,
  createResearchParameterSelection,
  normalizeResearchParameterSelection,
  summarizeResearchConsistency,
  type ResearchConsistencyMode,
  type ResearchParameterId,
  type ResearchConsistencyIssue,
  type ResearchParameterSelection,
} from '@/config/research-parameters/catalog';
import type { RuntimeBaseline } from '@/sim/handover/baselines';
import type { SimSnapshot } from '@/sim/types';
import {
  getObserverSkyComposition,
  listObserverSkyCompositions,
  type ObserverSkyCompositionModeId,
} from '@/viz/satellite/view-composition';

const SHOW_DEBUG =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_SCENE_DEBUG === 'true';

function isMobileLikeDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const lowCpuCoreCount =
    typeof navigator !== 'undefined' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 4;

  return coarsePointer || lowCpuCoreCount;
}

function createDefaultResearchSelection(profile: PaperProfile): ResearchParameterSelection {
  return createResearchParameterSelection(profile);
}

const PROFILE_LABELS: Record<CanonicalProfileId, string> = {
  'starlink-like': 'Starlink TLE',
  'oneweb-like': 'OneWeb TLE',
};

const VIEW_MODE_OPTIONS = listObserverSkyCompositions();

export function MainScene() {
  const [selectedProfileId, setSelectedProfileId] =
    useState<CanonicalProfileId>('starlink-like');
  const [selectedBaseline, setSelectedBaseline] =
    useState<RuntimeBaseline>('max-rsrp');
  const [selectedViewMode, setSelectedViewMode] =
    useState<ObserverSkyCompositionModeId>('observer-sky-primary');
  const [researchSelection, setResearchSelection] = useState<ResearchParameterSelection>(() =>
    createDefaultResearchSelection(loadPaperProfile('starlink-like')),
  );
  const [researchConsistencyMode, setResearchConsistencyMode] =
    useState<ResearchConsistencyMode>('strict');
  const [linkVisibility, setLinkVisibility] = useState<LinkVisibility>({
    serving: true,
    secondary: true,
    prepared: true,
  });
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [researchTab, setResearchTab] = useState<ResearchPanelTab>('satellite');
  const [replaySnapshots, setReplaySnapshots] = useState<SimSnapshot[]>([]);
  const [replayTick, setReplayTick] = useState<number | null>(null);
  const baseProfile = useMemo(
    () => loadPaperProfile(selectedProfileId),
    [selectedProfileId],
  );
  const selectedViewComposition = useMemo(
    () => getObserverSkyComposition(selectedViewMode),
    [selectedViewMode],
  );
  const selectedProfileLabel = PROFILE_LABELS[selectedProfileId];
  const researchRuntime = useMemo(
    () =>
      buildResearchRuntimeOverridesWithConsistency({
        profile: baseProfile,
        selection: researchSelection,
        consistencyMode: researchConsistencyMode,
      }),
    [baseProfile, researchSelection, researchConsistencyMode],
  );
  const runtimeOverrides = researchRuntime.overrides;
  const researchConsistencyIssues = useMemo<ResearchConsistencyIssue[]>(
    () => researchRuntime.issues,
    [researchRuntime.issues],
  );
  const researchConsistencySummary = useMemo(
    () =>
      summarizeResearchConsistency({
        mode: researchRuntime.mode,
        issues: researchRuntime.issues,
      }),
    [researchRuntime.mode, researchRuntime.issues],
  );

  useEffect(() => {
    setResearchSelection(createDefaultResearchSelection(baseProfile));
  }, [baseProfile]);

  const handleResearchParameterChange = useCallback(
    (parameterId: ResearchParameterId, value: string) => {
      setResearchSelection((previous) =>
        normalizeResearchParameterSelection(baseProfile, {
          ...previous,
          [parameterId]: value,
        }),
      );
    },
    [baseProfile],
  );
  const handleResetResearchParameters = useCallback(() => {
    setResearchSelection(createDefaultResearchSelection(baseProfile));
  }, [baseProfile]);

  const {
    profile,
    snapshot,
    baseline,
    isRunning,
    playbackRate,
    start,
    stop,
    step,
    stepBack,
    reset,
    setPlaybackRate,
    trajectoryCache,
  } = useSimulation({
    profileId: selectedProfileId,
    runtimeOverrides,
    researchConsistency: researchConsistencySummary,
    baseline: selectedBaseline,
    seed: 42,
    autoStart: true,
    playbackRate: 32,
  });

  const satRenderPositionsRef = useRef<Map<number, [number, number, number]>>(new Map());
  const lowPowerMode = useMemo(() => isMobileLikeDevice(), []);
  const maxDpr = lowPowerMode
    ? NTPU_CONFIG.render.mobileMaxDpr
    : NTPU_CONFIG.render.desktopMaxDpr;

  // Replay snapshot accumulation disabled — scrubber is hidden to save memory.
  // Re-enable this block when the replay scrubber is restored.
  // useEffect(() => { ... }, [snapshot]);

  useEffect(() => {
    if (replayTick === null) {
      return;
    }
    const maxTick = replaySnapshots[replaySnapshots.length - 1]?.tick ?? 0;
    if (replayTick > maxTick) {
      setReplayTick(maxTick);
    }
  }, [replayTick, replaySnapshots]);

  const replayMaxTick = replaySnapshots[replaySnapshots.length - 1]?.tick ?? snapshot.tick;
  const replaySnapshot = replayTick === null
    ? null
    : replaySnapshots.find((candidate) => candidate.tick === replayTick) ?? null;
  const displayedSnapshot = replaySnapshot ?? snapshot;
  const isLiveView = replayTick === null;
  const canvasFrameloop: 'always' | 'demand' | 'never' =
    isRunning && isLiveView ? 'always' : NTPU_CONFIG.render.frameloop;
  const hoEventTimeline = useMemo<HOEventTimelineRow[]>(
    () =>
      replaySnapshots.flatMap((entry) =>
        entry.hoEvents.map((event) => ({
          ...event,
          timeSec: entry.timeSec,
        })),
      ),
    [replaySnapshots],
  );
  const hoStateCounts = useMemo(() => {
    const counts = {
      state1: 0,
      state2: 0,
      state3: 0,
    };
    for (const ue of displayedSnapshot.ues) {
      if (ue.hoState === 3) {
        counts.state3 += 1;
      } else if (ue.hoState === 2) {
        counts.state2 += 1;
      } else {
        counts.state1 += 1;
      }
    }
    return counts;
  }, [displayedSnapshot.ues]);

  const handleToggleRun = useCallback(() => {
    if (replayTick !== null) {
      setReplayTick(null);
    }
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, replayTick, start, stop]);

  const handleStep = useCallback(() => {
    if (replayTick !== null) {
      setReplayTick(null);
    }
    step();
  }, [replayTick, step]);

  const handleStepBack = useCallback(() => {
    stepBack();
  }, [stepBack]);

  const handleReset = useCallback(() => {
    if (replayTick !== null) {
      setReplayTick(null);
    }
    reset();
  }, [replayTick, reset]);

  return (
    <div className="scene-root">
      <div className={`sim-sidebar${isHudCollapsed ? ' sim-sidebar--collapsed' : ''}`}>
        <button
          type="button"
          className="sim-sidebar__toggle"
          onClick={() => setIsHudCollapsed((previous) => !previous)}
          aria-label={isHudCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isHudCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isHudCollapsed ? '>' : '<'}
        </button>
        {!isHudCollapsed ? (
          <div className="sim-hud" role="status" aria-live="polite">
            <div className="sim-hud__actions">
              <div className="sim-hud__controls">
                <label className="sim-hud__select">
                  Profile
                  <select
                    value={selectedProfileId}
                    onChange={(event) =>
                      setSelectedProfileId(event.target.value as CanonicalProfileId)
                    }
                  >
                    <option value="starlink-like">Starlink TLE</option>
                    <option value="oneweb-like">OneWeb TLE</option>
                  </select>
                </label>
              </div>
              <ResearchParameterPanel
                profile={profile}
                baseline={baseline}
                selection={researchSelection}
                consistencyMode={researchConsistencyMode}
                consistencyIssues={researchConsistencyIssues}
                onSelectionChange={handleResearchParameterChange}
                onConsistencyModeChange={setResearchConsistencyMode}
                onReset={handleResetResearchParameters}
                onTabChange={setResearchTab}
              />
              {researchTab === 'satellite' ? <section className="sim-hud-panel" aria-label="Playback controls">
                <div className="sim-hud-panel__title">Playback</div>
                <TimelineControls
                  tick={displayedSnapshot.tick}
                  timeSec={displayedSnapshot.timeSec}
                  isRunning={isRunning}
                  playbackRate={playbackRate}
                  replayTick={replayTick}
                  replayMaxTick={replayMaxTick}
                  onToggleRun={handleToggleRun}
                  onStep={handleStep}
                  onStepBack={handleStepBack}
                  onReset={handleReset}
                  onPlaybackRateChange={setPlaybackRate}
                  onReplayTickChange={(nextTick) => setReplayTick(nextTick)}
                  onReplayLive={() => setReplayTick(null)}
                />
              </section> : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="scene-stage">
        <Starfield starCount={180} />
        <SceneErrorBoundary>
          <Canvas
            className="scene-canvas"
            frameloop={canvasFrameloop}
            dpr={[1, maxDpr]}
            performance={{ min: NTPU_CONFIG.render.performanceMin }}
            gl={{
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: NTPU_CONFIG.render.toneMappingExposure,
              alpha: true,
              powerPreference: 'high-performance',
              antialias: NTPU_CONFIG.render.antialias,
            }}
          >
            <ObserverSkyCameraRig composition={selectedViewComposition} />

            {/* 燈光 - 主光源位於正上方中央 */}
            <hemisphereLight args={NTPU_CONFIG.lighting.hemisphere} />
            <ambientLight intensity={NTPU_CONFIG.lighting.ambientIntensity} />
            <directionalLight
              position={NTPU_CONFIG.lighting.directional.position}
              intensity={NTPU_CONFIG.lighting.directional.intensity}
            />

            {/* 場景模型 */}
            <Suspense fallback={<SceneLoader label="Loading NTPU Scene..." />}>
              <NTPUScene />
              <UAV position={NTPU_CONFIG.uav.position} scale={NTPU_CONFIG.uav.scale} />
              <SatelliteSkyLayer
                key={profile.constellation.activeSatellitesInWindow ?? 0}
                profile={profile}
                satellites={displayedSnapshot.observerSkyPhysicalSatellites ?? displayedSnapshot.satellites}
                ues={displayedSnapshot.ues}
                renderMode={NTPU_CONFIG.satellite.renderMode}
                glbModelPath={NTPU_CONFIG.satellite.modelPath}
                glbModelScale={NTPU_CONFIG.satellite.modelScale}
                composition={selectedViewComposition}
                continuitySequenceKey={`${displayedSnapshot.scenarioId}:${displayedSnapshot.profileId}`}
                snapshotTick={displayedSnapshot.tick}
                snapshotTimeSec={displayedSnapshot.timeSec}
                showServingLinks={linkVisibility.serving}
                showSecondaryLinks={linkVisibility.secondary}
                showPreparedLinks={linkVisibility.prepared}
                playbackRate={playbackRate}
                trajectoryCache={trajectoryCache}
                renderPositionsOut={satRenderPositionsRef}
              />
              <BeamSkyLayer
                renderPositionsRef={satRenderPositionsRef}
                ues={displayedSnapshot.ues}
                gainModel={profile.beam.gainModel}
                beamAngularRadiusDeg={profile.beam.beamwidth3dBDeg}
              />
            </Suspense>

            {/* 動態 DPR 調整 */}
            <AdaptiveDpr pixelated />

            {/* 調試工具（僅調試時顯示） */}
            {SHOW_DEBUG && (
              <>
                <gridHelper args={[1000, 50, '#888888', '#444444']} />
                <axesHelper args={[100]} />
                <Stats />
              </>
            )}
          </Canvas>
        </SceneErrorBoundary>
      </div>
    </div>
  );
}
