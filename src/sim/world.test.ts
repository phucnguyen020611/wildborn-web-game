import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld, type World } from './world';
import type { PlayerCommand } from './player';
import type { MapData } from '../maps/testArena';
import { CREATURES } from '../config/creatures';
import { WEAPONS } from '../config/weapons';
import { PLAYER } from '../config/player';

const DT = 1 / 60;
const map: MapData = {
  size: 60,
  spawn: { x: 0, z: 0 },
  boxes: [],
  creatures: [{ kind: 'fox', waypoints: [{ x: 0, z: 2 }] }],
};
// Fox 2 m ahead (body centre 0.45 m high); looking ~24° down puts the thrust through it.
const aim = Math.atan2(1.6 - 0.45, 2);
const cmd = (attack = false): PlayerCommand => ({
  moveX: 0,
  moveZ: 0,
  jump: false,
  sprint: false,
  yaw: 0,
  pitch: aim,
  attack,
  throw: false,
});

const fox = (w: World) => w.creatures[0].state;

/** Holds the fox in place so tests measure combat, not AI. */
function step(w: World, attack = false) {
  stepWorld(w, cmd(attack), map, DT);
  if (fox(w).mode !== 'dead') Object.assign(fox(w), { x: 0, z: 2, heading: Math.PI / 2 });
}

function thrust(w: World) {
  const events = [];
  step(w, true);
  events.push(...w.events);
  for (let i = 0; i < 60; i++) {
    step(w);
    events.push(...w.events);
  }
  return events;
}

describe('stepWorld combat', () => {
  it('a thrust hits once, damages, and freezes the world briefly', () => {
    const w = createWorld(map);
    const events = thrust(w);
    expect(events.filter((e) => e.type === 'thrust')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(1);
    expect(fox(w).hp).toBe(CREATURES.fox.hp - WEAPONS.spear.damage);
  });

  it('misses when aiming over the target', () => {
    const w = createWorld(map);
    stepWorld(w, { ...cmd(true), pitch: -0.3 }, map, DT);
    for (let i = 0; i < 60; i++) stepWorld(w, { ...cmd(), pitch: -0.3 }, map, DT);
    expect(fox(w).hp).toBe(CREATURES.fox.hp);
  });

  it('killing the fox wins the hunt and freezes the world', () => {
    const w = createWorld(map);
    const hits = Math.ceil(CREATURES.fox.hp / WEAPONS.spear.damage);
    for (let i = 0; i < hits - 1; i++) thrust(w);
    const last = thrust(w);
    expect(last.find((e) => e.type === 'hit')).toMatchObject({ killed: true });
    expect(last).toContainEqual({ type: 'end', outcome: 'won' });
    expect(w.outcome).toBe('won');
    expect(w.hits).toBe(hits);
    expect(w.attacks).toBe(hits);
    const t = w.time;
    step(w);
    expect(w.time).toBe(t);
  });

  it('a hurt fox fights back; standing still gets the player killed', () => {
    const w = createWorld(map);
    step(w, true);
    for (let i = 0; i < 30; i++) step(w); // land one thrust, then let the fox act freely
    expect(fox(w).angry).toBe(true);
    let hurt = 0;
    for (let i = 0; i < 60 * 20 && w.outcome === 'playing'; i++) {
      stepWorld(w, cmd(), map, DT);
      hurt += w.events.filter((e) => e.type === 'hurt').length;
    }
    expect(hurt).toBe(Math.ceil(PLAYER.hp / CREATURES.fox.attackDamage));
    expect(w.playerHp).toBe(0);
    expect(w.outcome).toBe('lost');
  });

  it('a thrown spear hits, lands, and is picked up by walking to it', () => {
    const w = createWorld(map);
    const throwCmd = { ...cmd(), throw: true, pitch: Math.atan2(1.6 - 0.45, 2) - 0.05 };
    stepWorld(w, throwCmd, map, DT);
    let hits = 0;
    for (let i = 0; i < 120; i++) {
      step(w);
      hits += w.events.filter((e) => e.type === 'hit').length;
    }
    expect(hits).toBe(1);
    expect(fox(w).hp).toBe(CREATURES.fox.hp - WEAPONS.spear.throwDamage);
    expect(w.spear.held).toBe(false);
    expect(w.thrown?.flying).toBe(false);

    const walk = { ...cmd(), moveZ: 1 };
    for (let i = 0; i < 120 && !w.spear.held; i++) stepWorld(w, walk, map, DT);
    expect(w.spear.held).toBe(true);
    expect(w.thrown).toBeNull();
  });

  it('a spear thrown into a wall drops at its base', () => {
    const walled: MapData = { ...map, boxes: [{ x: 0, z: 5, w: 4, d: 1, h: 3 }] };
    const w = createWorld(walled);
    stepWorld(w, { ...cmd(), throw: true, pitch: 0 }, walled, DT);
    for (let i = 0; i < 120; i++) stepWorld(w, { ...cmd(), pitch: 0 }, walled, DT);
    expect(w.thrown).toMatchObject({ flying: false, y: 0 });
    expect(w.thrown!.z).toBeLessThan(4.5);
  });

  it('with a boss on the map, only the boss death wins; the boss charges when provoked', () => {
    const arena: MapData = {
      ...map,
      creatures: [
        { kind: 'fox', waypoints: [{ x: 0, z: 2 }] },
        { kind: 'mammoth', waypoints: [{ x: 0, z: 20 }] },
      ],
    };
    const w = createWorld(arena);
    expect(w.target).toBe(1);
    const hits = Math.ceil(CREATURES.fox.hp / WEAPONS.spear.damage);
    for (let i = 0; i < hits; i++) {
      stepWorld(w, cmd(true), arena, DT);
      for (let j = 0; j < 60; j++) {
        stepWorld(w, cmd(), arena, DT);
        Object.assign(
          w.creatures[0].state,
          w.creatures[0].state.mode === 'dead' ? {} : { x: 0, z: 2, heading: Math.PI / 2 },
        );
      }
    }
    expect(w.creatures[0].state.mode).toBe('dead');
    expect(w.outcome).toBe('playing');

    const boss = w.creatures[1].state;
    expect(boss.angry).toBe(false);
    for (let i = 0; i < 60 * 10 && !boss.angry; i++)
      stepWorld(w, { ...cmd(), moveZ: 1, pitch: 0 }, arena, DT);
    expect(boss.angry).toBe(true);
  });
});
