import { bakeTerrain, heightAt } from '../sim/terrain';
import { colliderFor, fbm, scatter, seat } from './scatter';
import type { MapData, Prop } from './types';

/**
 * Tribal War arena "Bãi Đá" (team deathmatch), 120 × 120 m, mirror-symmetric north/south so neither side
 * has the better ground. Each team's camp sits at one end; between them three lanes: woods in the west,
 * a field of boulders to fight through in the middle, a raised bank with a ditch in the east.
 */
const SIZE = 120;
const CAMP_Z = 46;

const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function height(x: number, zIn: number) {
  const z = Math.abs(zIn); // mirror: both halves identical
  let h = 0.5 + Math.max(0, fbm(x / 26 + 3, z / 26, 41) - 0.45) * 6;
  h += 3.2 * smooth(18, 30, x) * smooth(46, 38, x); // east bank
  h -= 1.2 * smooth(6, 1, Math.abs(x - 15)) * smooth(40, 30, z); // the ditch below it
  h += smooth(46, 58, Math.max(Math.abs(x), z)) * (10 + 6 * fbm(x / 15, z / 15, 7)); // edge hills
  h += (0.6 - h) * (1 - smooth(9, 14, Math.hypot(x, z - CAMP_Z))); // flat camps
  return h;
}

const terrain = bakeTerrain(SIZE, SIZE, height);
const ground = (x: number, z: number) => heightAt(terrain, x, z);
const at = (id: Prop['id'], x: number, z: number, rot: number, scale = 1): Prop => ({
  id,
  x,
  y: seat(ground, x, z, scale),
  z,
  rot,
  scale,
});
const mirror = (p: Prop): Prop => ({
  ...p,
  z: -p.z,
  y: seat(ground, p.x, -p.z, p.scale),
  rot: p.rot + Math.PI,
});

// Hand-placed cover for the south half (mirrored to the north): boulders in the middle, logs on the lanes.
const south: Prop[] = [
  at('rock_1', -5, -8, 0.3, 1.8),
  at('rock_2', 6, -14, 1.2, 2),
  at('rock_3', -11, -20, 2.1, 1.6),
  at('rock_1', 2, -24, 4, 1.4),
  at('rock_2', -2, -3, 0.8, 1.5),
  at('log', -24, -12, 0),
  at('log', 20, -22, Math.PI / 2),
  at('log', -8, -32, Math.PI / 2, 0.8),
  at('bones', 8, -4, 1.1, 0.8),
  // Team camp: a tent and a fire behind the spawn.
  at('tent', -6, -CAMP_Z - 6, 0.4),
  at('tent', 6, -CAMP_Z - 6, -0.4),
  at('fire_pit', 0, -CAMP_Z - 3, 0),
  at('drying_rack', 10, -CAMP_Z + 1, Math.PI / 2),
];
const fixed = [...south, ...south.map(mirror)];
const colliders = fixed.map(colliderFor).filter((b) => b !== null);

const westWoods = (x: number) => x < -14;
const clearOfCamps = (x: number, z: number) => Math.hypot(x, Math.abs(z) - CAMP_Z) > 13;
const halfProps = scatter(
  SIZE,
  ground,
  colliders,
  [
    {
      ids: ['tree_pine', 'tree_common'],
      count: 70,
      gap: 2.5,
      where: (x, z) =>
        z < -1 && clearOfCamps(x, z) && (westWoods(x) || Math.max(Math.abs(x), -z) > 50),
    },
    {
      ids: ['rock_1', 'rock_2', 'rock_3'],
      count: 10,
      gap: 2,
      where: (x, z) => z < -2 && clearOfCamps(x, z) && x > 22,
    },
    { ids: ['bush'], count: 40, gap: 1, where: (x, z) => z < -1 && clearOfCamps(x, z) },
    { ids: ['fern', 'plant'], count: 50, gap: 0.6, where: (x, z) => z < -1 && westWoods(x) },
    { ids: ['grass_tall', 'grass_short'], count: 160, gap: 0.3, where: (_x, z) => z < -0.5 },
    { ids: ['flowers', 'clover'], count: 90, gap: 0.3, where: (x, z) => z < -0.5 && !westWoods(x) },
    { ids: ['pebble'], count: 40, gap: 0.3, where: (_x, z) => z < -0.5 },
  ],
  11,
).props;
const props = [...fixed, ...halfProps, ...halfProps.map(mirror)];

const spawns = (sign: 1 | -1) =>
  [-6, -2, 2, 6]
    .map((x) => ({ x, z: sign * (CAMP_Z - 2) }))
    .concat([
      { x: -9, z: sign * (CAMP_Z + 1) },
      { x: 9, z: sign * (CAMP_Z + 1) },
    ]);

export const tribalWar: MapData = {
  size: SIZE,
  spawn: { x: 0, z: -(CAMP_Z - 2) },
  boxes: [
    ...colliders,
    ...props
      .slice(fixed.length)
      .map(colliderFor)
      .filter((b) => b !== null),
  ],
  terrain,
  creatures: [],
  props,
  teams: [spawns(-1), spawns(1)], // team 0 (the player's) in the south
  time: 16.5, // late afternoon light
};
