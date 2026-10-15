import type { CreatureConfig } from '../config/creatures';
import type { MapData } from '../maps/testArena';

type XZ = { x: number; z: number };
const ATTACK_CONE = (70 * Math.PI) / 180; // an attack only lands on a player roughly in front
import { clampToArena, pushOutOfBox } from './collision';

/** `attack` = telegraphed wind-up before a bite; it stands still, so the player can read it and step away. */
export type CreatureMode = 'idle' | 'walk' | 'flee' | 'chase' | 'attack' | 'dead';

export interface CreatureState {
  x: number;
  z: number;
  heading: number; // same convention as player yaw: 0 faces +z
  speed: number;
  mode: CreatureMode;
  timer: number; // idle countdown, or attack wind-up countdown
  waypoint: number;
  hp: number;
  stagger: number; // seconds frozen after being hit
  cooldown: number; // seconds before it may attack again
  angry: boolean; // has been hurt and now fights back instead of fleeing
}

export function createCreature(waypoints: XZ[], cfg: CreatureConfig): CreatureState {
  const start = waypoints[0] ?? { x: 0, z: 0 };
  return {
    x: start.x,
    z: start.z,
    heading: 0,
    speed: 0,
    mode: 'idle',
    timer: 1,
    waypoint: 1,
    hp: cfg.hp,
    stagger: 0,
    cooldown: 0,
    angry: false,
  };
}

/** Applies damage; returns true if this hit killed it. */
export function damageCreature(c: CreatureState, cfg: CreatureConfig, damage: number) {
  if (c.mode === 'dead') return false;
  c.hp = Math.max(0, c.hp - damage);
  c.stagger = cfg.staggerTime;
  if (c.hp > 0) {
    c.angry = cfg.fightsBack;
    c.mode = c.angry ? 'chase' : 'flee';
    return false;
  }
  c.mode = 'dead';
  c.speed = 0;
  return true;
}

/**
 * Patrols its waypoints and flees the player; once hurt (if `fightsBack`) or provoked (within `aggroDistance`),
 * chases and attacks instead. The attack direction is locked when the wind-up starts, so a sidestep dodges it.
 * Returns the damage dealt to the player this step. Deterministic.
 */
export function stepCreature(
  c: CreatureState,
  cfg: CreatureConfig,
  player: XZ,
  waypoints: XZ[],
  map: MapData,
  dt: number,
): number {
  if (c.mode === 'dead') return 0;
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.stagger > 0) {
    c.stagger -= dt;
    c.speed = 0;
    return 0;
  }

  const playerDist = Math.hypot(player.x - c.x, player.z - c.z);
  const towardPlayer = Math.atan2(player.x - c.x, player.z - c.z);
  let desired = c.heading;
  let damage = 0;

  if (!c.angry && cfg.aggroDistance > 0 && playerDist < cfg.aggroDistance) c.angry = true;

  if (c.mode === 'attack') {
    c.timer -= dt;
    if (c.timer <= 0) {
      const off = Math.abs(
        Math.atan2(Math.sin(towardPlayer - c.heading), Math.cos(towardPlayer - c.heading)),
      );
      if (playerDist < cfg.attackRange + cfg.attackReachGrace && off < ATTACK_CONE)
        damage = cfg.attackDamage;
      c.mode = 'chase';
      c.cooldown = cfg.attackCooldown;
    }
  } else if (c.angry) {
    c.mode = 'chase';
    desired = towardPlayer;
    if (playerDist < cfg.attackRange && c.cooldown <= 0) {
      c.mode = 'attack';
      c.timer = cfg.attackWindup;
    }
  } else {
    if (playerDist < cfg.fleeDistance) c.mode = 'flee';
    else if (c.mode === 'flee' && playerDist > cfg.fleeDistance * 1.5) c.mode = 'walk';

    if (c.mode === 'flee') {
      desired = towardPlayer + Math.PI;
    } else if (c.mode === 'walk' && waypoints.length) {
      const wp = waypoints[c.waypoint % waypoints.length];
      if (Math.hypot(wp.x - c.x, wp.z - c.z) < 1) {
        c.mode = 'idle';
        c.timer = cfg.idleTime;
        c.waypoint++;
      } else {
        desired = Math.atan2(wp.x - c.x, wp.z - c.z);
      }
    } else if (c.mode === 'idle') {
      c.timer -= dt;
      if (c.timer <= 0) c.mode = 'walk';
    }
  }

  // Turn toward desired heading along the shorter arc, capped by turn rate.
  const diff = Math.atan2(Math.sin(desired - c.heading), Math.cos(desired - c.heading));
  const maxTurn = cfg.turnRate * dt;
  c.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

  const closeEnough = c.mode === 'chase' && playerDist < cfg.attackRange * 0.8; // don't run through the player
  c.speed =
    c.mode === 'flee' || (c.mode === 'chase' && !closeEnough)
      ? cfg.runSpeed
      : c.mode === 'walk'
        ? cfg.walkSpeed
        : 0;
  c.x += Math.sin(c.heading) * c.speed * dt;
  c.z += Math.cos(c.heading) * c.speed * dt;

  // shortcut: creature ignores box heights and treats all boxes as walls; fine for ground animals.
  for (const b of map.boxes) pushOutOfBox(c, cfg.radius, b);
  clampToArena(c, cfg.radius, map);
  return damage;
}
