import type { Box, MapData } from '../maps/types';

/** Heightfield over the square map: (cells + 1)² samples, row-major from (-size/2, -size/2). */
export interface Terrain {
  size: number;
  cells: number;
  heights: Float32Array;
}

/** Samples `fn` on the grid once, so sim and render agree exactly and lookups stay cheap. */
export function bakeTerrain(size: number, cells: number, fn: (x: number, z: number) => number) {
  const n = cells + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      heights[j * n + i] = fn((i / cells - 0.5) * size, (j / cells - 0.5) * size);
  return { size, cells, heights };
}

/** Bilinear height at (x, z); clamped at the edges. */
export function heightAt(t: Terrain, x: number, z: number) {
  const n = t.cells + 1;
  const fx = Math.max(0, Math.min(t.cells - 1e-6, (x / t.size + 0.5) * t.cells));
  const fz = Math.max(0, Math.min(t.cells - 1e-6, (z / t.size + 0.5) * t.cells));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const h = t.heights;
  const a = h[j * n + i] + (h[j * n + i + 1] - h[j * n + i]) * u;
  const b = h[(j + 1) * n + i] + (h[(j + 1) * n + i + 1] - h[(j + 1) * n + i]) * u;
  return a + (b - a) * v;
}

export const groundAt = (map: MapData, x: number, z: number) =>
  map.terrain ? heightAt(map.terrain, x, z) : 0;

/** Terrain gradient (dh/dx, dh/dz) at (x, z): points uphill, its length is rise over run. */
export function slopeAt(map: MapData, x: number, z: number) {
  const e = 0.5;
  return {
    x: (groundAt(map, x + e, z) - groundAt(map, x - e, z)) / (2 * e),
    z: (groundAt(map, x, z + e) - groundAt(map, x, z - e)) / (2 * e),
  };
}

export const boxTop = (b: Box) => (b.y ?? 0) + b.h;
