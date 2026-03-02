import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SatelliteState } from '@/sim/types';
import {
  resolveSatelliteRenderDecision,
  type SatelliteGlbLoadState,
  type SatelliteRenderMode,
} from './satellite-render-mode';

interface SatelliteModelProps {
  satellites: SatelliteState[];
  renderMode: SatelliteRenderMode;
  glbModelPath: string;
  glbModelScale: number;
}

interface SatelliteGlbInstanceProps {
  sourceScene: THREE.Object3D;
  isVisible: boolean;
  scale: number;
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

function applyMeshVisibilityMaterial(mesh: THREE.Mesh, isVisible: boolean) {
  const apply = (material: THREE.Material) => {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.transparent = true;
      material.opacity = isVisible ? 1 : 0.55;
      material.emissive = isVisible ? new THREE.Color('#0ea5e9') : new THREE.Color('#1e293b');
      material.emissiveIntensity = isVisible ? 0.28 : 0.12;
      return;
    }
    if (material instanceof THREE.MeshBasicMaterial) {
      material.transparent = true;
      material.opacity = isVisible ? 1 : 0.55;
    }
  };

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => apply(material));
    return;
  }
  apply(mesh.material);
}

function SatelliteGlbInstance({ sourceScene, isVisible, scale }: SatelliteGlbInstanceProps) {
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
      applyMeshVisibilityMaterial(mesh, isVisible);
    });
    return cloned;
  }, [sourceScene]);

  useEffect(() => {
    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj as THREE.Mesh).isMesh) {
        return;
      }
      applyMeshVisibilityMaterial(obj as THREE.Mesh, isVisible);
    });
  }, [scene, isVisible]);

  return (
    <group scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

export function SatelliteModel({
  satellites,
  renderMode,
  glbModelPath,
  glbModelScale,
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
      {satellites.map((satellite) => {
        const isVisible = satellite.visible;
        const altitudeWorld = Math.max(0, satellite.positionWorld[1]);

        return (
          <Fragment key={satellite.id}>
            <group position={satellite.positionWorld}>
              {useGlb && glbScene ? (
                <SatelliteGlbInstance
                  sourceScene={glbScene}
                  isVisible={isVisible}
                  scale={glbModelScale}
                />
              ) : (
                <mesh castShadow>
                  <icosahedronGeometry args={[5.5, 0]} />
                  <meshStandardMaterial
                    color={isVisible ? '#7ee0ff' : '#64748b'}
                    emissive={isVisible ? '#0ea5e9' : '#334155'}
                    emissiveIntensity={isVisible ? 0.5 : 0.2}
                    roughness={0.35}
                    metalness={0.6}
                  />
                </mesh>
              )}
            </group>

            <mesh
              position={[
                satellite.positionWorld[0],
                altitudeWorld / 2,
                satellite.positionWorld[2],
              ]}
            >
              <cylinderGeometry args={[0.22, 0.22, altitudeWorld, 10, 1, true]} />
              <meshBasicMaterial
                color={isVisible ? '#22d3ee' : '#475569'}
                transparent
                opacity={0.3}
              />
            </mesh>
          </Fragment>
        );
      })}
    </>
  );
}
