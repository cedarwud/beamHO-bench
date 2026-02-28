import type { SatelliteState } from '@/sim/types';
import { DoubleSide } from 'three';

interface BeamFootprintProps {
  satellites: SatelliteState[];
}

export function BeamFootprint({ satellites }: BeamFootprintProps) {
  return (
    <>
      {satellites.flatMap((satellite) =>
        satellite.beams.map((beam) => (
          <mesh
            key={`${satellite.id}-${beam.beamId}`}
            position={beam.centerWorld}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <ringGeometry args={[beam.radiusWorld * 0.82, beam.radiusWorld, 40]} />
            <meshBasicMaterial
              color={satellite.visible ? '#38bdf8' : '#64748b'}
              transparent
              opacity={satellite.visible ? 0.34 : 0.16}
              side={DoubleSide}
            />
          </mesh>
        )),
      )}
    </>
  );
}
