import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import type { UEState } from '@/sim/types';

interface UEMarkersProps {
  ues: UEState[];
  failureOverlayEnabled?: boolean;
}

const colorIdle = new Color('#f8fafc');
const colorConnected = new Color('#facc15');
const colorState1 = new Color('#38bdf8');
const colorState2 = new Color('#f59e0b');
const colorState3 = new Color('#ef4444');

export function UEMarkers({ ues, failureOverlayEnabled = false }: UEMarkersProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const tempMatrix = useMemo(() => new Matrix4(), []);
  const count = Math.max(ues.length, 1);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    ues.forEach((ue, index) => {
      dummy.position.set(ue.positionWorld[0], ue.positionWorld[1], ue.positionWorld[2]);
      dummy.updateMatrix();
      tempMatrix.copy(dummy.matrix);
      mesh.setMatrixAt(index, tempMatrix);
      if (failureOverlayEnabled) {
        const color =
          ue.hoState === 3
            ? colorState3
            : ue.hoState === 2
              ? colorState2
              : colorState1;
        mesh.setColorAt(index, color);
      } else {
        mesh.setColorAt(index, ue.servingSatId === null ? colorIdle : colorConnected);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [ues, failureOverlayEnabled, dummy, tempMatrix]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.9, 7, 7]} />
      <meshBasicMaterial
        vertexColors
        toneMapped={false}
        transparent
        opacity={0.95}
      />
    </instancedMesh>
  );
}
