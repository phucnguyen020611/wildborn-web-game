import { colliderFor, scatter } from './scatter';
import type { MapData, Prop } from './types';

const spawn = { x: 0, z: -20 };

/** Solid props (trees, rocks) on an outer ring clear of the patrol routes; walk-through plants anywhere. */
const ring = (minR: number, maxR: number) => (x: number, z: number) => {
  const r = Math.hypot(x, z);
  return r >= minR && r <= maxR && Math.hypot(x - spawn.x, z - spawn.z) >= 4; // keep the spawn view open
};

// Hand-placed boulders: cover between the spawn and the mammoth's clearing, kept off both patrol routes.
const boulders: Prop[] = [
  { id: 'rock_1', x: 0, z: 0, rot: 0.6, scale: 2.5 },
  { id: 'rock_2', x: -11, z: -6, rot: 2.1, scale: 1.8 },
  { id: 'rock_3', x: 7, z: -6, rot: 4.0, scale: 2 },
  { id: 'rock_2', x: -15, z: 12, rot: 1.2, scale: 2.6 },
  { id: 'rock_1', x: 17, z: 18, rot: 3.3, scale: 2.2 },
  { id: 'rock_3', x: -20, z: -16, rot: 5.1, scale: 1.6 },
  { id: 'rock_1', x: 19, z: -18, rot: 0.2, scale: 1.5 },
];
const colliders = boulders.map(colliderFor).filter((b) => b !== null);
const { props, solids } = scatter(
  60,
  () => 0,
  colliders,
  [
    { ids: ['tree_common', 'tree_pine', 'tree_dead'], count: 45, gap: 1.5, where: ring(24, 29) },
    { ids: ['rock_1', 'rock_2', 'rock_3'], count: 10, gap: 1, where: ring(23, 29) },
    { ids: ['bush', 'fern'], count: 40, gap: 0.5, where: ring(3, 29) },
    { ids: ['grass_tall'], count: 120, gap: 0.2, where: ring(2, 29) },
    { ids: ['flowers'], count: 40, gap: 0.3, where: ring(2, 29) },
    { ids: ['clover'], count: 50, gap: 0.2, where: ring(2, 29) },
    { ids: ['mushroom'], count: 15, gap: 0.2, where: ring(18, 28) }, // near the tree line
    { ids: ['pebble'], count: 30, gap: 0.2, where: ring(2, 29) },
  ],
  1,
);

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
