import { describe, expect, it } from 'vitest';
import { createCreature, stepCreature } from './creature';
import { CREATURES } from '../config/creatures';
import type { MapData } from '../maps/testArena';

const DT = 1 / 60;
const cfg = CREATURES.fox;
const map: MapData = {
  size: 100,
  spawn: { x: 0, z: 0 },
  boxes: [],
  creatures: [],
};
const waypoints = [
  { x: 0, z: 0 },
  { x: 0, z: 10 },
];
const farPlayer = { x: 40, z: -40 };

describe('stepCreature', () => {
  it('idles, then walks to the next waypoint and idles there', () => {
    const c = createCreature(waypoints, cfg);
    stepCreature(c, cfg, farPlayer, waypoints, map, DT);
    expect(c.mode).toBe('idle');
    for (let i = 0; i < 60 * 8; i++) stepCreature(c, cfg, farPlayer, waypoints, map, DT); // 1 s idle + ~5.6 s walk, then 3 s idle
    expect(c.mode).toBe('idle');
    expect(Math.hypot(c.x, c.z - 10)).toBeLessThan(1);
    expect(c.waypoint).toBe(2);
  });

  it('runs away from a nearby player', () => {
    const c = createCreature(waypoints, cfg);
    const player = { x: 0, z: -2 };
    for (let i = 0; i < 60; i++) stepCreature(c, cfg, player, waypoints, map, DT);
    expect(c.mode).toBe('flee');
    expect(c.speed).toBe(cfg.runSpeed);
    expect(c.z).toBeGreaterThan(2);
  });
});
