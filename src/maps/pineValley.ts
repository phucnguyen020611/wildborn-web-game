import { bakeTerrain, heightAt } from '../sim/terrain';
import { distanceToPaths } from './paths';
import { colliderFor, fbm, mulberry32, scatter, seat } from './scatter';
import type { MapData, Prop } from './types';

/**
 * Act 1 — Thung lũng Thông (docs/STORY_MODE.md), 400 × 400 m. +z is north.
 * A funnel: the base camp in the south, a creek across the valley, then three ways north (west through
 * the wolf woods, the main trail up the middle, east past the deer meadows and the pond). They all meet
 * at the forward camp below the only pass through the northern wall; the mammoth's arena lies beyond.
 * Off the trails: the alpha wolf's den, an abandoned camp, a herb grove, a lookout hill.
 */
const SIZE = 400;
const WATER = -0.4;
const CAMP = { x: 0, z: -168, r: 10 };
const FORWARD = { x: 0, z: 92, r: 7 }; // forward camp: checkpoint before the pass
const PASS = { x: 0, z: 118 };
const ARENA = { x: 0, z: 152, r: 22 };
const POND = { x: 96, z: 18, r: 13 };
const DEN = { x: -130, z: 70, r: 9 }; // alpha wolf
const OLD_CAMP = { x: -112, z: -62, r: 7 };
const GROVE = { x: 132, z: 44 }; // herbs
const LOOKOUT = { x: 58, z: 66 };

const trails = [
  // Main trail: camp, ford, up the middle to the forward camp and through the pass.
  [
    { x: 0, z: -168 },
    { x: 6, z: -140 },
    { x: 2, z: -110 }, // ford
    { x: -6, z: -80 },
    { x: 6, z: -40 },
    { x: -4, z: 0 },
    { x: 8, z: 40 },
    { x: 2, z: 70 },
    { x: 0, z: 92 },
    { x: 0, z: 120 },
    { x: 0, z: 134 }, // arena entrance
  ],
  // West: through the wolf woods.
  [
    { x: -6, z: -80 },
    { x: -50, z: -64 },
    { x: -88, z: -24 },
    { x: -100, z: 26 },
    { x: -72, z: 76 },
    { x: -32, z: 98 },
    { x: 0, z: 92 },
  ],
  // East: across a second ford, along the meadows and the pond.
  [
    { x: 6, z: -140 },
    { x: 48, z: -124 },
    { x: 72, z: -104 }, // ford
    { x: 92, z: -58 },
    { x: 104, z: -6 },
    { x: 88, z: 46 },
    { x: 48, z: 86 },
    { x: 0, z: 92 },
  ],
  // Side paths: to the den, the abandoned camp, the herb grove.
  [
    { x: -100, z: 26 },
    { x: -124, z: 60 },
  ],
  [
    { x: -50, z: -64 },
    { x: -106, z: -62 },
  ],
  [
    { x: 104, z: -6 },
    { x: 128, z: 38 },
  ],
];

const creekZ = (x: number) => -110 + 12 * Math.sin(x / 40) + 5 * Math.sin(x / 13);
const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const near = (p: { x: number; z: number }, x: number, z: number) => Math.hypot(x - p.x, z - p.z);
const flatten = (
  h: number,
  to: number,
  p: { x: number; z: number; r: number },
  x: number,
  z: number,
  edge = 8,
) => h + (to - h) * (1 - smooth(p.r, p.r + edge, near(p, x, z)));

