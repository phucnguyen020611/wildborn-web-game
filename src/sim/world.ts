import { PLAYER } from '../config/player';
import { CREATURES, type CreatureConfig, type CreatureKind } from '../config/creatures';
import { WEAPONS } from '../config/weapons';
import {
  emptyInventory,
  INTERACT_RADIUS,
  LOOT,
  POULTICE_HEAL,
  RECIPES,
  SPEAR_TIERS,
  type Inventory,
  type ItemId,
  type RecipeId,
} from '../config/items';
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
  | { type: 'strike'; at: Vec3; ground: boolean } // thrust stopped by the ground or a solid prop
  | { type: 'pickup' }
  | { type: 'hurt'; damage: number } // player took damage
  | { type: 'loot'; items: Partial<Inventory>; at: Vec3 } // picked a herb or skinned a carcass
  | { type: 'heal'; amount: number }
  | { type: 'rest'; camp: number } // rested at a camp fire: healed, saved, wakes here after falling
  | { type: 'respawn'; camp: number } // fell and woke at the last camp
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
  looted: boolean; // carcass already skinned
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
  inventory: Inventory;
  spearTier: number; // index into SPEAR_TIERS
  taken: boolean[]; // map.pickups already picked up
  lastHit: number; // creature most recently hit (-1 none): the HUD shows its health
  camp: number; // index into map.camps where the hunter wakes after falling
}

