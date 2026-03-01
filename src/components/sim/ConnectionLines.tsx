import { useMemo } from 'react';
import type { SatelliteState, UEState } from '@/sim/types';

/**
 * Provenance:
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 *
 * Notes:
 * - Visualizes serving/secondary/prepared links so MC-HO and CHO states are observable.
 */

export interface ConnectionLinesProps {
  satellites: SatelliteState[];
  ues: UEState[];
  showServing?: boolean;
  showSecondary?: boolean;
  showPrepared?: boolean;
}

function appendSegment(
  buffer: number[],
  from: [number, number, number],
  to: [number, number, number],
): void {
  buffer.push(from[0], from[1], from[2], to[0], to[1], to[2]);
}

function toSegmentArray(values: number[]): Float32Array {
  if (values.length === 0) {
    return new Float32Array();
  }
  return new Float32Array(values);
}

export function ConnectionLines({
  satellites,
  ues,
  showServing = true,
  showSecondary = true,
  showPrepared = true,
}: ConnectionLinesProps) {
  const { servingSegments, secondarySegments, preparedSegments } = useMemo(() => {
    const satById = new Map<number, SatelliteState>(
      satellites.map((satellite) => [satellite.id, satellite]),
    );
    const serving: number[] = [];
    const secondary: number[] = [];
    const prepared: number[] = [];

    for (const ue of ues) {
      const servingSat =
        ue.servingSatId !== null && ue.servingSatId !== undefined
          ? satById.get(ue.servingSatId)
          : undefined;
      if (servingSat) {
        appendSegment(serving, ue.positionWorld, servingSat.positionWorld);
      }

      const secondarySat =
        ue.secondarySatId !== null && ue.secondarySatId !== undefined
          ? satById.get(ue.secondarySatId)
          : undefined;
      if (
        secondarySat &&
        secondarySat.id !== ue.servingSatId
      ) {
        appendSegment(secondary, ue.positionWorld, secondarySat.positionWorld);
      }

      const preparedSat =
        ue.choPreparedSatId !== null && ue.choPreparedSatId !== undefined
          ? satById.get(ue.choPreparedSatId)
          : undefined;
      if (
        preparedSat &&
        preparedSat.id !== ue.servingSatId &&
        preparedSat.id !== ue.secondarySatId
      ) {
        appendSegment(prepared, ue.positionWorld, preparedSat.positionWorld);
      }
    }

    return {
      servingSegments: toSegmentArray(serving),
      secondarySegments: toSegmentArray(secondary),
      preparedSegments: toSegmentArray(prepared),
    };
  }, [satellites, ues]);

  return (
    <group name="connection-lines">
      {showServing && servingSegments.length > 0 ? (
        <lineSegments renderOrder={4}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[servingSegments, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.7}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ) : null}
      {showSecondary && secondarySegments.length > 0 ? (
        <lineSegments renderOrder={5}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[secondarySegments, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.45}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ) : null}
      {showPrepared && preparedSegments.length > 0 ? (
        <lineSegments renderOrder={5}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[preparedSegments, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.5}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ) : null}
    </group>
  );
}