function height(x: number, z: number) {
  const trail = distanceToPaths({ paths: trails }, x, z);
  // Valley floor at 0.5 m with rolling hills (never below the water: only the creek and pond are),
  // calmer along the trails so they stay walkable; the hills between the routes keep them apart.
  let h =
    0.5 + Math.max(0, fbm(x / 60 + 10, z / 60, 11) - 0.4) * 34 * (0.2 + 0.8 * smooth(3, 16, trail));
  h += smooth(42, 0, near(LOOKOUT, x, z)) * 16; // lookout hill
  // Mountains on every edge, and the northern wall: one pass, where the trail runs.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(168, 196, edge) * (18 + 10 * fbm(x / 25, z / 25, 5));
  h +=
    24 *
    smooth(100, 112, z) *
    smooth(140, 126, z) *
    smooth(9, 22, Math.abs(x - PASS.x)) *
    (0.8 + 0.4 * fbm(x / 20, z / 20, 9));
  // Flat floors for the camps, the den, the arena.
  h = flatten(h, 0.6, CAMP, x, z);
  h = flatten(h, 1.0, FORWARD, x, z, 6);
  h = flatten(h, 1.0, OLD_CAMP, x, z, 6);
  h = flatten(h, h * 0.4 + 0.6, DEN, x, z, 6);
  h = flatten(h, 1.2, ARENA, x, z, 8);
  // Creek bed (shallow at the fords) and the pond.
  const bed = WATER - (trail < 4 ? 0.25 : 1);
  // The creek runs out under the mountains instead of cutting a way out of the valley.
  h += (bed - h) * (1 - smooth(2.5, 8, Math.abs(z - creekZ(x)))) * smooth(182, 164, Math.abs(x));
  h += (WATER - 1.4 - h) * (1 - smooth(POND.r - 4, POND.r + 4, near(POND, x, z)));
  // Ridge round the arena, open to the south where the pass comes in.
  const ring = near(ARENA, x, z);
  const entrance = smooth(0.55, 0.8, (ARENA.z - z) / (ring || 1));
  h +=
    7 *
    smooth(ARENA.r + 1, ARENA.r + 7, ring) *
    smooth(ARENA.r + 18, ARENA.r + 9, ring) *
    (1 - entrance);
  return h;
}

const terrain = bakeTerrain(SIZE, SIZE, height);
const ground = (x: number, z: number) => heightAt(terrain, x, z);
const spawn = { x: CAMP.x, z: CAMP.z + 3 };

const at = (id: Prop['id'], x: number, z: number, rot: number, scale = 1): Prop => ({
  id,
  x,
  y: seat(ground, x, z, scale),
  z,
  rot,
  scale,
});

// Boulders round the arena: cover to break the mammoth's charge, gap left at the south entrance.
const boulders: Prop[] = [];
for (let i = 0; i < 11; i++) {
  const a = Math.PI * 0.25 + (i / 10) * Math.PI * 1.5; // skip the southern quarter
  const r = ARENA.r - 3 + (i % 2) * 4;
  const id = (['rock_1', 'rock_2', 'rock_3'] as const)[i % 3];
  const x = ARENA.x + Math.sin(a + Math.PI) * r;
  const z = ARENA.z + Math.cos(a + Math.PI) * r;
  const scale = 2.2 + (i % 3) * 0.4;
  boulders.push({ id, x, y: seat(ground, x, z, 1.3 * scale), z, rot: i * 1.7, scale });
}

/** A camp: tents round a fire, doorways facing it, seats by it. */
function campAt(fire: { x: number; z: number }, tents: [number, number, number][]) {
  const facing = (x: number, z: number) => Math.atan2(fire.x - x, fire.z - z);
  return [
    at('fire_pit', fire.x, fire.z, 0),
    ...tents.map(([dx, dz, s]) =>
      at('tent', fire.x + dx, fire.z + dz, facing(fire.x + dx, fire.z + dz), s),
    ),
    at('log', fire.x, fire.z - 2.2, 0, 0.5), // seats: quarter turns only (non-square colliders)
    at('log', fire.x - 2.4, fire.z, Math.PI / 2, 0.45),
    at('stump', fire.x + 2.3, fire.z + 0.6, 0.4),
  ];
}
const FIRES = [
  { x: CAMP.x, z: CAMP.z - 2 },
  { x: FORWARD.x + 3, z: FORWARD.z - 1 },
];
const camps: Prop[] = [
  ...campAt(FIRES[0], [
    [-6, -3, 1],
    [5.5, -5, 1],
    [-1, -9, 1.15],
  ]),
  at('drying_rack', 7, CAMP.z + 2, Math.PI / 2),
  ...campAt(FIRES[1], [[-4, 4, 0.9]]), // forward camp: one tent
  // Abandoned camp: a collapsed tent, a cold fire, someone's bones.
  at('tent', OLD_CAMP.x + 2, OLD_CAMP.z + 2, 1.9, 0.85),
  at('fire_pit', OLD_CAMP.x - 1, OLD_CAMP.z - 1, 0),
  at('bones', OLD_CAMP.x - 4, OLD_CAMP.z + 3, 0.6, 0.5),
];
// Signs of the mammoth: fallen trunks and bones grow thicker toward the pass on every route.
const signs: Prop[] = [
  at('log', -12, -20, 0),
  at('log', 30, -70, Math.PI / 2),
  at('bones', 6, 70, 2.4),
  at('bones', -34, 96, 1.2, 0.8),
  at('bones', 46, 84, 0.3, 0.8),
  at('bones', 8, 112, 2.9, 1.1),
  at('log', -14, 104, Math.PI / 2, 1.2),
  at('bones', DEN.x + 6, DEN.z - 5, 0.8), // gnawed remains outside the wolf den
  at('bones', DEN.x - 3, DEN.z + 4, 2.2, 0.6),
];
const colliders = [...boulders, ...camps, ...signs].map(colliderFor).filter((b) => b !== null);