export function createWorld(map: MapData): World {
  const creatures = map.creatures.map((sp) => {
    const state = createCreature(sp.waypoints, CREATURES[sp.kind]);
    state.y = groundAt(map, state.x, state.z);
    return { kind: sp.kind, state, looted: false };
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
    inventory: emptyInventory(),
    spearTier: 0,
    taken: (map.pickups ?? []).map(() => false),
    lastHit: -1,
    camp: 0,
  };
}

/** What E would act on right now: the nearest herb or unskinned carcass in reach, or null. */
type Interactable = { kind: 'pickup' | 'carcass' | 'camp'; index: number; dist: number };
export function nearestInteractable(w: World, map: MapData) {
  let best: Interactable | null = null;
  const consider = (kind: Interactable['kind'], index: number, x: number, z: number, reach = 0) => {
    const dist = Math.hypot(x - w.player.x, z - w.player.z) - reach;
    if (dist < INTERACT_RADIUS && (!best || dist < best.dist)) best = { kind, index, dist };
  };
  (map.camps ?? []).forEach((f, i) => consider('camp', i, f.x, f.z, 1)); // the fire pit is ~1 m across
  (map.pickups ?? []).forEach((p, i) => !w.taken[i] && consider('pickup', i, p.x, p.z));
  w.creatures.forEach(
    (c, i) =>
      c.state.mode === 'dead' &&
      !c.looted &&
      Object.keys(LOOT[c.kind]).length > 0 &&
      consider('carcass', i, c.state.x, c.state.z),
  );
  return best as Interactable | null;
}

function addItems(w: World, items: Partial<Inventory>) {
  for (const [id, n] of Object.entries(items)) w.inventory[id as ItemId] += n;
}

function interact(w: World, map: MapData) {
  const t = nearestInteractable(w, map);
  if (!t) return;
  if (t.kind === 'camp') {
    w.playerHp = PLAYER.hp;
    w.camp = t.index;
    w.events.push({ type: 'rest', camp: t.index });
    return;
  }
  let items: Partial<Inventory>;
  let at: Vec3;
  if (t.kind === 'pickup') {
    const p = map.pickups![t.index];
    w.taken[t.index] = true;
    items = { [p.item]: 1 };
    at = { x: p.x, y: groundAt(map, p.x, p.z), z: p.z };
  } else {
    const c = w.creatures[t.index];
    c.looted = true;
    items = LOOT[c.kind];
    at = { x: c.state.x, y: c.state.y, z: c.state.z };
  }
  addItems(w, items);
  w.events.push({ type: 'loot', items, at });
}

/** Whether the hunter has the materials (and the spear tier below) for a recipe. */
export function canCraft(w: World, id: RecipeId) {
  const r = RECIPES[id];
  const tierOk = !('spearTier' in r) || w.spearTier === r.spearTier - 1;
  return tierOk && Object.entries(r.cost).every(([item, n]) => w.inventory[item as ItemId] >= n);
}

/** Crafts from the inventory (called by the UI while paused). Returns false if it can't. */
export function craft(w: World, id: RecipeId) {
  if (!canCraft(w, id)) return false;
  const r = RECIPES[id];
  for (const [item, n] of Object.entries(r.cost)) w.inventory[item as ItemId] -= n;
  if ('gives' in r) addItems(w, r.gives);
  if ('spearTier' in r) w.spearTier = r.spearTier;
  return true;
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

  const impact = stepPlayer(w.player, cmd, map, dt);
  if (impact > PLAYER.safeFallSpeed)
    hurtPlayer(w, map, (impact - PLAYER.safeFallSpeed) * PLAYER.fallDamage);
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

  if (cmd.interact) interact(w, map);
  if (cmd.heal && w.inventory.poultice > 0 && w.playerHp < PLAYER.hp) {
    const amount = Math.min(POULTICE_HEAL, PLAYER.hp - w.playerHp);
    w.inventory.poultice--;
    w.playerHp += amount;
    w.events.push({ type: 'heal', amount });
  }

  const eye = { x: w.player.x, y: w.player.y + PLAYER.eyeHeight, z: w.player.z };
  const dir = viewDir(cmd);

  if (w.spear.phase === 'active' && !w.spear.hit) {
    // shortcut: ignores walls between player and target; add an occlusion check when levels get cover.
    const tip = add(eye, dir, cfg.reach);
    const i = firstHit(w, eye, tip);
    if (i >= 0) {
      w.spear.hit = true;
      hit(w, i, cfg.damage * SPEAR_TIERS[w.spearTier], tip);
    } else {
      const solid = firstSolid(map, eye, dir, cfg.reach);
      if (solid) {
        w.spear.hit = true;
        w.events.push({ type: 'strike', ...solid });
      }
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
    if (dmg > 0) hurtPlayer(w, map, dmg);
  });
}

function hurtPlayer(w: World, map: MapData, dmg: number) {
  if (w.outcome !== 'playing') return;
  w.playerHp = Math.max(0, w.playerHp - dmg);
  w.events.push({ type: 'hurt', damage: dmg });
  if (w.playerHp > 0) return;
  if (map.camps?.length) respawn(w, map);
  else end(w, 'lost');
}

/** Puts the hunter beside camp fire `i`, facing it is up to the camera. */
export function placeAtCamp(w: World, map: MapData, i: number) {
  const f = map.camps![i];
  const x = f.x;
  const z = f.z + 2.5;
  Object.assign(w.player, { x, y: groundAt(map, x, z), z, vx: 0, vy: 0, vz: 0, onGround: true });
}

/**
 * Falling on a map with camps: wake at the last camp with full health and everything carried. Kills
 * stay dead; the bosses heal and go home, and every animal forgets its anger.
 */
function respawn(w: World, map: MapData) {
  placeAtCamp(w, map, w.camp);
  w.playerHp = PLAYER.hp;
  w.thrown = null;
  Object.assign(w.spear, createSpear());
  w.lastHit = -1;
  w.creatures.forEach((c, i) => {
    if (c.state.mode === 'dead') return;
    const cfg: CreatureConfig = CREATURES[c.kind];
    if (cfg.boss || cfg.miniBoss) {
      Object.assign(c.state, createCreature(map.creatures[i].waypoints, cfg));
      c.state.y = groundAt(map, c.state.x, c.state.z);
    } else Object.assign(c.state, { angry: false, mode: 'walk', cooldown: 0, stagger: 0 });
  });
  w.events.push({ type: 'respawn', camp: w.camp });
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
    hit(w, i, cfg.throwDamage * SPEAR_TIERS[w.spearTier], { x: s.x, y: s.y, z: s.z });
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
  w.lastHit = i;
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

/** Where a thrust from `eye` along `dir` first meets the ground or a box within `reach` (10 cm steps), or null. */
function firstSolid(map: MapData, eye: Vec3, dir: Vec3, reach: number) {
  for (let d = 0.3; d <= reach + 1e-6; d += 0.1) {
    const p = add(eye, dir, d);
    const g = groundAt(map, p.x, p.z);
    if (p.y <= g) return { at: { x: p.x, y: g, z: p.z }, ground: true };
    if (map.boxes.some((b) => p.y < boxTop(b) && p.y >= (b.y ?? 0) && overlapsBox(p, 0.02, b)))
      return { at: p, ground: false };
  }
  return null;
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
