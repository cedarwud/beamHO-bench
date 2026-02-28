import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import { NTPUScene } from './NTPUScene';
import { UAV } from './UAV';
import { SatelliteModel } from '../sim/SatelliteModel';
import { BeamFootprint } from '../sim/BeamFootprint';
import { UEMarkers } from '../sim/UEMarkers';
import { KpiHUD } from '../sim/KpiHUD';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import { Starfield } from '../ui/Starfield';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import { SceneLoader } from '../ui/SceneLoader';
import { SceneErrorBoundary } from '../ui/SceneErrorBoundary';
import { useSimulation } from '@/hooks/useSimulation';
import type { RuntimeBaseline } from '@/sim/handover/baselines';

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
  const [selectedBaseline, setSelectedBaseline] =
    useState<RuntimeBaseline>('max-rsrp');

  const {
    profile,
    snapshot,
    baseline,
    isRunning,
    sourceTraceFileName,
    kpiResultFileName,
    kpiTimeseriesFileName,
    start,
    stop,
    step,
    reset,
    exportSourceTrace,
    exportKpiReport,
  } = useSimulation({
    profileId: 'case9-default',
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

  return (
    <div className="scene-root">
      <Starfield starCount={180} />
      <div className="sim-hud" role="status" aria-live="polite">
        <div className="sim-hud__title">Phase 1a Case9 Analytic Orbit</div>
        <div className="sim-hud__meta">
          profile: <strong>{profile.profileId}</strong> | tick: <strong>{snapshot.tick}</strong> |
          baseline: <strong>{baseline}</strong> | sat: <strong>{snapshot.satellites.length}</strong> | beams:{' '}
          <strong>
            {snapshot.satellites.reduce((sum, satellite) => sum + satellite.beams.length, 0)}
          </strong>{' '}
          | ue: <strong>{snapshot.ues.length}</strong>
        </div>
        <div className="sim-hud__actions">
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
            </select>
          </label>
          <button type="button" onClick={isRunning ? stop : start}>
            {isRunning ? 'Pause' : 'Run'}
          </button>
          <button type="button" onClick={step}>
            Step
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              void exportSourceTrace();
            }}
            title={sourceTraceFileName}
          >
            Export Source Trace
          </button>
          <button
            type="button"
            onClick={() => {
              exportKpiReport();
            }}
            title={`${kpiResultFileName}\n${kpiTimeseriesFileName}`}
          >
            Export KPI Report
          </button>
        </div>
        <KpiHUD kpi={snapshot.kpiCumulative} />
      </div>

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
            <BeamFootprint satellites={snapshot.satellites} />
            <UEMarkers ues={snapshot.ues} />
            <SatelliteModel satellites={snapshot.satellites} />
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
  );
}
