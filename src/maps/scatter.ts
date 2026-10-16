import { PROPS, type PropConfig, type PropId } from '../config/props';
import type { Box, Prop } from './types';

/** Small deterministic PRNG so the layout is identical every load (and on a future server). */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(i: number, j: number, seed: number) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1], one feature per unit. */
export function noise(x: number, z: number, seed: number) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const u = fade(x - i);
  const v = fade(z - j);
  const a = hash(i, j, seed) + (hash(i + 1, j, seed) - hash(i, j, seed)) * u;
  const b = hash(i, j + 1, seed) + (hash(i + 1, j + 1, seed) - hash(i, j + 1, seed)) * u;
  return a + (b - a) * v;
}

/** Layered noise in [0, 1]: big shapes plus finer detail. */
export function fbm(x: number, z: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++, x *= 2, z *= 2, amp /= 2) {
    sum += noise(x, z, seed + o) * amp;
    norm += amp;
  }
  return sum / norm;
}

/** Lowest ground under a footprint of radius r, so props on slopes don't float on the downhill side. */
export function seat(ground: (x: number, z: number) => number, x: number, z: number, r: number) {
  return Math.min(
    ground(x, z),
    ground(x + r, z),
    ground(x - r, z),
    ground(x, z + r),
    ground(x, z - r),
  );
}

/** Collision box for a placed prop, or null if it is walk-through. The offset turns with the prop. */
export function colliderFor(p: Prop): Box | null {
  const c = (PROPS[p.id] as PropConfig).collider;
  if (!c) return null;
  const ox = (c.cx ?? 0) * p.scale;
  const oz = (c.cz ?? 0) * p.scale;
  // Same convention as headings: rotating +z toward +x.
  const x = p.x + ox * Math.cos(p.rot) + oz * Math.sin(p.rot);
  const z = p.z - ox * Math.sin(p.rot) + oz * Math.cos(p.rot);
  const turned = Math.round(p.rot / (Math.PI / 2)) % 2 !== 0; // quarter turn: footprint swaps axes
  const [w, d] = turned ? [c.d, c.w] : [c.w, c.d];
  return { x, z, w: w * p.scale, d: d * p.scale, h: c.h * p.scale, y: p.y, hidden: true };
}

export interface ScatterRule {
  ids: PropId[];
  count: number;
  gap: number; // clearance from boxes and earlier solid props; >= own half-size so solids never overlap
  where: (x: number, z: number) => boolean; // allowed spots
}

/** Places props at random allowed spots; solid ones (with colliders) also block later placements. */
export function scatter(
  size: number,
  ground: (x: number, z: number) => number,
  blockers: Box[],
  rules: ScatterRule[],
  seed: number,
) {
  const rand = mulberry32(seed);
  const props: Prop[] = [];
  const solids: Box[] = [];
  const clear = (x: number, z: number, r: number) =>
    [...blockers, ...solids].every(
      (b) => Math.abs(x - b.x) > b.w / 2 + r || Math.abs(z - b.z) > b.d / 2 + r,
    );
  for (const { ids, count, gap, where } of rules) {
    for (let tries = 0, placed = 0; placed < count && tries < count * 30; tries++) {
      const x = (rand() - 0.5) * (size - 2);
      const z = (rand() - 0.5) * (size - 2);
      if (!where(x, z) || !clear(x, z, gap)) continue;
      const id = ids[Math.floor(rand() * ids.length)];
      const cfg = PROPS[id] as PropConfig;
      const scale = (cfg.scale ?? 1) * (0.8 + rand() * 0.4);
      const p: Prop = {
        id,
        variant: Math.floor(rand() * cfg.nodes.length),
        x,
        y: seat(ground, x, z, ((cfg.collider?.w ?? 0.6) / 2) * scale),
        z,
        rot: rand() * Math.PI * 2,
        scale,
      };
      props.push(p);
      const box = colliderFor(p);
      if (box) solids.push(box);
      placed++;
    }
  }
  return { props, solids };
}
