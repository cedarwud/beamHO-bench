import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import * as THREE from 'three';

function convertBasicMaterial(material: THREE.MeshBasicMaterial) {
  const { roughness, metalness } = NTPU_CONFIG.scene.material;
  const converted = new THREE.MeshStandardMaterial({
    color: material.color.clone(),
    map: material.map,
    alphaMap: material.alphaMap,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    alphaTest: material.alphaTest,
    wireframe: material.wireframe,
    name: material.name,
    roughness,
    metalness,
  });

  converted.toneMapped = material.toneMapped;
  return converted;
}

export function NTPUScene() {
  const { scene } = useGLTF(NTPU_CONFIG.scene.modelPath);

  // 處理場景材質，與 ntn-stack 完全相同
  const { processedScene, disposableMaterials } = useMemo(() => {
    const clonedScene = scene.clone(true);
    const createdMaterials: THREE.Material[] = [];

    clonedScene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // 將 MeshBasicMaterial 轉換為 MeshStandardMaterial
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => {
              if (mat instanceof THREE.MeshBasicMaterial) {
                const newMat = convertBasicMaterial(mat);
                createdMaterials.push(newMat);
                return newMat;
              }
              return mat;
            });
          } else if (mesh.material instanceof THREE.MeshBasicMaterial) {
            const basicMat = mesh.material;
            const convertedMat = convertBasicMaterial(basicMat);
            createdMaterials.push(convertedMat);
            mesh.material = convertedMat;
          }
        }
      }
    });

    return {
      processedScene: clonedScene,
      disposableMaterials: createdMaterials,
    };
  }, [scene]);

  useEffect(() => {
    return () => {
      disposableMaterials.forEach((material) => material.dispose());
    };
  }, [disposableMaterials]);

  return (
    <group position={NTPU_CONFIG.scene.position} rotation={NTPU_CONFIG.scene.rotation}>
      <primitive object={processedScene} scale={NTPU_CONFIG.scene.scale} />
    </group>
  );
}

// 預載入模型
useGLTF.preload(NTPU_CONFIG.scene.modelPath);
