import { ARSENAL, FIGHTER, type WeaponId, type WeaponStats } from '../config/arsenal';
import { mulberry32 } from '../maps/scatter';
import { eyeOf, type FighterCommand, type Match } from './tdm';

/** What a bot remembers between steps. */
export interface BotMind {
  rand: () => number;
  strafe: 1 | -1; // which way it circles its target
  strafeTimer: number;
  stuck: number; // seconds barely moving while trying to
  lastX: number;
  lastZ: number;
  aimError: number; // radians, re-rolled now and then: bots miss sometimes
  favourite: WeaponId; // close-range preference, for variety
  draw: number; // seconds the bow has been held
}

export function createMind(seed: number): BotMind {
  const rand = mulberry32(seed);
  return {
    rand,
    strafe: rand() < 0.5 ? 1 : -1,
    strafeTimer: 1 + rand() * 2,
    stuck: 0,
    lastX: 0,
    lastZ: 0,
    aimError: 0,
    favourite: (['spear', 'axe', 'club'] as const)[Math.floor(rand() * 3)],
    draw: 0,
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * One bot's command for this step: pick the nearest enemy, the weapon that suits the distance, close in or
 * keep range, circle, aim (leading and lobbing for projectiles) and attack. Same command a player sends.
 */
export function botCommand(m: Match, i: number, mind: BotMind, dt: number): FighterCommand {
  const me = m.fighters[i];
  const idle: FighterCommand = {
    moveX: 0,
    moveZ: 0,
    jump: false,
    sprint: false,
    yaw: me.yaw,
    pitch: me.pitch,
    attack: false,
    throw: false,
  };
  if (!me.alive) return idle;

  let target = -1;
  let best = Infinity;
  m.fighters.forEach((f, j) => {
    if (!f.alive || f.team === me.team) return;
    const d = Math.hypot(f.body.x - me.body.x, f.body.z - me.body.z);
    if (d < best) {
      best = d;
      target = j;
    }
  });
  if (target < 0) return idle;
  const t = m.fighters[target];
  const dist = best;

  // Weapon for the range: bow far, javelins middling, a melee weapon up close.
  const has = (w: WeaponId) => (ARSENAL[w] as WeaponStats).melee || me.ammo[w] > 0;
  let want: WeaponId = mind.favourite;
  if (dist > 16 && has('bow')) want = 'bow';
  else if (dist > 7 && has('javelin')) want = 'javelin';
  else if (dist > 7 && has('bow')) want = 'bow';
  const w: WeaponStats = ARSENAL[want];
  const range = w.melee ? w.melee.reach * 0.8 : 14;

  // Aim: at the chest, leading a moving target, lobbed for gravity on projectiles.
  const eye = eyeOf(me);
  const speed = w.bow ? w.bow.maxSpeed * 0.85 : (w.throw?.speed ?? 0);
  const flight = speed ? dist / speed : 0;
  const tx = t.body.x + t.body.vx * flight;
  const tz = t.body.z + t.body.vz * flight;
  const ty = t.body.y + FIGHTER.height * 0.6;
  const flat = Math.hypot(tx - eye.x, tz - eye.z);
  let pitch = -Math.atan2(ty - eye.y, flat);
  if (speed) pitch -= 0.5 * Math.asin(Math.min(1, (FIGHTER.gravity * flat) / (speed * speed)));
  mind.strafeTimer -= dt;
  if (mind.strafeTimer <= 0) {
    mind.strafe = mind.rand() < 0.5 ? 1 : -1;
    mind.strafeTimer = 1 + mind.rand() * 2;
    mind.aimError = (mind.rand() - 0.5) * 0.12;
  }
  const yaw = Math.atan2(tx - eye.x, tz - eye.z) + mind.aimError;

  // Move: close in to melee range (or keep a throwing distance), circle the target, get unstuck.
  const moved = Math.hypot(me.body.x - mind.lastX, me.body.z - mind.lastZ);
  mind.lastX = me.body.x;
  mind.lastZ = me.body.z;
  const tooFar = dist > range;
  const tooClose = !w.melee && dist < 6;
  mind.stuck = tooFar && moved < 1.5 * dt ? mind.stuck + dt : 0;
  const cmd: FighterCommand = {
    moveX: mind.strafe * (dist < 12 ? 0.8 : 0.3),
    moveZ: tooFar ? 1 : tooClose ? -1 : 0,
    jump: mind.stuck > 0.6,
    sprint: tooFar && dist > 10,
    yaw,
    pitch,
    attack: false,
    throw: false,
    slot: me.weapon !== want ? want : undefined,
  };
  if (mind.stuck > 1.2) {
    mind.strafe = mind.strafe === 1 ? -1 : 1;
    mind.stuck = 0;
  }

  // Attack once facing it.
  const facing = Math.abs(wrap(yaw - me.yaw)) < 0.25;
  if (me.weapon === want && me.phase === 'ready' && facing) {
    if (w.melee && dist < w.melee.reach * 0.95) cmd.attack = true;
    else if (w.throw && dist < 30) cmd.attack = true;
  }
  if (me.weapon === 'bow') {
    // Hold to draw; let go near full draw.
    const drawing = me.phase === 'drawing';
    mind.draw = drawing ? mind.draw + dt : 0;
    cmd.attackHeld =
      facing && dist < 45 && (!drawing || mind.draw < ARSENAL.bow.bow.drawTime * 0.9);
  }
  return cmd;
}
