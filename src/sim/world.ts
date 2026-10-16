import { PLAYER } from '../config/player';
import { CREATURES, type CreatureKind } from '../config/creatures';
import { WEAPONS } from '../config/weapons';
import type { MapData } from '../maps/types';
import { overlapsBox } from './collision';
import { boxTop, groundAt } from './terrain';
import { createCreature, damageCreature, stepCreature, type CreatureState } from './creature';
import { segmentDistance, type Vec3 } from './geometry';
import { createPlayer, stepPlayer, type PlayerCommand, type PlayerState } from './player';
import { createSpear, stepSpear, type SpearState } from './spear';

export type GameEvent =
  | { type: 'thrust' }
  | { type: 'throw' }
  | { type: 'hit'; creature: number; damage: number; killed: boolean; at: Vec3 } // creature = index in world.creatures
  | { type: 'stick'; at: Vec3 } // thrown spear landed
  | { type: 'pickup' }
  | { type: 'hurt'; damage: number } // player took damage
  | { type: 'end'; outcome: 'won' | 'lost' };

/** A thrown spear: flying, then lying on the ground until picked up. */
export interface Projectile extends Vec3 {
  vx: number;
  vy: number;
  vz: number; // last velocity; kept after landing so the spear keeps its angle
  flying: boolean;
}

export interface Creature {
  kind: CreatureKind;
  state: CreatureState;
}

/** Everything the simulation owns. Render reads it; only stepWorld writes it. */
export interface World {
  player: PlayerState;
  spear: SpearState;
  thrown: Projectile | null;
  creatures: Creature[]; // same order as map.creatures
  target: number; // index of the creature whose death wins the hunt (the boss, else the first)
  playerHp: number;
  outcome: 'playing' | 'won' | 'lost'; // the hunt ends when the target dies or the player falls
  time: number; // seconds of play, for the end screen
  attacks: number; // thrusts + throws started
  hits: number; // attacks that connected
  hitstop: number; // seconds left of the freeze after a hit
  events: GameEvent[]; // produced by the last step, for presentation (sound, shake, hit marker)
}

export function createWorld(map: MapData): World {
  const creatures = map.creatures.map((sp) => {
    const state = createCreature(sp.waypoints, CREATURES[sp.kind]);
    state.y = groundAt(map, state.x, state.z);
    return { kind: sp.kind, state };
  });
  return {
    player: createPlayer(map),
    spear: createSpear(),
    thrown: null,
    creatures,
    target: Math.max(
      0,
      creatures.findIndex((c) => CREATURES[c.kind].boss),
    ),
    playerHp: PLAYER.hp,
    outcome: 'playing',
    time: 0,
    attacks: 0,
    hits: 0,
    hitstop: 0,
    events: [],
  };
}

const cfg = WEAPONS.spear;

export function stepWorld(w: World, cmd: PlayerCommand, map: MapData, dt: number) {
  w.events = [];
  if (w.outcome !== 'playing') return;
  w.time += dt;
  if (w.hitstop > 0) {
    w.hitstop -= dt;
    if (cmd.attack) w.spear.buffered = cfg.buffer; // don't drop presses made during the freeze
    return;
  }

  stepPlayer(w.player, cmd, map, dt);
  const before = w.spear.phase;
  const released = stepSpear(w.spear, cfg, cmd.attack, cmd.throw, dt);
  if (before !== 'windup' && w.spear.phase === 'windup') {
    w.attacks++;
    w.events.push({ type: 'thrust' });
  }
  if (before !== 'throw' && w.spear.phase === 'throw') {
    w.attacks++;
    w.events.push({ type: 'throw' });
  }

  const eye = { x: w.player.x, y: w.player.y + PLAYER.eyeHeight, z: w.player.z };
  const dir = viewDir(cmd);

  if (w.spear.phase === 'active' && !w.spear.hit) {
    // shortcut: ignores walls between player and target; add an occlusion check when levels get cover.
    const tip = add(eye, dir, cfg.reach);
    const i = firstHit(w, eye, tip);
    if (i >= 0) {
      w.spear.hit = true;
      hit(w, i, cfg.damage, tip);
    }
  }

  if (released) {
    const start = add(eye, dir, 0.5);
    w.thrown = {
      ...start,
      vx: dir.x * cfg.throwSpeed,
      vy: dir.y * cfg.throwSpeed,
      vz: dir.z * cfg.throwSpeed,
      flying: true,
    };
  }
  if (w.thrown?.flying) stepProjectile(w, w.thrown, map, dt);
  else if (
    w.thrown &&
    Math.hypot(w.thrown.x - w.player.x, w.thrown.z - w.player.z) < cfg.pickupRadius
  ) {
    w.thrown = null;
    w.spear.held = true;
    w.events.push({ type: 'pickup' });
  }

  w.creatures.forEach((c, i) => {
    const dmg = stepCreature(
      c.state,
      CREATURES[c.kind],
      w.player,
      map.creatures[i].waypoints,
      map,
      dt,
    );
    if (dmg <= 0 || w.outcome !== 'playing') return;
    w.playerHp = Math.max(0, w.playerHp - dmg);
    w.events.push({ type: 'hurt', damage: dmg });
    if (w.playerHp === 0) end(w, 'lost');
  });
}

