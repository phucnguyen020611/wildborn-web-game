export interface MeleeConfig {
  reach: number; // meters from the eye
  damage: number;
  windup: number; // seconds before the hit window opens
  active: number; // seconds the hit window stays open
  recover: number; // seconds before the next attack can start
  buffer: number; // an attack pressed this long before "ready" still fires
  hitstop: number; // seconds the world freezes on a hit
}

export interface ThrowConfig {
  throwWindup: number; // seconds from press to release
  throwSpeed: number; // m/s along the view direction
  throwDamage: number;
  gravity: number; // m/s², a bit above real for a snappier arc
  pickupRadius: number; // walk this close to a landed spear to pick it up
}

export const WEAPONS = {
  spear: {
    reach: 2.4,
    damage: 34,
    windup: 0.08,
    active: 0.12,
    recover: 0.35,
    buffer: 0.2,
    hitstop: 0.06,
    throwWindup: 0.18,
    throwSpeed: 24,
    throwDamage: 50,
    gravity: 12,
    pickupRadius: 1.3,
  },
} satisfies Record<string, MeleeConfig & ThrowConfig>;
