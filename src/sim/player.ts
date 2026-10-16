import { PLAYER } from '../config/player';
import type { MapData } from '../maps/types';
import { clampToArena, overlapsBox, pushOutOfBox } from './collision';
import { boxTop, groundAt } from './terrain';

/** One simulation step of player intent. Absolute yaw (radians) so it can later be sent to a server as-is. */
export interface PlayerCommand {
  moveX: number; // -1 left .. 1 right
  moveZ: number; // -1 back .. 1 forward
  jump: boolean;
  sprint: boolean;
  yaw: number;
  pitch: number; // radians, positive looks down (Babylon convention)
  attack: boolean; // attack pressed since the last step
  throw: boolean; // throw pressed since the last step
}

/** Feet position (world y, the terrain is not flat). */
export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
}

export function createPlayer(map: MapData): PlayerState {
  return {
    x: map.spawn.x,
    y: groundAt(map, map.spawn.x, map.spawn.z),
    z: map.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
  };
}

/** Mutates `p` by one fixed step. No rendering or DOM access here. */
export function stepPlayer(p: PlayerState, cmd: PlayerCommand, map: MapData, dt: number) {
  // Left-handed, y-up (Babylon default): yaw 0 faces +z, right is +x.
  const sin = Math.sin(cmd.yaw);
  const cos = Math.cos(cmd.yaw);
  let dx = cmd.moveZ * sin + cmd.moveX * cos;
  let dz = cmd.moveZ * cos - cmd.moveX * sin;
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  const speed = cmd.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const k = p.onGround ? 1 : PLAYER.airControl;
  p.vx += (dx * speed - p.vx) * k;
  p.vz += (dz * speed - p.vz) * k;

  if (cmd.jump && p.onGround) {
    p.vy = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  p.vy -= PLAYER.gravity * dt;

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;

  const r = PLAYER.radius;
  // Boxes taller than a step are walls; lower ones (or ones we're already above) are floor.
  for (const b of map.boxes) if (boxTop(b) > p.y + PLAYER.stepHeight) pushOutOfBox(p, r, b);
  clampToArena(p, r, map);

  let floor = groundAt(map, p.x, p.z);
  for (const b of map.boxes) if (boxTop(b) > floor && overlapsBox(p, r, b)) floor = boxTop(b);
  // Walking downhill: stick to the slope instead of taking tiny falls (which would block jumping).
  const snap = p.onGround && p.vy <= 0 && p.y - floor < PLAYER.stepHeight;
  if (p.y <= floor || snap) {
    p.y = floor;
    p.vy = 0;
    p.onGround = true;
  } else {
    p.onGround = false;
  }
}
