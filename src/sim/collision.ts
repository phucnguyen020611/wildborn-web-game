import type { Box, MapData } from '../maps/testArena';

interface XZ {
  x: number;
  z: number;
}

/** Circle (radius r) vs the box footprint. Touching edges don't count. */
export function overlapsBox(p: XZ, r: number, b: Box) {
  const cx = Math.max(b.x - b.w / 2, Math.min(p.x, b.x + b.w / 2));
  const cz = Math.max(b.z - b.d / 2, Math.min(p.z, b.z + b.d / 2));
  return Math.hypot(p.x - cx, p.z - cz) < r - 1e-6;
}

/** Moves a circle out of a box footprint along the shortest direction. */
export function pushOutOfBox(p: XZ, r: number, b: Box) {
  const cx = Math.max(b.x - b.w / 2, Math.min(p.x, b.x + b.w / 2));
  const cz = Math.max(b.z - b.d / 2, Math.min(p.z, b.z + b.d / 2));
  const ox = p.x - cx;
  const oz = p.z - cz;
  const dist = Math.hypot(ox, oz);
  if (dist >= r) return;
  if (dist > 1e-6) {
    p.x = cx + (ox / dist) * r;
    p.z = cz + (oz / dist) * r;
  } else {
    // Center is inside the box: push out along the shallowest axis.
    const pushX = b.w / 2 + r - Math.abs(p.x - b.x);
    const pushZ = b.d / 2 + r - Math.abs(p.z - b.z);
    if (pushX < pushZ) p.x += Math.sign(p.x - b.x || 1) * pushX;
    else p.z += Math.sign(p.z - b.z || 1) * pushZ;
  }
}

export function clampToArena(p: XZ, r: number, map: MapData) {
  const half = map.size / 2 - r;
  p.x = Math.max(-half, Math.min(half, p.x));
  p.z = Math.max(-half, Math.min(half, p.z));
}