const trail = (x: number, z: number) => distanceToPaths({ paths: trails }, x, z);
// Where the hunter can actually go: inside the mountains, south of the wall (or in the arena).
const playable = (x: number, z: number) =>
  Math.max(Math.abs(x), Math.abs(z)) < 160 && (z < 100 || near(ARENA, x, z) < ARENA.r - 2);
const dry = (x: number, z: number) => ground(x, z) > WATER + 0.3;
const open = (x: number, z: number) =>
  near(CAMP, x, z) > CAMP.r + 2 &&
  near(FORWARD, x, z) > FORWARD.r + 2 &&
  near(OLD_CAMP, x, z) > OLD_CAMP.r &&
  near(DEN, x, z) > DEN.r - 2 &&
  near(ARENA, x, z) > ARENA.r - 3 &&
  near(spawn, x, z) > 5;
// Woods: dense in the west, patchy elsewhere, thick against the mountains.
const forest = (x: number, z: number) =>
  fbm(x / 50, z / 50, 21) > 0.5 - smooth(-30, -110, x) * 0.2 ||
  Math.max(Math.abs(x), Math.abs(z)) > 160;

const { props, solids } = scatter(
  SIZE,
  ground,
  colliders,
  [
    {
      ids: ['tree_pine', 'tree_pine', 'tree_common'],
      count: 1900,
      gap: 2,
      where: (x, z) => forest(x, z) && dry(x, z) && open(x, z) && trail(x, z) > 4,
    },
    {
      ids: ['tree_dead'],
      count: 70,
      gap: 3,
      where: (x, z) => dry(x, z) && open(x, z) && trail(x, z) > 6,
    },
    {
      ids: ['rock_1', 'rock_2', 'rock_3'],
      count: 220,
      gap: 1.5,
      where: (x, z) => open(x, z) && trail(x, z) > 3,
    },
    {
      ids: ['bush'],
      count: 420,
      gap: 1,
      where: (x, z) => dry(x, z) && open(x, z) && trail(x, z) > 2,
    },
    {
      ids: ['fern', 'plant'],
      count: 900,
      gap: 0.6,
      where: (x, z) => forest(x, z) && dry(x, z) && open(x, z),
    },
    {
      ids: ['grass_tall', 'grass_short'],
      count: 1600, // taller clumps over the dense GPU grass (render/grass.ts)
      gap: 0.2,
      where: (x, z) => dry(x, z) && trail(x, z) > 1.2,
    },
    {
      ids: ['flowers'],
      count: 700,
      gap: 0.3,
      where: (x, z) => !forest(x, z) && dry(x, z) && trail(x, z) > 1.5,
    },
    { ids: ['clover'], count: 700, gap: 0.2, where: (x, z) => dry(x, z) && trail(x, z) > 1 },
    { ids: ['mushroom'], count: 300, gap: 0.2, where: (x, z) => forest(x, z) && dry(x, z) },
    {
      ids: ['stump'],
      count: 100,
      gap: 1,
      where: (x, z) => forest(x, z) && dry(x, z) && open(x, z),
    },
    { ids: ['pebble'], count: 500, gap: 0.2, where: (x, z) => trail(x, z) < 2 || !dry(x, z) },
    { ids: ['path_stone'], count: 450, gap: 0.4, where: (x, z) => trail(x, z) < 0.8 && dry(x, z) },
  ],
  2,
);

