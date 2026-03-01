import type { BeamState, SatelliteState, UEState } from '@/sim/types';
import { worldToLatLon } from './geo';

export function wrapValue(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) {
    return value;
  }

  let wrapped = value;
  while (wrapped < min) {
    wrapped += range;
  }
  while (wrapped > max) {
    wrapped -= range;
  }
  return wrapped;
}

export interface MoveUesLinearXOptions {
  ues: UEState[];
  timeStepSec: number;
  widthWorld: number;
  kmToWorldScale: number;
  observerLat: number;
  observerLon: number;
}

export function moveUesLinearX(options: MoveUesLinearXOptions): UEState[] {
  const { ues, timeStepSec, widthWorld, kmToWorldScale, observerLat, observerLon } = options;

  return ues.map((ue) => {
    const speedWorldPerSec = (ue.speedKmph / 3600) * kmToWorldScale;
    const dx = speedWorldPerSec * timeStepSec;
    const nextX = wrapValue(ue.positionWorld[0] + dx, -widthWorld / 2, widthWorld / 2);
    const nextZ = ue.positionWorld[2];
    const [lat, lon] = worldToLatLon(nextX, nextZ, kmToWorldScale, observerLat, observerLon);

    return {
      ...ue,
      positionWorld: [nextX, ue.positionWorld[1], nextZ],
      positionLatLon: [lat, lon],
    };
  });
}

export function attachUesToBeams(ues: UEState[], satellites: SatelliteState[]): SatelliteState[] {
  const attached: SatelliteState[] = satellites.map((satellite) => ({
    ...satellite,
    beams: satellite.beams.map((beam): BeamState => ({
      ...beam,
      connectedUeIds: [],
    })),
  }));

  const satelliteById = new Map(attached.map((satellite) => [satellite.id, satellite]));

  for (const ue of ues) {
    if (ue.servingSatId === null || ue.servingBeamId === null) {
      continue;
    }

    const satellite = satelliteById.get(ue.servingSatId);
    if (!satellite) {
      continue;
    }

    const beam = satellite.beams.find((candidate) => candidate.beamId === ue.servingBeamId);
    if (!beam) {
      continue;
    }

    beam.connectedUeIds.push(ue.id);
  }

  return attached;
}
