/** Static environment models (files in src/assets/environment/<id>.glb). Units: meters. */
export interface PropConfig {
  // Square-ish footprint (w = d keeps it valid at any rotation), offset from the model origin by (cx, cz)
  // in game space (glTF x is mirrored on load). Omit = walk-through.
  collider?: { w: number; d: number; h: number; cx?: number; cz?: number };
  castsShadow?: boolean; // keep to a few big shapes: every caster is drawn again into the shadow map
  scale?: number; // base size multiplier when scattered (the kit models some plants oversized)
}

export const PROPS = {
  env_tree_common_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  env_tree_pine_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  env_tree_dead_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  // Footprints ~80% of the model bounds; centres measured from the glTF bounding boxes.
  env_rock_medium_1: {
    collider: { w: 2.4, d: 2.4, h: 1.9, cx: 0.12, cz: 0.35 },
    castsShadow: true,
  },
  env_rock_medium_2: {
    collider: { w: 2.2, d: 2.2, h: 1.8, cx: 0.19, cz: 0.08 },
    castsShadow: true,
  },
  env_rock_medium_3: {
    collider: { w: 2.6, d: 2.6, h: 1.9, cx: 0.11, cz: 0.85 },
    castsShadow: true,
  },
  env_bush_flowers: {},
  env_fern_1: {},
  env_grass_tall: { scale: 0.6 }, // 1.8 m -> ~1.1 m
  env_flowers_1: { scale: 0.35 }, // 2 m -> ~0.7 m
  env_flowers_2: { scale: 0.35 },
  env_mushroom: {},
  env_clover: { scale: 0.4 },
  env_pebble_1: {},
  env_pebble_2: {},
} satisfies Record<string, PropConfig>;

export type PropId = keyof typeof PROPS;
