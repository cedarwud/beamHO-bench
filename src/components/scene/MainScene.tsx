import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import { NTPUScene } from './NTPUScene';
import { UAV } from './UAV';
import { SatelliteModel } from '../sim/SatelliteModel';
import { ConnectionLines } from '../sim/ConnectionLines';
import { ConnectionLegend, type LinkVisibility } from '../sim/ConnectionLegend';
import { KpiHUD } from '../sim/KpiHUD';
import { HOEventTimeline, type HOEventTimelineRow } from '../sim/HOEventTimeline';
import { ResearchParameterPanel } from '../sim/ResearchParameterPanel';
import { TimelineControls } from '../sim/TimelineControls';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import { Starfield } from '../ui/Starfield';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import { SceneLoader } from '../ui/SceneLoader';
import { SceneErrorBoundary } from '../ui/SceneErrorBoundary';
import { useSimulation } from '@/hooks/useSimulation';
import { loadPaperProfile, type CanonicalProfileId } from '@/config/paper-profiles/loader';
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
import type { SatelliteRenderMode } from '../sim/satellite-render-mode';

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

export function MainScene() {
  const [selectedProfileId, setSelectedProfileId] =
    useState<CanonicalProfileId>('case9-default');
  const [selectedBaseline, setSelectedBaseline] =
    useState<RuntimeBaseline>('max-rsrp');
  const [researchSelection, setResearchSelection] = useState<ResearchParameterSelection>(() =>
    createResearchParameterSelection(loadPaperProfile('case9-default')),
  );
  const [researchConsistencyMode, setResearchConsistencyMode] =
    useState<ResearchConsistencyMode>('strict');
  const [satelliteRenderMode, setSatelliteRenderMode] = useState<SatelliteRenderMode>(
    NTPU_CONFIG.satellite.renderMode,
  );
  const [linkVisibility, setLinkVisibility] = useState<LinkVisibility>({
    serving: true,
    secondary: true,
    prepared: true,
  });
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [replaySnapshots, setReplaySnapshots] = useState<SimSnapshot[]>([]);
  const [replayTick, setReplayTick] = useState<number | null>(null);
  const baseProfile = useMemo(
    () => loadPaperProfile(selectedProfileId),
    [selectedProfileId],
  );
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
    setResearchSelection(createResearchParameterSelection(baseProfile));
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
    setResearchSelection(createResearchParameterSelection(baseProfile));
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
    reset,
    setPlaybackRate,
    exportRunBundle,
  } = useSimulation({
    profileId: selectedProfileId,
    runtimeOverrides,
    researchConsistency: researchConsistencySummary,
    baseline: selectedBaseline,
    seed: 42,
    autoStart: false,
  });

  const lowPowerMode = useMemo(() => isMobileLikeDevice(), []);
  const shadowMapSize = lowPowerMode
    ? NTPU_CONFIG.lighting.directional.shadow.mapSizeMobile
    : NTPU_CONFIG.lighting.directional.shadow.mapSizeDesktop;
  const maxDpr = lowPowerMode
    ? NTPU_CONFIG.render.mobileMaxDpr
    : NTPU_CONFIG.render.desktopMaxDpr;
  const cloneSnapshot = useCallback((value: SimSnapshot): SimSnapshot => {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as SimSnapshot;
  }, []);

  useEffect(() => {
    setReplaySnapshots((previous) => {
      const nextSnapshot = cloneSnapshot(snapshot);
      if (previous.length === 0) {
        return [nextSnapshot];
      }
      const last = previous[previous.length - 1];
      if (snapshot.tick < last.tick) {
        return [nextSnapshot];
      }
      if (snapshot.tick === last.tick) {
        const replaced = [...previous];
        replaced[replaced.length - 1] = nextSnapshot;
        return replaced;
      }
      const appended = [...previous, nextSnapshot];
      if (appended.length > 7200) {
        appended.shift();
      }
      return appended;
    });
  }, [snapshot, cloneSnapshot]);

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
            <div className="sim-hud__title">
              {profile.mode === 'real-trace'
                ? 'Phase 1b Real Trace Orbit'
                : 'Phase 1a Case9 Analytic Orbit'}
            </div>
            <div className="sim-hud__meta">
              profile: <strong>{profile.profileId}</strong> | tick: <strong>{displayedSnapshot.tick}</strong> |
              baseline: <strong>{baseline}</strong> | sat: <strong>{displayedSnapshot.satellites.length}</strong> | beams:{' '}
              <strong>
                {displayedSnapshot.satellites.reduce((sum, satellite) => sum + satellite.beams.length, 0)}
              </strong>{' '}
              | gain: <strong>{profile.beam.gainModel}</strong>{' '}
              | sat-render: <strong>{satelliteRenderMode}</strong>{' '}
              | ue: <strong>{displayedSnapshot.ues.length}</strong>
            </div>
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
                    <option value="case9-default">case9-default</option>
                    <option value="starlink-like">starlink-like</option>
                    <option value="oneweb-like">oneweb-like</option>
                  </select>
                </label>
                <label className="sim-hud__select">
                  Baseline
                  <select
                    value={selectedBaseline}
                    onChange={(event) =>
                      setSelectedBaseline(event.target.value as RuntimeBaseline)
                    }
                  >
                    <option value="max-rsrp">max-rsrp</option>
                    <option value="max-elevation">max-elevation</option>
                    <option value="max-remaining-time">max-remaining-time</option>
                    <option value="a3">a3</option>
                    <option value="a4">a4</option>
                    <option value="cho">cho</option>
                    <option value="mc-ho">mc-ho</option>
                  </select>
                </label>
                <label className="sim-hud__select">
                  Satellite
                  <select
                    value={satelliteRenderMode}
                    onChange={(event) =>
                      setSatelliteRenderMode(event.target.value as SatelliteRenderMode)
                    }
                  >
                    <option value="primitive">primitive</option>
                    <option value="glb">glb</option>
                  </select>
                </label>
              </div>
              <ResearchParameterPanel
                profile={profile}
                selection={researchSelection}
                consistencyMode={researchConsistencyMode}
                consistencyIssues={researchConsistencyIssues}
                onSelectionChange={handleResearchParameterChange}
                onConsistencyModeChange={setResearchConsistencyMode}
                onReset={handleResetResearchParameters}
              />
              <TimelineControls
                tick={displayedSnapshot.tick}
                timeSec={displayedSnapshot.timeSec}
                isRunning={isRunning}
                playbackRate={playbackRate}
                replayTick={replayTick}
                replayMaxTick={replayMaxTick}
                onToggleRun={handleToggleRun}
                onStep={handleStep}
                onReset={handleReset}
                onPlaybackRateChange={setPlaybackRate}
                onReplayTickChange={(nextTick) => setReplayTick(nextTick)}
                onReplayLive={() => setReplayTick(null)}
              />
              <div className="sim-hud__exports">
                <button
                  type="button"
                  onClick={() => {
                    void exportRunBundle();
                  }}
                  title="Export manifest/resolved-profile/source-trace/kpi-summary/timeseries/validation-gate-summary bundle."
                >
                  Export Run Bundle
                </button>
              </div>
            </div>
            <div className="sim-failure-overlay">
              <div className="sim-failure-overlay__header">State1/2/3 Failure Overlay</div>
              <div className="sim-failure-overlay__stats">
                S1: <strong>{hoStateCounts.state1}</strong> | S2: <strong>{hoStateCounts.state2}</strong> | S3:{' '}
                <strong>{hoStateCounts.state3}</strong>
              </div>
            </div>
            <ConnectionLegend
              ues={displayedSnapshot.ues}
              visibility={linkVisibility}
              onChange={setLinkVisibility}
            />
            <KpiHUD kpi={displayedSnapshot.kpiCumulative} ues={displayedSnapshot.ues} baseline={baseline} />
            <HOEventTimeline events={hoEventTimeline} maxRows={12} />
          </div>
        ) : null}
      </div>
      <div className="scene-stage">
        <Starfield starCount={180} />
        <SceneErrorBoundary>
          <Canvas
            className="scene-canvas"
            frameloop={NTPU_CONFIG.render.frameloop}
            dpr={[1, maxDpr]}
            performance={{ min: NTPU_CONFIG.render.performanceMin }}
            shadows
            gl={{
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: NTPU_CONFIG.render.toneMappingExposure,
              alpha: true,
              powerPreference: 'high-performance',
              antialias: NTPU_CONFIG.render.antialias,
            }}
            onCreated={({ gl }) => {
              gl.shadowMap.type = PCFSoftShadowMap;
            }}
          >
            {/* 相機 */}
            <PerspectiveCamera
              makeDefault
              position={NTPU_CONFIG.camera.initialPosition}
              fov={NTPU_CONFIG.camera.fov}
              near={NTPU_CONFIG.camera.near}
              far={NTPU_CONFIG.camera.far}
            />

            {/* 軌道控制 */}
            <OrbitControls
              makeDefault
              target={NTPU_CONFIG.camera.target}
              enableDamping={NTPU_CONFIG.controls.enableDamping}
              dampingFactor={NTPU_CONFIG.controls.dampingFactor}
              minDistance={NTPU_CONFIG.controls.minDistance}
              maxDistance={NTPU_CONFIG.controls.maxDistance}
              minPolarAngle={NTPU_CONFIG.controls.minPolarAngle}
              maxPolarAngle={NTPU_CONFIG.controls.maxPolarAngle}
            />

            {/* 燈光 - 主光源位於正上方中央 */}
            <hemisphereLight args={NTPU_CONFIG.lighting.hemisphere} />
            <ambientLight intensity={NTPU_CONFIG.lighting.ambientIntensity} />
            <directionalLight
              castShadow
              position={NTPU_CONFIG.lighting.directional.position}
              intensity={NTPU_CONFIG.lighting.directional.intensity}
              shadow-mapSize-width={shadowMapSize}
              shadow-mapSize-height={shadowMapSize}
              shadow-camera-near={NTPU_CONFIG.lighting.directional.shadow.cameraNear}
              shadow-camera-far={NTPU_CONFIG.lighting.directional.shadow.cameraFar}
              shadow-camera-top={NTPU_CONFIG.lighting.directional.shadow.cameraFrustum}
              shadow-camera-bottom={-NTPU_CONFIG.lighting.directional.shadow.cameraFrustum}
              shadow-camera-left={-NTPU_CONFIG.lighting.directional.shadow.cameraFrustum}
              shadow-camera-right={NTPU_CONFIG.lighting.directional.shadow.cameraFrustum}
              shadow-bias={NTPU_CONFIG.lighting.directional.shadow.bias}
              shadow-radius={NTPU_CONFIG.lighting.directional.shadow.radius}
            />

            {/* 場景模型 */}
            <Suspense fallback={<SceneLoader label="Loading NTPU Scene..." />}>
              <NTPUScene />
              <UAV position={NTPU_CONFIG.uav.position} scale={NTPU_CONFIG.uav.scale} />
              <ConnectionLines
                satellites={displayedSnapshot.satellites}
                ues={displayedSnapshot.ues}
                showServing={linkVisibility.serving}
                showSecondary={linkVisibility.secondary}
                showPrepared={linkVisibility.prepared}
              />
              <SatelliteModel
                satellites={displayedSnapshot.satellites}
                renderMode={satelliteRenderMode}
                glbModelPath={NTPU_CONFIG.satellite.modelPath}
                glbModelScale={NTPU_CONFIG.satellite.modelScale}
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
