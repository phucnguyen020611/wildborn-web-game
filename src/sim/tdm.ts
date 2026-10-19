import { ARSENAL, FIGHTER, WEAPON_ORDER, type WeaponId, type WeaponStats } from '../config/arsenal';
import { PLAYER } from '../config/player';
import type { MapData } from '../maps/types';
import { overlapsBox } from './collision';
import { segmentDistance, type Vec3 } from './geometry';
import { stepPlayer, type PlayerCommand, type PlayerState } from './player';
import { boxTop, groundAt } from './terrain';

/**
 * Tribal War: two teams, every fighter (the player and the bots alike) driven by the same command, so
 * a server can later run this unchanged with remote players. No rendering or DOM here.
 */
export interface FighterCommand extends PlayerCommand {
  attackHeld?: boolean; // left button down (the bow draws while held)
  slot?: WeaponId; // switch to this weapon
}

export type WeaponPhase = 'ready' | 'windup' | 'active' | 'recover' | 'throwing' | 'drawing';

export interface Fighter {
  team: 0 | 1;
  body: PlayerState;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  respawn: number; // seconds until back in (while dead)
  protect: number; // seconds of spawn protection left
  weapon: WeaponId;
  phase: WeaponPhase;
  t: number; // seconds in the current phase
  hitDone: boolean; // this swing already connected
  ammo: Record<WeaponId, number>;
  kills: number;
  deaths: number;
}

export interface Missile extends Vec3 {
  id: number; // stable across steps (the render keeps one model per missile)
  owner: number;
  weapon: WeaponId;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  flying: boolean;
  age: number; // seconds since it stopped (removed after a while)
}

export type MatchEvent =
  | { type: 'swing'; fighter: number; weapon: WeaponId }
  | { type: 'throw'; fighter: number; weapon: WeaponId }
  | { type: 'hit'; attacker: number; victim: number; damage: number; at: Vec3; killed: boolean }
  | { type: 'kill'; killer: number; victim: number; weapon: WeaponId }
  | { type: 'impact'; at: Vec3; weapon: WeaponId } // a missile stuck in the ground or a wall
  | { type: 'pickup'; fighter: number }
  | { type: 'respawn'; fighter: number }
  | { type: 'end'; winner: 0 | 1 | null };

export interface Match {
  fighters: Fighter[];
  missiles: Missile[];
  score: [number, number];
  time: number;
  timeLimit: number; // seconds
  killLimit: number;
  over: boolean;
  winner: 0 | 1 | null; // null: draw (or still playing)
  events: MatchEvent[];
  nextId: number;
}

const fullAmmo = () =>
  Object.fromEntries(
    WEAPON_ORDER.map((w) => {
      const s: WeaponStats = ARSENAL[w];
      return [w, s.throw?.ammo ?? s.bow?.ammo ?? 0];
    }),
  ) as Record<WeaponId, number>;

/** Team spawn points come from `map.teams` (one list per team). `perTeam` fighters each; fighter 0 is the player. */
export function createMatch(map: MapData, perTeam: number, timeLimit = 300, killLimit = 25): Match {
  const fighters: Fighter[] = [];
  for (let i = 0; i < perTeam * 2; i++) {
    const team = (i % 2) as 0 | 1;
    const f: Fighter = {
      team,
      body: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true },
      yaw: 0,
      pitch: 0,
      hp: FIGHTER.hp,
      alive: true,
      respawn: 0,
      protect: 0,
      weapon: 'spear',
      phase: 'ready',
      t: 0,
      hitDone: false,
      ammo: fullAmmo(),
      kills: 0,
      deaths: 0,
    };
    fighters.push(f);
    place(f, map, Math.floor(i / 2));
  }
  return {
    fighters,
    missiles: [],
    score: [0, 0],
    time: 0,
    timeLimit,
    killLimit,
    over: false,
    winner: null,
    events: [],
    nextId: 1,
  };
}

/** Puts a fighter at one of its team's spawns, facing the middle of the map. */
function place(f: Fighter, map: MapData, n: number) {
  const spots = map.teams![f.team];
  const s = spots[n % spots.length];
  Object.assign(f.body, {
    x: s.x,
    y: groundAt(map, s.x, s.z),
    z: s.z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
  });
  f.yaw = Math.atan2(-s.x, -s.z);
  f.pitch = 0;
}

export const eyeOf = (f: Fighter): Vec3 => ({
  x: f.body.x,
  y: f.body.y + PLAYER.eyeHeight,
  z: f.body.z,
});

