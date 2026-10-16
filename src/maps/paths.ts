import type { MapData } from './types';

type XZ = { x: number; z: number };

function segment(p: XZ, a: XZ, b: XZ) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

/** Distance from (x, z) to the nearest trail (Infinity without trails). */
export function distanceToPaths(map: Pick<MapData, 'paths'>, x: number, z: number) {
  let best = Infinity;
  for (const line of map.paths ?? [])
    for (let i = 1; i < line.length; i++)
      best = Math.min(best, segment({ x, z }, line[i - 1], line[i]));
  return best;
}
