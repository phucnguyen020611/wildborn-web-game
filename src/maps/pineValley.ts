import { bakeTerrain, heightAt } from '../sim/terrain';
import { distanceToPaths } from './paths';
import { colliderFor, fbm, scatter, seat } from './scatter';
import type { MapData, Prop } from './types';

/**
 * Region 1 — Thung lũng Thông (docs/STORY_MODE.md). +z is north.
 * Camp in the south, a creek across the middle (forded by the trail), meadows to hunt in,
 * and the mammoth's clearing in the north, all walled in by mountains that the fog swallows.
 */
const SIZE = 160;
const WATER = -0.4;
const CAMP = { x: 0, z: -58, r: 10 };
const ARENA = { x: 0, z: 52, r: 17 };

const trails = [
  [
    { x: 0, z: -58 },
    { x: 6, z: -42 },
    { x: 1, z: -24 }, // ford
    { x: -9, z: -6 },
    { x: -6, z: 14 },
    { x: 4, z: 28 },
    { x: 0, z: 38 }, // arena entrance
  ],
  [
    { x: -6, z: 14 },
    { x: 22, z: 8 },
    { x: 40, z: 22 },
  ],
];

const creekZ = (x: number) => -22 + 7 * Math.sin(x / 17) + 3 * Math.sin(x / 7);
const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const near = (p: { x: number; z: number }, x: number, z: number) => Math.hypot(x - p.x, z - p.z);

function height(x: number, z: number) {
  const trail = distanceToPaths({ paths: trails }, x, z);
  // Meadow floor at 0.5 m with hills rising out of it (never dipping below the water: only the creek does),
  // calmer along the trail so it stays walkable.
  let h =
    0.5 + Math.max(0, fbm(x / 45 + 10, z / 45, 11) - 0.42) * 22 * (0.3 + 0.7 * smooth(2, 9, trail));
  // Mountains on every edge.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(56, 78, edge) * (14 + 8 * fbm(x / 20, z / 20, 5));
  // Flat camp and arena floors, carved out of the mountains' foot where they reach it.
  h += (0.6 - h) * (1 - smooth(CAMP.r, CAMP.r + 8, near(CAMP, x, z)));
  h += (1.2 - h) * (1 - smooth(ARENA.r, ARENA.r + 6, near(ARENA, x, z)));
  // Creek bed; shallower at the ford so the trail crosses in ankle-deep water.
  const bed = WATER - (trail < 4 ? 0.25 : 1);
  h += (bed - h) * (1 - smooth(2, 7, Math.abs(z - creekZ(x))));
  // Ridge around the arena (south side open).
  const ring = near(ARENA, x, z);
  const entrance = smooth(0.6, 0.85, (ARENA.z - z) / (ring || 1)); // ~35° cone facing south
  h +=
    5 *
    smooth(ARENA.r + 1, ARENA.r + 6, ring) *
    smooth(ARENA.r + 14, ARENA.r + 8, ring) *
    (1 - entrance);
  return h;
}

const terrain = bakeTerrain(SIZE, SIZE, height);
const ground = (x: number, z: number) => heightAt(terrain, x, z);
const spawn = { x: CAMP.x, z: CAMP.z + 3 };

// Boulders around the arena: cover to break the mammoth's charge, gap left at the south entrance.
const boulders: Prop[] = [];
for (let i = 0; i < 9; i++) {
  const a = Math.PI * 0.25 + (i / 8) * Math.PI * 1.5; // skip the southern quarter
  const r = ARENA.r - 2 + (i % 2) * 3;
  const x = ARENA.x + Math.sin(a + Math.PI) * r;
  const z = ARENA.z + Math.cos(a + Math.PI) * r;
  const scale = 2.2 + (i % 3) * 0.4;
  const id = (['rock_1', 'rock_2', 'rock_3'] as const)[i % 3];
  boulders.push({ id, x, y: seat(ground, x, z, 1.3 * scale), z, rot: i * 1.7, scale });
}

