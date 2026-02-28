import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import { NTPUScene } from './NTPUScene';
import { UAV } from './UAV';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import { Starfield } from '../ui/Starfield';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import { SceneLoader } from '../ui/SceneLoader';
import { SceneErrorBoundary } from '../ui/SceneErrorBoundary';

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