/** `n` spots in a ring-ish patch round `c` (radius 0.4r..r), golden-angle spaced so they don't bunch. */
const cluster = (c: { x: number; z: number }, n: number, r: number, seed: number) => {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996 + rand();
    const d = r * (0.4 + 0.6 * rand());
    return { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d };
  });
};

// Healing herbs: scattered everywhere, thick in the east grove and round the abandoned camp.
const herbs = scatter(
  SIZE,
  ground,
  [...colliders, ...solids],
  [
    {
      ids: ['herb'],
      count: 26,
      gap: 6,
      where: (x, z) => playable(x, z) && dry(x, z) && open(x, z) && trail(x, z) > 1,
    },
  ],
  7,
)
  .props.map((p) => ({ item: 'herb' as const, x: p.x, z: p.z }))
  // Clusters placed directly: random tries over the whole map rarely land in a small patch.
  .concat(
    [...cluster(GROVE, 8, 10, 3), ...cluster(OLD_CAMP, 4, 9, 4)].map((p) => ({
      item: 'herb' as const,
      ...p,
    })),
  );

// Mammoth footprints along the last stretch of every route: the closer to the pass, the fresher.
const tracks: { x: number; z: number; rot: number }[] = [];
{
  const rand = mulberry32(5);
  for (const line of trails.slice(0, 3))
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const rot = Math.atan2(b.x - a.x, b.z - a.z);
      for (let d = 0; d < len; d += 2.4) {
        const x = a.x + ((b.x - a.x) * d) / len;
        const z = a.z + ((b.z - a.z) * d) / len;
        if (near(PASS, x, z) > 70 || z > ARENA.z - ARENA.r) continue;
        const side = (tracks.length % 2 ? 1 : -1) * 0.7;
        tracks.push({
          x: x + Math.cos(rot) * side + (rand() - 0.5) * 0.3,
          z: z - Math.sin(rot) * side,
          rot,
        });
      }
    }
}

const loop = (cx: number, cz: number, r: number, n = 4) =>
  Array.from({ length: n }, (_, i) => ({
    x: cx + Math.cos((i / n) * Math.PI * 2) * r,
    z: cz + Math.sin((i / n) * Math.PI * 2) * r,
  }));

export const pineValley: MapData = {
  size: SIZE,
  spawn,
  boxes: [...colliders, ...solids],
  terrain,
  water: WATER,
  paths: trails,
  pickups: herbs,
  camps: FIRES,
  tracks,
  creatures: [
    // Foxes roam the middle and the south.
    { kind: 'fox', waypoints: loop(-30, -130, 14) },
    { kind: 'fox', waypoints: loop(40, -40, 18) },
    { kind: 'fox', waypoints: loop(-40, 30, 16) },
    { kind: 'fox', waypoints: loop(30, 40, 14) },
    // The deer herd grazes the east meadows by the pond, led by a stag; a second pair in the north.
    { kind: 'deer', waypoints: loop(86, -30, 10) },
    { kind: 'deer', waypoints: loop(92, -24, 12) },
    { kind: 'deer', waypoints: loop(80, -20, 9) },
    { kind: 'stag', waypoints: loop(90, -16, 14) },
    { kind: 'deer', waypoints: loop(30, 64, 10) },
    { kind: 'deer', waypoints: loop(24, 70, 8) },
    // Wolves: a pair on the west route, another by the den.
    { kind: 'wolf', waypoints: loop(-84, -10, 10) },
    { kind: 'wolf', waypoints: loop(-78, -4, 12) },
    { kind: 'wolf', waypoints: loop(-110, 50, 8) },
    { kind: 'wolf', waypoints: loop(-104, 56, 9) },
    // Mini-boss: the pack leader at its den in the north-west.
    { kind: 'wolf_alpha', waypoints: loop(DEN.x, DEN.z, 5, 3) },
    { kind: 'mammoth', waypoints: loop(ARENA.x, ARENA.z, 8) }, // grazes in its arena
  ],
  props: [...boulders, ...camps, ...signs, ...props],
};
