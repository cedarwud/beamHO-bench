import { useEffect, useMemo } from 'react';
import { CanvasTexture, Color, LinearFilter } from 'three';
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

function createPointSpriteTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, size, size);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  context.fill();

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function UEMarkers({ ues, failureOverlayEnabled = false }: UEMarkersProps) {
  const pointSprite = useMemo(
    () => (typeof document === 'undefined' ? null : createPointSpriteTexture()),
    [],
  );

  useEffect(
    () => () => {
      pointSprite?.dispose();
    },
    [pointSprite],
  );

  const { positions, colors } = useMemo(() => {
    const markerCount = Math.max(ues.length, 1);
    const positionBuffer = new Float32Array(markerCount * 3);
    const colorBuffer = new Float32Array(markerCount * 3);

    if (ues.length === 0) {
      positionBuffer[0] = 0;
      positionBuffer[1] = 0;
      positionBuffer[2] = 0;
      colorIdle.toArray(colorBuffer, 0);
      return { positions: positionBuffer, colors: colorBuffer };
    }

    ues.forEach((ue, index) => {
      const offset = index * 3;
      positionBuffer[offset] = ue.positionWorld[0];
      positionBuffer[offset + 1] = ue.positionWorld[1] + 0.2;
      positionBuffer[offset + 2] = ue.positionWorld[2];

      const markerColor = failureOverlayEnabled
        ? ue.hoState === 3
          ? colorState3
          : ue.hoState === 2
            ? colorState2
            : colorState1
        : ue.servingSatId === null
          ? colorIdle
          : colorConnected;
      markerColor.toArray(colorBuffer, offset);
    });

    return { positions: positionBuffer, colors: colorBuffer };
  }, [ues, failureOverlayEnabled]);

  return (
    <points renderOrder={6}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={5}
        sizeAttenuation
        map={pointSprite ?? undefined}
        alphaTest={0.35}
        vertexColors
        toneMapped={false}
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}
