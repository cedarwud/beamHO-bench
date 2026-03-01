/**
 * Shared geo conversion helpers for scenario builders.
 */

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function worldToLatLon(
  worldX: number,
  worldZ: number,
  kmToWorldScale: number,
  baseLat: number,
  baseLon: number,
): [number, number] {
  const kmEast = worldX / kmToWorldScale;
  const kmNorth = worldZ / kmToWorldScale;
  const lat = baseLat + kmNorth / 110.574;
  const lon = baseLon + kmEast / (111.32 * Math.cos(degToRad(baseLat)));
  return [lat, lon];
}
