import type { CreatureKind } from './creatures';

/** Everything the hunter can carry. Names: i18n `item.<id>`. */
export const ITEMS = ['herb', 'hide', 'bone', 'alpha_fang', 'poultice'] as const;
export type ItemId = (typeof ITEMS)[number];
export type Inventory = Record<ItemId, number>;

export const emptyInventory = (): Inventory =>
  Object.fromEntries(ITEMS.map((id) => [id, 0])) as Inventory;

export interface Recipe {
  cost: Partial<Inventory>;
  gives?: Partial<Inventory>;
  spearTier?: number; // sets the spear to this tier (needs the tier below)
}

/** Names: i18n `recipe.<id>`. Spear tiers multiply thrust and throw damage. */
export const RECIPES = {
  poultice: { cost: { herb: 2 }, gives: { poultice: 1 } },
  bone_tip: { cost: { bone: 3, hide: 1 }, spearTier: 1 },
  fang_tip: { cost: { alpha_fang: 1, bone: 2 }, spearTier: 2 },
} satisfies Record<string, Recipe>;
export type RecipeId = keyof typeof RECIPES;

export const SPEAR_TIERS = [1, 1.3, 1.6]; // stone, bone, wolf fang
export const POULTICE_HEAL = 40;
export const INTERACT_RADIUS = 2.2; // metres: pick a herb, skin a carcass

/** What skinning each kind of carcass gives. */
export const LOOT: Record<CreatureKind, Partial<Inventory>> = {
  fox: { hide: 1 },
  deer: { hide: 1, bone: 2 },
  stag: { hide: 2, bone: 3 },
  wolf: { hide: 1, bone: 1 },
  wolf_alpha: { alpha_fang: 1, hide: 2, bone: 1 },
  mammoth: {},
};
