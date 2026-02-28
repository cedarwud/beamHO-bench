import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { NTPU_CONFIG } from '@/config/ntpu.config';

interface UAVProps {
  position: [number, number, number];
  scale?: number;
}

export function UAV({ position, scale = 10 }: UAVProps) {
  const { scene } = useGLTF(NTPU_CONFIG.uav.modelPath);

  // 使用 useMemo clone 場景 (使用 SkeletonUtils 處理骨骼動畫)
  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    // 只設置陰影，不修改材質
    cloned.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group position={position} scale={scale}>
      <primitive object={clonedScene} />
      <pointLight
        intensity={NTPU_CONFIG.uav.light.intensity}
        distance={NTPU_CONFIG.uav.light.distance}
        decay={NTPU_CONFIG.uav.light.decay}
        color={NTPU_CONFIG.uav.light.color}
        position={NTPU_CONFIG.uav.light.position}
      />
    </group>
  );
}

// 預載入模型
useGLTF.preload(NTPU_CONFIG.uav.modelPath);
