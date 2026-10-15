import { describe, expect, it } from 'vitest';
import { createPlayer, stepPlayer, type PlayerCommand } from './player';
import type { MapData } from '../maps/testArena';
import { PLAYER } from '../config/player';

const DT = 1 / 60;
const idle: PlayerCommand = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  sprint: false,
  yaw: 0,
  pitch: 0,
  attack: false,
  throw: false,
};
const empty: MapData = { size: 100, spawn: { x: 0, z: 0 }, boxes: [], creatures: [] };

function run(map: MapData, cmd: PlayerCommand, steps: number) {
  const p = createPlayer(map);
  for (let i = 0; i < steps; i++) stepPlayer(p, cmd, map, DT);
  return p;
}

describe('stepPlayer', () => {
  it('moves forward along yaw at walk speed', () => {
    const p = run(empty, { ...idle, moveZ: 1 }, 60);
    expect(p.z).toBeCloseTo(PLAYER.walkSpeed, 1);
    const turned = run(empty, { ...idle, moveZ: 1, yaw: Math.PI / 2 }, 60);
    expect(turned.x).toBeCloseTo(PLAYER.walkSpeed, 1);
  });

  it('does not move faster diagonally', () => {
    const p = run(empty, { ...idle, moveZ: 1, moveX: 1 }, 60);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(PLAYER.walkSpeed, 1);
  });

  it('jumps and lands back on the ground', () => {
    const p = createPlayer(empty);
    stepPlayer(p, { ...idle, jump: true }, empty, DT);
    expect(p.onGround).toBe(false);
    for (let i = 0; i < 120; i++) stepPlayer(p, idle, empty, DT);
    expect(p.y).toBe(0);
    expect(p.onGround).toBe(true);
  });

  it('is blocked by boxes and the arena edge', () => {
    const map: MapData = {
      size: 20,
      spawn: { x: 0, z: 0 },
      boxes: [{ x: 0, z: 3, w: 2, d: 2, h: 2 }],
      creatures: [],
    };
    const blocked = run(map, { ...idle, moveZ: 1 }, 120);
    expect(blocked.z).toBeCloseTo(2 - PLAYER.radius, 3);
    const edge = run(map, { ...idle, moveZ: -1 }, 600);
    expect(edge.z).toBeCloseTo(-10 + PLAYER.radius, 3);
  });

  it('steps onto low ledges, jumps onto boxes and falls off edges', () => {
    const step: MapData = {
      size: 40,
      spawn: { x: 0, z: 0 },
      boxes: [{ x: 0, z: 3, w: 2, d: 2, h: 0.3 }],
      creatures: [],
    };
    const stepped = run(step, { ...idle, moveZ: 1 }, 40); // ~3.3 m forward
    expect(stepped.y).toBe(0.3);

    const ledge: MapData = {
      size: 40,
      spawn: { x: 0, z: 0 },
      boxes: [{ x: 0, z: 2, w: 2, d: 2, h: 1 }],
      creatures: [],
    };
    const p = createPlayer(ledge);
    stepPlayer(p, { ...idle, jump: true, moveZ: 1 }, ledge, DT);
    for (let i = 0; i < 25; i++) stepPlayer(p, { ...idle, moveZ: 1 }, ledge, DT);
    for (let i = 0; i < 30; i++) stepPlayer(p, idle, ledge, DT);
    expect(p.y).toBe(1);
    expect(p.onGround).toBe(true);

    for (let i = 0; i < 120; i++) stepPlayer(p, { ...idle, moveZ: 1 }, ledge, DT);
    expect(p.y).toBe(0);
  });
});