// Camp: tents with their doorways toward the fire, seats around it, a rack of drying hides.
const FIRE = { x: CAMP.x, z: CAMP.z - 2 };
const facingFire = (x: number, z: number) => Math.atan2(FIRE.x - x, FIRE.z - z);
const at = (id: Prop['id'], x: number, z: number, rot: number, scale = 1): Prop => ({
  id,
  x,
  y: seat(ground, x, z, scale),
  z,
  rot,
  scale,
});
const camp: Prop[] = [
  at('fire_pit', FIRE.x, FIRE.z, 0),
  at('tent', -6, -61, facingFire(-6, -61)),
  at('tent', 5.5, -63, facingFire(5.5, -63)),
  at('tent', -1, -67, facingFire(-1, -67), 1.15),
  at('log', 0, FIRE.z - 2.2, 0, 0.5), // seats: quarter turns only (non-square colliders)
  at('log', -2.4, FIRE.z, Math.PI / 2, 0.45),
  at('stump', 2.3, FIRE.z + 0.6, 0.4),
  at('drying_rack', 7, -56, Math.PI / 2),
  // Along the way: a fallen trunk to step around, and old mammoth bones warning of the clearing ahead.
  at('log', -14, 4, 0),
  at('log', 14, -8, Math.PI / 2),
  at('bones', 7, 33, 2.4),
];
const colliders = [...boulders, ...camp].map(colliderFor).filter((b) => b !== null);

const trail = (x: number, z: number) => distanceToPaths({ paths: trails }, x, z);
const dry = (x: number, z: number) => ground(x, z) > WATER + 0.3;
const open = (x: number, z: number) =>
  near(CAMP, x, z) > CAMP.r + 2 && near(ARENA, x, z) > ARENA.r - 3 && near(spawn, x, z) > 5;
const forest = (x: number, z: number) =>
  fbm(x / 30, z / 30, 21) > 0.52 || Math.max(Math.abs(x), Math.abs(z)) > 50;

const { props, solids } = scatter(
  SIZE,
  ground,
  colliders,
  [
    {
      ids: ['tree_pine', 'tree_pine', 'tree_common'],
      count: 320,
      gap: 2,
      where: (x, z) => forest(x, z) && dry(x, z) && open(x, z) && trail(x, z) > 4,
    },
    {
      ids: ['tree_dead'],
      count: 14,
      gap: 3,
      where: (x, z) => dry(x, z) && open(x, z) && trail(x, z) > 6,
    },
    {
      ids: ['rock_1', 'rock_2', 'rock_3'],
      count: 45,
      gap: 1.5,
      where: (x, z) => open(x, z) && trail(x, z) > 3,
    },
    {
      ids: ['bush'],
      count: 90,
      gap: 1,
      where: (x, z) => dry(x, z) && open(x, z) && trail(x, z) > 2,
    },
    {
      ids: ['fern', 'plant'],
      count: 160,
      gap: 0.6,
      where: (x, z) => forest(x, z) && dry(x, z) && open(x, z),
    },
    {
      ids: ['grass_tall', 'grass_short'],
      count: 400, // taller clumps over the dense GPU grass (render/grass.ts)
      gap: 0.2,
      where: (x, z) => dry(x, z) && trail(x, z) > 1.2,
    },
    {
      ids: ['flowers'],
      count: 160,
      gap: 0.3,
      where: (x, z) => !forest(x, z) && dry(x, z) && trail(x, z) > 1.5,
    },
    { ids: ['clover'], count: 200, gap: 0.2, where: (x, z) => dry(x, z) && trail(x, z) > 1 },
    { ids: ['mushroom'], count: 60, gap: 0.2, where: (x, z) => forest(x, z) && dry(x, z) },
    { ids: ['stump'], count: 20, gap: 1, where: (x, z) => forest(x, z) && dry(x, z) && open(x, z) },
    { ids: ['pebble'], count: 120, gap: 0.2, where: (x, z) => trail(x, z) < 2 || !dry(x, z) },
    { ids: ['path_stone'], count: 80, gap: 0.4, where: (x, z) => trail(x, z) < 0.8 && dry(x, z) },
  ],
  2,
);

export const pineValley: MapData = {
  size: SIZE,
  spawn,
  boxes: [...colliders, ...solids],
  terrain,
  water: WATER,
  paths: trails,
  creatures: [
    {
      kind: 'fox',
      waypoints: [
        { x: 18, z: 4 },
        { x: 34, z: 16 },
        { x: 26, z: 30 },
        { x: 10, z: 20 },
      ],
    },
    {
      kind: 'fox',
      waypoints: [
        { x: -24, z: -2 },
        { x: -14, z: 10 },
        { x: -30, z: 18 },
      ],
    },
    {
      kind: 'mammoth', // grazes in its clearing
      waypoints: [
        { x: -6, z: 50 },
        { x: 4, z: 58 },
        { x: 9, z: 48 },
        { x: 0, z: 44 },
      ],
    },
  ],
  props: [...boulders, ...camp, ...props],
};
