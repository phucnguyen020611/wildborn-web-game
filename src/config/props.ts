/**
 * Static environment models, grouped in kit files so they share textures and load in one request:
 * `forest` = src/assets/environment/env_kit_forest.glb (Quaternius MegaKit, `npm run import-megakit`),
 * `camp` = src/assets/props/env_kit_camp.glb (tools/blender/make_camp.py). `nodes` are node names in
 * the kit; a placed prop picks one as its variant. Units: meters.
 */
export interface PropConfig {
  nodes: string[];
  kit?: 'forest' | 'camp'; // default forest
  // Footprint offset from the model origin by (cx, cz) in game space (glTF x is mirrored on load).
  // Keep w = d for props placed at any angle; w != d only stays right for quarter turns. Omit = walk-through.
  collider?: { w: number; d: number; h: number; cx?: number; cz?: number };
  castsShadow?: boolean; // keep to a few big shapes: every caster is drawn again into the shadow map
  scale?: number; // base size multiplier when scattered (the kit models some plants oversized)
  drawDistance?: number; // meters; small plants are hidden beyond this (fog mostly covers the pop)
}

const trunk = { w: 0.6, d: 0.6, h: 6 };
const near = 45; // draw distance for ground cover
const far = 110; // trees: beyond this the fog has all but hidden them (exp2 fog ~85% at 110 m)
const range = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}_${i + 1}`);

export const PROPS = {
  tree_common: {
    nodes: range('CommonTree', 5),
    collider: trunk,
    drawDistance: far,
    castsShadow: true,
  },
  tree_pine: { nodes: range('Pine', 5), collider: trunk, drawDistance: far, castsShadow: true },
  tree_dead: {
    nodes: range('DeadTree', 3),
    collider: { ...trunk, w: 0.8, d: 0.8 },
    drawDistance: far,
    castsShadow: true,
  },
  // One id per rock: footprints ~80% of the model bounds, centres measured from the glTF bounding boxes.
  rock_1: {
    nodes: ['Rock_Medium_1'],
    collider: { w: 2.4, d: 2.4, h: 1.9, cx: 0.12, cz: 0.35 },
    castsShadow: true,
  },
  rock_2: {
    nodes: ['Rock_Medium_2'],
    collider: { w: 2.2, d: 2.2, h: 1.8, cx: 0.19, cz: 0.08 },
    castsShadow: true,
  },
  rock_3: {
    nodes: ['Rock_Medium_3'],
    collider: { w: 2.6, d: 2.6, h: 1.9, cx: 0.11, cz: 0.85 },
    castsShadow: true,
  },
  bush: { nodes: ['Bush_Common_Flowers'], drawDistance: 70 },
  fern: { nodes: ['Fern_1'], drawDistance: near },
  plant: { nodes: ['Plant_1', 'Plant_7'], drawDistance: near },
  grass_tall: { nodes: ['Grass_Common_Tall', 'Grass_Wispy_Tall'], scale: 0.6, drawDistance: near }, // 1.6-1.8 m -> ~1 m
  grass_short: {
    nodes: ['Grass_Common_Short', 'Grass_Wispy_Short'],
    scale: 0.6,
    drawDistance: near,
  },
  flowers: { nodes: ['Flower_3_Group', 'Flower_4_Group'], scale: 0.35, drawDistance: near }, // 2-2.4 m -> ~0.8 m
  clover: { nodes: range('Clover', 2), scale: 0.4, drawDistance: near },
  mushroom: { nodes: ['Mushroom_Common'], drawDistance: near }, // Laetiporus grows on trunks: odd on the ground
  pebble: { nodes: range('Pebble_Round', 5), drawDistance: near },
  path_stone: { nodes: range('RockPath_Round_Small', 3), drawDistance: near },
  // Camp kit (hand-placed).
  tent: { nodes: ['Tent'], kit: 'camp', collider: { w: 3, d: 3, h: 3 }, castsShadow: true },
  fire_pit: { nodes: ['FirePit'], kit: 'camp' },
  log: { nodes: ['Log'], kit: 'camp', collider: { w: 4.8, d: 0.7, h: 0.65 }, castsShadow: true },
  stump: {
    nodes: ['Stump'],
    kit: 'camp',
    collider: { w: 0.8, d: 0.8, h: 0.55 },
    castsShadow: true,
  },
  bones: { nodes: ['Bones'], kit: 'camp', collider: { w: 2, d: 2.6, h: 1.2 }, castsShadow: true },
  drying_rack: { nodes: ['DryingRack'], kit: 'camp', collider: { w: 2.6, d: 0.8, h: 1.8 } },
} satisfies Record<string, PropConfig>;

export type PropId = keyof typeof PROPS;
