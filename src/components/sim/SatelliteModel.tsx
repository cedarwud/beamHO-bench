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
}

/**
 * Provenance:
 * - sdd/pending/beamHO-bench-observer-sky-projection-selection-correction-sdd.md (Section 3.4, 3.5, 6)
 * - ASSUME-OBSERVER-SKY-VISUAL-ACTOR-POLICY
 *
 * Notes:
 * - Motion interpolation remains renderer-only.
 * - Entry/exit anchors are supplied by the observer-sky view layer, not runtime contracts.
 */
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

/**
 * Time-driven arc animation adapted from simworld DynamicSatelliteRenderer.
 * Position is computed every animation frame from wall-clock time,
 * producing perfectly smooth rise→pass→set motion independent of
 * simulation tick rate.
 *
 * Transit parameters (azimuth direction, duration) are seeded from
 * the satellite's simulation geometry on first appearance.
 */
function SatelliteInstance({
  satellite,
  useGlb,
  glbScene,
  glbModelScale,
}: SatelliteInstanceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const isActive = satellite.zone === 'active';
  const instanceScale = glbModelScale * (satellite.modelScale ?? 1);

  // Arc parameters seeded once per satellite instance
  const arcRef = useRef({
    azimuthRad: (satellite.azimuthDeg * Math.PI) / 180,
    startTime: -1,
    transitDurationSec: 30, // full arc in 30 wall-clock seconds
    baseRadius: 600,
    heightRadius: 300,
    baseY: 80,
  });

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const arc = arcRef.current;
    const now = state.clock.elapsedTime;

    // Initialize start time on first frame
    if (arc.startTime < 0) {
      // Derive initial progress from current elevation so the arc
      // starts at the satellite's actual position, not always from 0.
      const elRatio = Math.max(0, Math.min(1, satellite.elevationDeg / 90));
      const initialProgress = elRatio; // 0=horizon, 1=zenith
      arc.startTime = now - initialProgress * arc.transitDurationSec;
    }

    const elapsed = now - arc.startTime;
    const transitProgress = (elapsed % arc.transitDurationSec) / arc.transitDurationSec;

    // angle 0→π: rise from one horizon, arc overhead, set at opposite horizon
    const angle = transitProgress * Math.PI;

    const x = arc.baseRadius * Math.cos(angle) * Math.cos(arc.azimuthRad);
    const z = arc.baseRadius * Math.cos(angle) * Math.sin(arc.azimuthRad);
    const y = Math.max(15, arc.baseY + arc.heightRadius * Math.sin(angle));

    group.position.set(x, y, z);
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
        />
      ))}
    </>
  );
}
