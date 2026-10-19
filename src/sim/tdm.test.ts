import { describe, expect, it } from 'vitest';
import { ARSENAL, FIGHTER } from '../config/arsenal';
import type { MapData } from '../maps/types';
import { botCommand, createMind } from './bot';
import { createMatch, stepMatch, type FighterCommand, type Match } from './tdm';

const DT = 1 / 60;
const map: MapData = {
  size: 80,
  spawn: { x: 0, z: 0 },
  boxes: [],
  creatures: [],
  teams: [[{ x: 0, z: -30 }], [{ x: 0, z: 30 }]],
};
const still = (yaw = 0, pitch = 0): FighterCommand => ({
  moveX: 0,
  moveZ: 0,
  jump: false,
  sprint: false,
  yaw,
  pitch,
  attack: false,
  throw: false,
});

/** Player (team 0) at the origin facing +z; the one enemy `d` metres ahead. */
function duel(d: number) {
  const m = createMatch(map, 1);
  Object.assign(m.fighters[0].body, { x: 0, z: 0 });
  Object.assign(m.fighters[1].body, { x: 0, z: d });
  m.fighters[1].protect = 0;
  return m;
}
function run(m: Match, first: FighterCommand, rest: FighterCommand, steps: number) {
  const events = [];
  stepMatch(m, [first, still(Math.PI)], map, DT);
  events.push(...m.events);
  for (let i = 0; i < steps; i++) {
    stepMatch(m, [rest, still(Math.PI)], map, DT);
    events.push(...m.events);
  }
  return events;
}

describe('stepMatch', () => {
  it('a spear thrust hits the enemy in front once; a kill scores and the victim respawns at home', () => {
    const m = duel(1.8);
    const hits = Math.ceil(FIGHTER.hp / ARSENAL.spear.melee.damage);
    for (let n = 0; n < hits; n++) {
      const ev = run(m, { ...still(), attack: true }, still(), 40);
      expect(ev.filter((e) => e.type === 'hit')).toHaveLength(1);
    }
    expect(m.fighters[1].alive).toBe(false);
    expect(m.score).toEqual([1, 0]);
    run(m, still(), still(), Math.ceil(FIGHTER.respawnTime / DT) + 2);
    expect(m.fighters[1]).toMatchObject({ alive: true, hp: FIGHTER.hp });
    expect(m.fighters[1].body.z).toBeCloseTo(30);
  });

  it('switching to javelins and throwing hits at range and uses ammo', () => {
    const m = duel(10);
    run(m, { ...still(), slot: 'javelin' }, still(), 40); // bring it up
    expect(m.fighters[0].weapon).toBe('javelin');
    // Aim a little up for the drop over 10 m.
    const ev = run(m, { ...still(0, -0.08), attack: true }, still(0, -0.08), 60);
    expect(m.fighters[0].ammo.javelin).toBe(ARSENAL.javelin.throw.ammo - 1);
    expect(ev.find((e) => e.type === 'hit')).toMatchObject({
      damage: ARSENAL.javelin.throw.damage,
    });
  });

  it('a fuller bow draw shoots harder', () => {
    const shot = (frames: number) => {
      const m = duel(12);
      run(m, { ...still(), slot: 'bow' }, still(), 40);
      run(
        m,
        { ...still(0, -0.03), attackHeld: true },
        { ...still(0, -0.03), attackHeld: true },
        frames,
      );
      const ev = run(m, still(0, -0.03), still(0, -0.03), 60);
      return ev.find((e) => e.type === 'hit');
    };
    const quick = shot(6);
    const full = shot(60);
    expect(full).toMatchObject({ damage: ARSENAL.bow.bow.maxDamage });
    expect(quick && quick.type === 'hit' ? quick.damage : 0).toBeLessThan(
      ARSENAL.bow.bow.maxDamage,
    );
  });

  it('bots on both sides fight a match to kills', () => {
    const arena: MapData = {
      ...map,
      teams: [
        [
          { x: -4, z: -14 },
          { x: 4, z: -14 },
        ],
        [
          { x: -4, z: 14 },
          { x: 4, z: 14 },
        ],
      ],
    };
    const m = createMatch(arena, 2, 120, 5);
    const minds = m.fighters.map((_, i) => createMind(i + 1));
    for (let s = 0; s < 60 * 120 && !m.over; s++)
      stepMatch(
        m,
        m.fighters.map((_, i) => botCommand(m, i, minds[i], DT)),
        arena,
        DT,
      );
    expect(m.score[0] + m.score[1]).toBeGreaterThan(0);
  });
});
