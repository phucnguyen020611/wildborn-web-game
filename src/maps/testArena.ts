import { PROPS, type PropConfig, type PropId } from '../config/props';
import type { CreatureKind } from '../config/creatures';

/** Axis-aligned box sitting on the ground: center (x, z), size (w, d), height h. */
export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hidden?: boolean; // collision only (e.g. a tree trunk); not drawn as a blockout box
}

export interface Prop {
  id: PropId;
  x: number;
  z: number;
  rot: number;
  scale: number;
}

export interface CreatureSpawn {
  kind: CreatureKind;
  waypoints: { x: number; z: number }[]; // spawns at the first, then patrols the loop
}

export interface MapData {
  size: number; // square arena edge length, centered on origin
  spawn: { x: number; z: number };
  boxes: Box[];
  creatures: CreatureSpawn[];
  props?: Prop[];
}

/** Small deterministic PRNG so the layout is identical every load (and on a future server). */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solid props (trees, rocks) on an outer ring clear of the patrol route; walk-through plants anywhere. */
function scatter(boxes: Box[], spawn: { x: number; z: number }, seed: number) {
  const rand = mulberry32(seed);
  const props: Prop[] = [];
  const solids: Box[] = [];
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const clear = (x: number, z: number, r: number) =>
    [...boxes, ...solids].every(
      (b) => Math.abs(x - b.x) > b.w / 2 + r || Math.abs(z - b.z) > b.d / 2 + r,
    );

  const place = (ids: PropId[], count: number, minR: number, maxR: number, gap: number) => {
    for (let tries = 0, placed = 0; placed < count && tries < count * 20; tries++) {
      const a = rand() * Math.PI * 2;
      const r = minR + rand() * (maxR - minR);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (!clear(x, z, gap) || Math.hypot(x - spawn.x, z - spawn.z) < 4) continue; // keep the spawn view open
      const id = pick(ids);
      const scale = 0.8 + rand() * 0.4;
      props.push({ id, x, z, rot: rand() * Math.PI * 2, scale });
      const c = (PROPS[id] as PropConfig).collider;
      if (c) solids.push({ x, z, w: c.w * scale, d: c.d * scale, h: c.h * scale, hidden: true });
      placed++;
    }
  };

  place(['env_tree_common_1', 'env_tree_pine_1', 'env_tree_dead_1'], 45, 24, 29, 1.5);
  place(['env_rock_medium_1', 'env_rock_medium_2'], 10, 23, 29, 1);
  place(['env_bush_flowers', 'env_fern_1'], 40, 3, 29, 0.5);
  place(['env_grass_tall'], 120, 2, 29, 0.2);
  return { props, solids };
}

const blockout: Box[] = [
  { x: 0, z: 0, w: 4, d: 4, h: 3 },
  { x: -8, z: 6, w: 2, d: 6, h: 1.5 },
  { x: 9, z: 4, w: 3, d: 3, h: 5 },
  { x: -12, z: -8, w: 6, d: 1, h: 2 },
  { x: 14, z: -10, w: 1.5, d: 1.5, h: 4 },
  { x: 4, z: 14, w: 8, d: 2, h: 2.5 },
  { x: -16, z: 16, w: 3, d: 3, h: 6 },
  { x: 18, z: 18, w: 2, d: 2, h: 1 },
];
const spawn = { x: 0, z: -20 };
const { props, solids } = scatter(blockout, spawn, 1);

export const testArena: MapData = {
  size: 60,
  spawn,
  boxes: [...blockout, ...solids],
  creatures: [
    {
      kind: 'fox',
      waypoints: [
        { x: -6, z: -10 },
        { x: 10, z: -14 },
        { x: 16, z: 8 },
        { x: 0, z: 22 },
        { x: -18, z: 4 },
      ],
    },
    {
      kind: 'mammoth', // grazes in the far half of the arena
      waypoints: [
        { x: -6, z: 18 },
        { x: 9, z: 20 },
        { x: 15, z: 11 },
        { x: -2, z: 9 },
      ],
    },
  ],
  props,
};
