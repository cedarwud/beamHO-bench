import type { SatelliteState } from '@/sim/types';
import type { GainModel } from '@/config/paper-profiles/types';
import { DoubleSide } from 'three';
import { resolveBeamFootprintBands } from './beam-footprint-gain';

interface BeamFootprintProps {
  satellites: SatelliteState[];
  gainModel: GainModel;
}

export function BeamFootprint({ satellites, gainModel }: BeamFootprintProps) {
  return (
    <>
      {satellites.flatMap((satellite) =>
        satellite.beams.map((beam) => (
          <group
            key={`${satellite.id}-${beam.beamId}`}
            position={beam.centerWorld}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {resolveBeamFootprintBands(gainModel, satellite.visible).map((band, bandIndex) => {
              const innerRadius = beam.radiusWorld * band.innerRadiusRatio;
              const outerRadius = beam.radiusWorld * band.outerRadiusRatio;
              const bandColor = satellite.visible ? '#38bdf8' : '#64748b';

              return (
                <mesh key={`${satellite.id}-${beam.beamId}-band-${bandIndex}`} receiveShadow>
                  {band.innerRadiusRatio <= 0 ? (
                    <circleGeometry args={[outerRadius, 40]} />
                  ) : (
                    <ringGeometry args={[innerRadius, outerRadius, 40]} />
                  )}
                  <meshBasicMaterial
                    color={bandColor}
                    transparent
                    opacity={band.opacity}
                    side={DoubleSide}
                  />
                </mesh>
              );
            })}
          </group>
        )),
      )}
    </>
  );
}
