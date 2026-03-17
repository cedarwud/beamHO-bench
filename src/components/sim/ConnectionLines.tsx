import { useMemo } from 'react';
import type { UEState } from '@/sim/types';
import type { SatelliteDisplayFrame } from '@/viz/satellite/types';

/**
 * Provenance:
 * - PAP-2024-MCCHO-CORE
 * - PAP-2025-TIMERCHO-CORE
 *
 * Notes:
 * - Visualizes serving/secondary/prepared links so MC-HO and CHO states are observable.
 */

export interface ConnectionLinesProps {
  satelliteRenderPositions: SatelliteDisplayFrame['renderPositionsById'];
  ues: readonly UEState[];
  /** When provided, lines are only drawn to satellites whose ID is in this set.
   *  Prevents stale lines from flashing during active-window transitions. */
  activeSatelliteIds?: ReadonlySet<number>;
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
  satelliteRenderPositions,
  ues,
  activeSatelliteIds,
  showServing = true,
  showSecondary = true,
  showPrepared = true,
}: ConnectionLinesProps) {
  const { servingSegments, secondarySegments, preparedSegments } = useMemo(() => {
    const serving: number[] = [];
    const secondary: number[] = [];
    const prepared: number[] = [];

    const isActive = (id: number | null | undefined): boolean => {
      if (id === null || id === undefined) return false;
      return activeSatelliteIds ? activeSatelliteIds.has(id) : true;
    };

    for (const ue of ues) {
      const servingSat =
        isActive(ue.servingSatId)
          ? satelliteRenderPositions.get(ue.servingSatId!)
          : undefined;
      if (servingSat) {
        appendSegment(serving, ue.positionWorld, servingSat);
      }

      const secondarySat =
        isActive(ue.secondarySatId) && ue.secondarySatId !== ue.servingSatId
          ? satelliteRenderPositions.get(ue.secondarySatId!)
          : undefined;
      if (secondarySat) {
        appendSegment(secondary, ue.positionWorld, secondarySat);
      }

      const preparedSat =
        isActive(ue.choPreparedSatId) &&
        ue.choPreparedSatId !== ue.servingSatId &&
        ue.choPreparedSatId !== ue.secondarySatId
          ? satelliteRenderPositions.get(ue.choPreparedSatId!)
          : undefined;
      if (preparedSat) {
        appendSegment(prepared, ue.positionWorld, preparedSat);
      }
    }

    return {
      servingSegments: toSegmentArray(serving),
      secondarySegments: toSegmentArray(secondary),
      preparedSegments: toSegmentArray(prepared),
    };
  }, [satelliteRenderPositions, ues, activeSatelliteIds]);

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
