import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import type { UEState } from '@/sim/types';

interface UEMarkersProps {
  ues: UEState[];
}

const colorIdle = new Color('#f8fafc');
const colorConnected = new Color('#facc15');

export function UEMarkers({ ues }: UEMarkersProps) {
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
      mesh.setColorAt(index, ue.servingSatId === null ? colorIdle : colorConnected);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [ues, dummy, tempMatrix]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1.1, 8, 8]} />
      <meshStandardMaterial roughness={0.45} metalness={0.1} vertexColors />
    </instancedMesh>
  );
}
