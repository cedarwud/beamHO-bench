import { Fragment } from 'react';
import type { SatelliteState } from '@/sim/types';

interface SatelliteModelProps {
  satellites: SatelliteState[];
}

export function SatelliteModel({ satellites }: SatelliteModelProps) {
  return (
    <>
      {satellites.map((satellite) => {
        const isVisible = satellite.visible;
        const altitudeWorld = Math.max(0, satellite.positionWorld[1]);

        return (
          <Fragment key={satellite.id}>
            <mesh position={satellite.positionWorld} castShadow>
              <icosahedronGeometry args={[5.5, 0]} />
              <meshStandardMaterial
                color={isVisible ? '#7ee0ff' : '#64748b'}
                emissive={isVisible ? '#0ea5e9' : '#334155'}
                emissiveIntensity={isVisible ? 0.5 : 0.2}
                roughness={0.35}
                metalness={0.6}
              />
            </mesh>

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
