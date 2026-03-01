import type { BeamState } from '@/sim/types';
import { worldToLatLon } from './geo';

export function buildHexOffsets(count: number): Array<[number, number]> {
  if (count <= 0) {
    return [];
  }

  const offsets: Array<[number, number]> = [[0, 0]];

  for (let radius = 1; offsets.length < count; radius += 1) {
    let q = radius;
    let r = 0;

    const directions: Array<[number, number]> = [
      [-1, 1],
      [-1, 0],
      [0, -1],
      [1, -1],
      [1, 0],
      [0, 1],
    ];

    for (const [dq, dr] of directions) {
      for (let step = 0; step < radius; step += 1) {
        if (offsets.length >= count) {
          return offsets;
        }
        offsets.push([q, r]);
        q += dq;
        r += dr;
      }
    }
  }

  return offsets;
}

export function axialToWorld(q: number, r: number, spacing: number): [number, number] {
  const x = spacing * Math.sqrt(3) * (q + r / 2);
  const z = spacing * 1.5 * r;
  return [x, z];
}

export function buildSatelliteGroundCenters(
  satCount: number,
  radiusWorld: number,
): Array<[number, number]> {
  if (satCount <= 0) {
    return [];
  }

  if (satCount === 1) {
    return [[0, 0]];
  }

  if (satCount === 7) {
    const centers: Array<[number, number]> = [[0, 0]];

    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      centers.push([Math.cos(angle) * radiusWorld, Math.sin(angle) * radiusWorld]);
    }

    return centers;
  }

  const centers: Array<[number, number]> = [[0, 0]];

  for (let i = 1; i < satCount; i += 1) {
    const angle = (Math.PI * 2 * (i - 1)) / (satCount - 1);
    centers.push([Math.cos(angle) * radiusWorld, Math.sin(angle) * radiusWorld]);
  }

  return centers;
}

export interface BuildBeamsForSatelliteOptions {
  satelliteId: number;
  beamIdMultiplier: number;
  centerWorld: [number, number];
  beamCount: number;
  beamRadiusKm: number;
  beamRadiusWorld: number;
  spacingWorld: number;
  kmToWorldScale: number;
  observerLat: number;
  observerLon: number;
}

export function buildBeamsForSatellite(options: BuildBeamsForSatelliteOptions): BeamState[] {
  const {
    satelliteId,
    beamIdMultiplier,
    centerWorld,
    beamCount,
    beamRadiusKm,
    beamRadiusWorld,
    spacingWorld,
    kmToWorldScale,
    observerLat,
    observerLon,
  } = options;
  const offsets = buildHexOffsets(beamCount);

  return offsets.map(([q, r], index) => {
    const [dx, dz] = axialToWorld(q, r, spacingWorld);
    const centerX = centerWorld[0] + dx;
    const centerZ = centerWorld[1] + dz;
    const [lat, lon] = worldToLatLon(centerX, centerZ, kmToWorldScale, observerLat, observerLon);

    return {
      beamId: satelliteId * beamIdMultiplier + index,
      centerLatLon: [lat, lon],
      centerWorld: [centerX, 0.25, centerZ],
      radiusKm: beamRadiusKm,
      radiusWorld: beamRadiusWorld,
      connectedUeIds: [],
    };
  });
}

export function computeBeamSpacingWorld(
  beamRadiusWorld: number,
  overlapRatio: number | undefined,
): number {
  // Source: PAP-2024-MCCHO-CORE
  // Overlap ratio maps to inter-beam spacing for footprint overlap consistency.
  return beamRadiusWorld * Math.max(0.8, 2 - (overlapRatio ?? 0));
}