export function aimOf(f: Fighter): Vec3 {
  const cp = Math.cos(f.pitch);
  return { x: Math.sin(f.yaw) * cp, y: -Math.sin(f.pitch), z: Math.cos(f.yaw) * cp };
}

/** Distance from segment a-b to fighter f's body (a vertical capsule). */
const toBody = (a: Vec3, b: Vec3, f: Fighter) =>
  segmentDistance(
    a,
    b,
    { x: f.body.x, y: f.body.y + FIGHTER.radius, z: f.body.z },
    { x: f.body.x, y: f.body.y + FIGHTER.height - FIGHTER.radius, z: f.body.z },
  );

/** Nearest living enemy of `owner` that segment a-b passes through, or -1. */
function firstEnemy(m: Match, owner: number, a: Vec3, b: Vec3, pad = 0) {
  let best = -1;
  let bestDist = Infinity;
  m.fighters.forEach((f, i) => {
    if (!f.alive || f.team === m.fighters[owner].team) return;
    if (toBody(a, b, f) > FIGHTER.radius + pad) return;
    const d = Math.hypot(f.body.x - a.x, f.body.z - a.z);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

function damage(m: Match, attacker: number, victim: number, amount: number, at: Vec3, push = 0) {
  const v = m.fighters[victim];
  if (v.protect > 0 || !v.alive) return;
  v.hp = Math.max(0, v.hp - amount);
  const killed = v.hp === 0;
  m.events.push({ type: 'hit', attacker, victim, damage: amount, at, killed });
  if (push) {
    const a = m.fighters[attacker].body;
    const d = Math.hypot(v.body.x - a.x, v.body.z - a.z) || 1;
    v.body.vx += ((v.body.x - a.x) / d) * push;
    v.body.vz += ((v.body.z - a.z) / d) * push;
    v.body.vy = Math.max(v.body.vy, 2.5);
    v.body.onGround = false;
  }
  if (!killed) return;
  v.alive = false;
  v.respawn = FIGHTER.respawnTime;
  v.deaths++;
  const k = m.fighters[attacker];
  k.kills++;
  m.score[k.team]++;
  m.events.push({ type: 'kill', killer: attacker, victim, weapon: k.weapon });
  if (m.score[k.team] >= m.killLimit) finish(m, k.team);
}

function finish(m: Match, winner: 0 | 1 | null) {
  m.over = true;
  m.winner = winner;
  m.events.push({ type: 'end', winner });
}

function launch(m: Match, i: number, weapon: WeaponId, speed: number, dmg: number) {
  const f = m.fighters[i];
  const eye = eyeOf(f);
  const dir = aimOf(f);
  m.missiles.push({
    id: m.nextId++,
    owner: i,
    weapon,
    x: eye.x + dir.x * 0.6,
    y: eye.y + dir.y * 0.6,
    z: eye.z + dir.z * 0.6,
    vx: dir.x * speed,
    vy: dir.y * speed,
    vz: dir.z * speed,
    damage: dmg,
    flying: true,
    age: 0,
  });
  m.events.push({ type: 'throw', fighter: i, weapon });
}

/** One fixed step of the whole match. `cmds[i]` drives fighter i (ignored while dead). */
export function stepMatch(m: Match, cmds: FighterCommand[], map: MapData, dt: number) {
  m.events = [];
  if (m.over) return;
  m.time += dt;
  if (m.time >= m.timeLimit)
    return finish(m, m.score[0] === m.score[1] ? null : m.score[0] > m.score[1] ? 0 : 1);

  m.fighters.forEach((f, i) => {
    if (!f.alive) {
      f.respawn -= dt;
      if (f.respawn <= 0) {
        Object.assign(f, {
          alive: true,
          hp: FIGHTER.hp,
          protect: 1.5,
          ammo: fullAmmo(),
          phase: 'ready',
          t: 0,
        });
        place(f, map, i + m.fighters[i].deaths);
        m.events.push({ type: 'respawn', fighter: i });
      }
      return;
    }
    const cmd = cmds[i];
    f.yaw = cmd.yaw;
    f.pitch = cmd.pitch;
    f.protect = Math.max(0, f.protect - dt);
    stepPlayer(f.body, cmd, map, dt);
    stepWeapon(m, i, cmd, dt);
    // A thrown spear lying near its owner is picked back up.
    m.missiles = m.missiles.filter((s) => {
      const mine = !s.flying && s.owner === i && s.weapon === 'spear';
      if (!mine || Math.hypot(s.x - f.body.x, s.z - f.body.z) > 1.3) return true;
      f.ammo.spear = 1;
      m.events.push({ type: 'pickup', fighter: i });
      return false;
    });
  });

  for (const s of m.missiles) stepMissile(m, map, s, dt);
  m.missiles = m.missiles.filter((s) => s.flying || s.age < (s.weapon === 'spear' ? 30 : 8));
}

function stepWeapon(m: Match, i: number, cmd: FighterCommand, dt: number) {
  const f = m.fighters[i];
  const w: WeaponStats = ARSENAL[f.weapon];
  f.t += dt;
  const go = (phase: WeaponPhase) => {
    f.phase = phase;
    f.t = 0;
  };
  switch (f.phase) {
    case 'ready':
      if (cmd.slot && cmd.slot !== f.weapon) {
        f.weapon = cmd.slot;
        go('recover'); // a short beat to bring it up
        f.t = -0.1;
      } else if (w.melee && cmd.attack) {
        go('windup');
        f.hitDone = false;
        m.events.push({ type: 'swing', fighter: i, weapon: f.weapon });
      } else if (w.throw && f.ammo[f.weapon] > 0 && (cmd.throw || (!w.melee && cmd.attack))) {
        go('throwing');
      } else if (w.bow && f.ammo.bow > 0 && cmd.attackHeld) {
        go('drawing');
      }
      break;
    case 'windup':
      if (f.t >= w.melee!.windup) go('active');
      break;
    case 'active': {
      if (!f.hitDone) {
        const eye = eyeOf(f);
        const dir = aimOf(f);
        const r = w.melee!.reach;
        const tip = { x: eye.x + dir.x * r, y: eye.y + dir.y * r, z: eye.z + dir.z * r };
        const v = firstEnemy(m, i, eye, tip, 0.1);
        if (v >= 0) {
          f.hitDone = true;
          damage(m, i, v, w.melee!.damage, tip, w.melee!.knockback);
        }
      }
      if (f.t >= w.melee!.active) go('recover');
      break;
    }
    case 'throwing':
      if (f.t >= w.throw!.windup) {
        f.ammo[f.weapon]--;
        launch(m, i, f.weapon, w.throw!.speed, w.throw!.damage);
        go('recover');
      }
      break;
    case 'drawing':
      if (!cmd.attackHeld) {
        const b = w.bow!;
        const k = Math.min(1, f.t / b.drawTime);
        f.ammo.bow--;
        launch(
          m,
          i,
          'bow',
          b.minSpeed + (b.maxSpeed - b.minSpeed) * k,
          b.minDamage + (b.maxDamage - b.minDamage) * k,
        );
        go('recover');
      }
      break;
    case 'recover': {
      const rec = w.melee?.recover ?? w.throw?.recover ?? w.bow?.recover ?? 0.3;
      if (f.t >= rec) go('ready');
      break;
    }
  }
}

function stepMissile(m: Match, map: MapData, s: Missile, dt: number) {
  if (!s.flying) {
    s.age += dt;
    return;
  }
  const prev = { x: s.x, y: s.y, z: s.z };
  s.vy -= FIGHTER.gravity * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  const v = firstEnemy(m, s.owner, prev, s, 0.05);
  if (v >= 0) {
    damage(m, s.owner, v, s.damage, { x: s.x, y: s.y, z: s.z });
    s.flying = false;
    if (s.weapon !== 'spear')
      s.age = 99; // arrows and javelins break on a body
    else Object.assign(s, { y: groundAt(map, s.x, s.z) });
    return;
  }
  const half = map.size / 2;
  const wall = map.boxes.some(
    (b) => s.y < boxTop(b) && s.y > (b.y ?? 0) && overlapsBox(s, 0.05, b),
  );
  const ground = groundAt(map, s.x, s.z);
  if (wall || s.y <= ground || Math.abs(s.x) > half || Math.abs(s.z) > half) {
    if (wall) Object.assign(s, prev);
    if (s.weapon === 'spear')
      s.y = groundAt(map, s.x, s.z); // drops where it can be picked up
    else s.y = Math.max(s.y, ground);
    s.flying = false;
    m.events.push({ type: 'impact', at: { x: s.x, y: s.y, z: s.z }, weapon: s.weapon });
  }
}
