import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { DoubleSide } from 'three';
import type { SatelliteState } from '@/sim/types';
import type { BeamSchedulerSnapshot } from '@/sim/scheduler/types';
import type { GainModel, FrequencyReuse } from '@/config/paper-profiles/types';
import { resolveBeamFootprintBands } from './beam-footprint-gain';
import { resolveSceneFocusServingBeam } from '@/viz/satellite/beam-visual-selection';

interface BeamFootprintProps {
  satellites: SatelliteState[];
  gainModel: GainModel;
  frequencyReuse: FrequencyReuse;
  beamScheduler?: BeamSchedulerSnapshot;
  focusWorldXz: readonly [number, number];
}

function bk(satId: number, beamId: number): string {
  return `${satId}:${beamId}`;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

const GROUND_Y_OFFSET = 2;
const BOUNDARY_RING_RATIO = 1.02;
const BOUNDARY_RING_OPACITY = 0.72;
const BOUNDARY_RING_SLEEP_SCALE = 0.45;
const SLEEP_OPACITY_SCALE = 0.3;
const GROUND_OPACITY_BOOST = 2.6;
const FR1_COLOR = '#38bdf8';
const REUSE_4_COLORS = ['#ff8844', '#44aaff', '#88dd44', '#dd44aa'] as const;

function getBeamColor(frequencyReuse: FrequencyReuse, beamLocalIndex: number): string {
  if (frequencyReuse === 'reuse-4') {
    return REUSE_4_COLORS[positiveModulo(beamLocalIndex, REUSE_4_COLORS.length)];
  }
  return FR1_COLOR;
}

function createCirclePoints(radius: number, segments = 40): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0.2]);
  }
  return points;
}

export function BeamFootprint({
  satellites,
  gainModel,
  frequencyReuse,
  beamScheduler,
  focusWorldXz,
}: BeamFootprintProps) {
  const servingSelection = useMemo(
    () => resolveSceneFocusServingBeam(satellites, focusWorldXz),
    [satellites, focusWorldXz],
  );

  const displaySatellite = useMemo(() => {
    if (servingSelection === null) {
      return null;
    }
    return satellites.find((satellite) => satellite.id === servingSelection.satId) ?? null;
  }, [satellites, servingSelection]);

  const sleepBeamSet = useMemo(() => {
    if (beamScheduler?.summary.mode !== 'coupled') {
      return null;
    }
    const set = new Set<string>();
    for (const state of beamScheduler.states) {
      if (state.powerClass === 'sleep') {
        set.add(bk(state.satId, state.beamId));
      }
    }
    return set;
  }, [beamScheduler]);

  if (displaySatellite === null || servingSelection === null) {
    return null;
  }

  return (
    <>
      {displaySatellite.beams.map((beam, localIdx) => {
        const key = bk(displaySatellite.id, beam.beamId);
        const isServingBeam = beam.beamId === servingSelection.beamId;
        const isSleep = sleepBeamSet?.has(key) ?? false;
        const color = getBeamColor(frequencyReuse, localIdx);
        const boundaryPoints = createCirclePoints(beam.radiusWorld * BOUNDARY_RING_RATIO);
        const roleOpacityScale = isServingBeam ? 1.45 : 0.5;

        return (
          <group
            key={key}
            position={[beam.centerWorld[0], beam.centerWorld[1] + GROUND_Y_OFFSET, beam.centerWorld[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {resolveBeamFootprintBands(gainModel, displaySatellite.visible).map((band, bandIndex) => {
              const innerRadius = beam.radiusWorld * band.innerRadiusRatio;
              const outerRadius = beam.radiusWorld * band.outerRadiusRatio;
              const baseOpacity = Math.min(
                band.opacity * GROUND_OPACITY_BOOST * roleOpacityScale,
                isServingBeam ? 0.72 : 0.24,
              );
              const opacity = isSleep ? baseOpacity * SLEEP_OPACITY_SCALE : baseOpacity;

              return (
                <mesh key={bandIndex}>
                  {band.innerRadiusRatio <= 0 ? (
                    <circleGeometry args={[outerRadius, 40]} />
                  ) : (
                    <ringGeometry args={[innerRadius, outerRadius, 40]} />
                  )}
                  <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={opacity}
                    side={DoubleSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                  />
                </mesh>
              );
            })}

            <Line
              points={boundaryPoints}
              color={color}
              lineWidth={isServingBeam ? 3.8 : 2}
              transparent
              opacity={
                isSleep
                  ? BOUNDARY_RING_OPACITY * BOUNDARY_RING_SLEEP_SCALE
                  : isServingBeam
                    ? 0.96
                    : BOUNDARY_RING_OPACITY * 0.5
              }
              dashed={!isServingBeam}
              dashSize={10}
              gapSize={6}
            />
          </group>
        );
      })}
    </>
  );
}
