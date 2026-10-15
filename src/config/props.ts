/** Static environment models (files in src/assets/environment/<id>.glb). Units: meters. */
export interface PropConfig {
  collider?: { w: number; d: number; h: number }; // box footprint around the origin; omit = walk-through
}

export const PROPS = {
  env_tree_common_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  env_tree_pine_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  env_tree_dead_1: { collider: { w: 0.6, d: 0.6, h: 6 } },
  env_rock_medium_1: { collider: { w: 2.4, d: 2.4, h: 1.9 } },
  env_rock_medium_2: { collider: { w: 2.2, d: 2.2, h: 1.8 } },
  env_bush_flowers: {},
  env_fern_1: {},
  env_grass_tall: {},
} satisfies Record<string, PropConfig>;

export type PropId = keyof typeof PROPS;