function end(w: World, outcome: 'won' | 'lost') {
  w.outcome = outcome;
  w.events.push({ type: 'end', outcome });
}

function stepProjectile(w: World, s: Projectile, map: MapData, dt: number) {
  const prev = { x: s.x, y: s.y, z: s.z };
  s.vy -= cfg.gravity * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;

  const i = firstHit(w, prev, s);
  if (i >= 0) {
    hit(w, i, cfg.throwDamage, { x: s.x, y: s.y, z: s.z });
    land(w, s, s, map);
    return;
  }
  // Boxes, trunks and arena edge all just drop the spear at their base, so it is always reachable.
  const half = map.size / 2;
  const blocked =
    Math.abs(s.x) > half ||
    Math.abs(s.z) > half ||
    map.boxes.some((b) => s.y < boxTop(b) && overlapsBox(s, 0.05, b));
  if (blocked) land(w, s, prev, map);
  else if (s.y <= groundAt(map, s.x, s.z)) land(w, s, s, map);
}

function land(w: World, s: Projectile, at: Vec3, map: MapData) {
  const half = map.size / 2 - 0.5; // keep it inside the arena so it can be picked up
  s.x = Math.max(-half, Math.min(half, at.x));
  s.z = Math.max(-half, Math.min(half, at.z));
  s.y = groundAt(map, s.x, s.z);
  s.flying = false;
  w.events.push({ type: 'stick', at: { x: s.x, y: s.y, z: s.z } });
}

function hit(w: World, i: number, damage: number, at: Vec3) {
  const c = w.creatures[i];
  const killed = damageCreature(c.state, CREATURES[c.kind], damage);
  w.hits++;
  w.events.push({ type: 'hit', creature: i, damage, killed, at });
  w.hitstop = cfg.hitstop;
  if (killed && i === w.target) end(w, 'won');
}

/** Index of the creature nearest to `a` that segment a-b hits, or -1. */
function firstHit(w: World, a: Vec3, b: Vec3) {
  let best = -1;
  let bestDist = Infinity;
  w.creatures.forEach((c, i) => {
    const d = Math.hypot(c.state.x - a.x, c.state.z - a.z);
    if (d < bestDist && hitsCreature(a, b, c)) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** Segment a-b vs the creature's body capsule (along its heading). */
function hitsCreature(a: Vec3, b: Vec3, { kind, state: c }: Creature) {
  if (c.mode === 'dead') return false;
  const hb = CREATURES[kind].hitbox;
  const hx = (Math.sin(c.heading) * hb.length) / 2;
  const hz = (Math.cos(c.heading) * hb.length) / 2;
  const front = { x: c.x + hx, y: c.y + hb.height, z: c.z + hz };
  const back = { x: c.x - hx, y: c.y + hb.height, z: c.z - hz };
  return segmentDistance(a, b, back, front) < hb.radius;
}

/** Unit view vector; pitch positive looks down. */
function viewDir(cmd: PlayerCommand): Vec3 {
  const cp = Math.cos(cmd.pitch);
  return { x: Math.sin(cmd.yaw) * cp, y: -Math.sin(cmd.pitch), z: Math.cos(cmd.yaw) * cp };
}

const add = (p: Vec3, d: Vec3, k: number): Vec3 => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
  z: p.z + d.z * k,
});
