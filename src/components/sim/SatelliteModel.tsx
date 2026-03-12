import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  resolveSatelliteRenderDecision,
  type SatelliteGlbLoadState,
  type SatelliteRenderMode,
} from './satellite-render-mode';
import type { SatelliteDisplayState } from '@/viz/satellite/types';

interface SatelliteModelProps {
  satellites: readonly SatelliteDisplayState[];
  renderMode: SatelliteRenderMode;
  glbModelPath: string;
  glbModelScale: number;
  motionTransitionSec?: number;
  enableSmoothMotion?: boolean;
}

interface SatelliteGlbInstanceProps {
  sourceScene: THREE.Object3D;
  opacity: number;
  zone: SatelliteDisplayState['zone'];
  scale: number;
}

interface SatelliteInstanceProps {
  satellite: SatelliteDisplayState;
  useGlb: boolean;
  glbScene: THREE.Object3D | null;
  glbModelScale: number;
  motionTransitionSec: number;
  enableSmoothMotion: boolean;
}

function resolveRenderPosition(satellite: SatelliteDisplayState): [number, number, number] {
  return satellite.renderPosition;
}

function cloneMaterial(material: THREE.Material): THREE.Material {
  return material.clone();
}

function cloneMeshMaterials(mesh: THREE.Mesh) {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => cloneMaterial(material));
    return;
  }
  mesh.material = cloneMaterial(mesh.material);
}

function applyMeshDisplayMaterial(
  mesh: THREE.Mesh,
  options: {
    opacity: number;
    zone: SatelliteDisplayState['zone'];
  },
) {
  const isActive = options.zone === 'active';
  const apply = (material: THREE.Material) => {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.transparent = true;
      material.opacity = options.opacity;
      material.emissive = isActive ? new THREE.Color('#0ea5e9') : new THREE.Color('#475569');
      material.emissiveIntensity = isActive ? 0.28 : 0.1;
      return;
    }
    if (material instanceof THREE.MeshBasicMaterial) {
      material.transparent = true;
      material.opacity = options.opacity;
    }
  };

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => apply(material));
    return;
  }
  apply(mesh.material);
}

function SatelliteGlbInstance({ sourceScene, opacity, zone, scale }: SatelliteGlbInstanceProps) {
  const scene = useMemo(() => {
    const cloned = sourceScene.clone(true);
    cloned.traverse((obj: THREE.Object3D) => {
      if (!(obj as THREE.Mesh).isMesh) {
        return;
      }
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cloneMeshMaterials(mesh);
      applyMeshDisplayMaterial(mesh, { opacity, zone });
    });
    return cloned;
  }, [sourceScene, opacity, zone]);

  useEffect(() => {
    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj as THREE.Mesh).isMesh) {
        return;
      }
      applyMeshDisplayMaterial(obj as THREE.Mesh, { opacity, zone });
    });
  }, [scene, opacity, zone]);

  return (
    <group scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function SatelliteInstance({
  satellite,
  useGlb,
  glbScene,
  glbModelScale,
  motionTransitionSec,
  enableSmoothMotion,
}: SatelliteInstanceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sourcePositionRef = useRef(new THREE.Vector3(...resolveRenderPosition(satellite)));
  const targetPositionRef = useRef(new THREE.Vector3(...resolveRenderPosition(satellite)));
  const elapsedSecRef = useRef(motionTransitionSec);
  const isActive = satellite.zone === 'active';
  const instanceScale = glbModelScale * (satellite.modelScale ?? 1);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const [nextX, nextY, nextZ] = resolveRenderPosition(satellite);

    if (!enableSmoothMotion || motionTransitionSec <= 0) {
      sourcePositionRef.current.set(nextX, nextY, nextZ);
      targetPositionRef.current.set(nextX, nextY, nextZ);
      elapsedSecRef.current = motionTransitionSec;
      if (group) {
        group.position.set(nextX, nextY, nextZ);
      }
      return;
    }

    if (group) {
      sourcePositionRef.current.copy(group.position);
    } else {
      sourcePositionRef.current.copy(targetPositionRef.current);
    }
    targetPositionRef.current.set(nextX, nextY, nextZ);
    elapsedSecRef.current = 0;
  }, [
    satellite.renderPosition[0],
    satellite.renderPosition[1],
    satellite.renderPosition[2],
    enableSmoothMotion,
    motionTransitionSec,
  ]);

  useFrame((_state, deltaSec) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (!enableSmoothMotion || motionTransitionSec <= 0) {
      group.position.copy(targetPositionRef.current);
      return;
    }

    const nextElapsedSec = Math.min(elapsedSecRef.current + deltaSec, motionTransitionSec);
    elapsedSecRef.current = nextElapsedSec;
    const t = motionTransitionSec > 0 ? nextElapsedSec / motionTransitionSec : 1;
    group.position.lerpVectors(sourcePositionRef.current, targetPositionRef.current, t);
  });

  return (
    <group ref={groupRef}>
      {useGlb && glbScene ? (
        <SatelliteGlbInstance
          sourceScene={glbScene}
          opacity={satellite.opacity}
          zone={satellite.zone}
          scale={instanceScale}
        />
      ) : (
        <mesh castShadow>
          <icosahedronGeometry args={[5.5, 0]} />
          <meshStandardMaterial
            color={isActive ? '#7ee0ff' : '#94a3b8'}
            emissive={isActive ? '#0ea5e9' : '#475569'}
            emissiveIntensity={isActive ? 0.5 : 0.12}
            roughness={0.35}
            metalness={0.6}
            transparent
            opacity={satellite.opacity}
          />
        </mesh>
      )}
    </group>
  );
}

export function SatelliteModel({
  satellites,
  renderMode,
  glbModelPath,
  glbModelScale,
  motionTransitionSec = 1,
  enableSmoothMotion = true,
}: SatelliteModelProps) {
  const [glbScene, setGlbScene] = useState<THREE.Object3D | null>(null);
  const [glbLoadState, setGlbLoadState] = useState<SatelliteGlbLoadState>('idle');
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const warnedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (renderMode !== 'glb') {
      return;
    }
    if (glbLoadState === 'ready' && loadedPath === glbModelPath && glbScene !== null) {
      return;
    }

    let disposed = false;
    const loader = new GLTFLoader();
    setGlbLoadState('loading');

    loader.load(
      glbModelPath,
      (loadedAsset) => {
        if (disposed) {
          return;
        }
        setGlbScene(loadedAsset.scene);
        setLoadedPath(glbModelPath);
        setGlbLoadState('ready');
      },
      undefined,
      (error) => {
        if (disposed) {
          return;
        }
        setGlbScene(null);
        setLoadedPath(null);
        setGlbLoadState('error');
        if (warnedPathRef.current !== glbModelPath) {
          console.warn(
            `[satellite-render] failed to load GLB '${glbModelPath}', fallback to primitive mode.`,
            error,
          );
          warnedPathRef.current = glbModelPath;
        }
      },
    );

    return () => {
      disposed = true;
    };
  }, [renderMode, glbModelPath]);

  const renderDecision = resolveSatelliteRenderDecision(renderMode, glbLoadState);
  const useGlb = renderDecision.effectiveMode === 'glb' && glbScene !== null;

  return (
    <>
      {satellites.map((satellite) => (
        <SatelliteInstance
          key={satellite.satelliteId}
          satellite={satellite}
          useGlb={useGlb}
          glbScene={glbScene}
          glbModelScale={glbModelScale}
          motionTransitionSec={motionTransitionSec}
          enableSmoothMotion={enableSmoothMotion}
        />
      ))}
    </>
  );
}
