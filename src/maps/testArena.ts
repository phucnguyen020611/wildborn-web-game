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

/** Collision box for a placed prop, or null if it is walk-through. The offset turns with the prop. */
function colliderFor(p: Prop): Box | null {
  const c = (PROPS[p.id] as PropConfig).collider;
  if (!c) return null;
  const ox = (c.cx ?? 0) * p.scale;
  const oz = (c.cz ?? 0) * p.scale;
  // Same convention as headings: rotating +z toward +x.
  const x = p.x + ox * Math.cos(p.rot) + oz * Math.sin(p.rot);
  const z = p.z - ox * Math.sin(p.rot) + oz * Math.cos(p.rot);
  return { x, z, w: c.w * p.scale, d: c.d * p.scale, h: c.h * p.scale, hidden: true };
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
      const scale = ((PROPS[id] as PropConfig).scale ?? 1) * (0.8 + rand() * 0.4);
      props.push({ id, x, z, rot: rand() * Math.PI * 2, scale });
      const box = colliderFor(props[props.length - 1]);
      if (box) solids.push(box);
      placed++;
    }
  };

  place(['env_tree_common_1', 'env_tree_pine_1', 'env_tree_dead_1'], 45, 24, 29, 1.5);
  place(['env_rock_medium_1', 'env_rock_medium_2', 'env_rock_medium_3'], 10, 23, 29, 1);
  place(['env_bush_flowers', 'env_fern_1'], 40, 3, 29, 0.5);
  place(['env_grass_tall'], 120, 2, 29, 0.2);
  place(['env_flowers_1', 'env_flowers_2'], 40, 2, 29, 0.3);
  place(['env_clover'], 50, 2, 29, 0.2);
  place(['env_mushroom'], 15, 18, 28, 0.2); // near the tree line
  place(['env_pebble_1', 'env_pebble_2'], 30, 2, 29, 0.2);
  return { props, solids };
}

// Hand-placed boulders: cover between the spawn and the mammoth's clearing, kept off both patrol routes.
const boulders: Prop[] = [
  { id: 'env_rock_medium_1', x: 0, z: 0, rot: 0.6, scale: 2.5 },
  { id: 'env_rock_medium_2', x: -11, z: -6, rot: 2.1, scale: 1.8 },
  { id: 'env_rock_medium_3', x: 7, z: -6, rot: 4.0, scale: 2 },
  { id: 'env_rock_medium_2', x: -15, z: 12, rot: 1.2, scale: 2.6 },
  { id: 'env_rock_medium_1', x: 17, z: 18, rot: 3.3, scale: 2.2 },
  { id: 'env_rock_medium_3', x: -20, z: -16, rot: 5.1, scale: 1.6 },
  { id: 'env_rock_medium_1', x: 19, z: -18, rot: 0.2, scale: 1.5 },
];
const colliders = boulders.map(colliderFor).filter((b) => b !== null);
const spawn = { x: 0, z: -20 };
const { props, solids } = scatter(colliders, spawn, 1);

export const testArena: MapData = {
  size: 60,
  spawn,
  boxes: [...colliders, ...solids],
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
  props: [...boulders, ...props],
};
