/**
 * Tribal War (team deathmatch) weapons. Every fighter carries all five; keys 1-5 switch.
 * Melee: a ray from the eye `reach` long during the active window (one hit per swing).
 * Thrown: a projectile with gravity; `ammo` per life (the spear can be picked up again where it lands).
 * Bow: hold to draw (damage and arrow speed grow with the draw), release to shoot.
 * Names: i18n `weapon.<id>`.
 */
export interface MeleeStats {
  reach: number; // metres from the eye
  damage: number;
  windup: number; // seconds before the hit window opens (the readable telegraph)
  active: number; // seconds the hit window stays open
  recover: number; // seconds before the next attack
  knockback?: number; // m/s pushed away from the attacker
}

export interface ThrowStats {
  damage: number;
  speed: number; // m/s along the aim
  windup: number;
  recover: number;
  ammo: number;
}

export interface BowStats {
  minDamage: number;
  maxDamage: number;
  minSpeed: number;
  maxSpeed: number;
  drawTime: number; // seconds to full draw
  recover: number;
  ammo: number;
}

export interface WeaponStats {
  melee?: MeleeStats; // left click
  throw?: ThrowStats; // right click (javelin: left click too)
  bow?: BowStats;
}

export const ARSENAL = {
  spear: {
    melee: { reach: 2.4, damage: 34, windup: 0.08, active: 0.12, recover: 0.35 },
    throw: { damage: 55, speed: 26, windup: 0.18, recover: 0.4, ammo: 1 },
  },
  axe: { melee: { reach: 1.9, damage: 62, windup: 0.34, active: 0.12, recover: 0.5 } },
  club: {
    melee: { reach: 1.7, damage: 24, windup: 0.08, active: 0.1, recover: 0.24, knockback: 7 },
  },
  javelin: { throw: { damage: 42, speed: 28, windup: 0.16, recover: 0.42, ammo: 5 } },
  bow: {
    bow: {
      minDamage: 18,
      maxDamage: 64,
      minSpeed: 22,
      maxSpeed: 58,
      drawTime: 0.9,
      recover: 0.35,
      ammo: 20,
    },
  },
} satisfies Record<string, WeaponStats>;

export type WeaponId = keyof typeof ARSENAL;
export const WEAPON_ORDER: WeaponId[] = ['spear', 'axe', 'club', 'javelin', 'bow']; // keys 1-5

export const FIGHTER = {
  hp: 100,
  radius: 0.4,
  height: 1.8, // body capsule from the feet up
  respawnTime: 3,
  gravity: 12, // projectiles: a bit above real for a readable arc
};
