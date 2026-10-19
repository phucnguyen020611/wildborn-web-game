import { describe, expect, it } from 'vitest';
import { canCraft, craft, createWorld, nearestInteractable, stepWorld, type World } from './world';
import type { PlayerCommand } from './player';
import type { MapData } from '../maps/types';
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

  it('a thrust into the ground or a wall strikes it once instead of passing through', () => {
    const empty: MapData = { ...map, creatures: [] };
    const w = createWorld(empty);
    stepWorld(w, { ...cmd(true), pitch: 1.2 }, empty, DT); // looking steeply down
    const events = [];
    for (let i = 0; i < 30; i++) {
      stepWorld(w, { ...cmd(), pitch: 1.2 }, empty, DT);
      events.push(...w.events);
    }
    const strikes = events.filter((e) => e.type === 'strike');
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toMatchObject({ ground: true, at: { y: 0 } });

    const walled: MapData = { ...empty, boxes: [{ x: 0, z: 1.5, w: 4, d: 1, h: 3 }] };
    const v = createWorld(walled);
    stepWorld(v, { ...cmd(true), pitch: 0 }, walled, DT);
    const hits = [];
    for (let i = 0; i < 30; i++) {
      stepWorld(v, { ...cmd(), pitch: 0 }, walled, DT);
      hits.push(...v.events.filter((e) => e.type === 'strike'));
    }
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ ground: false, at: { z: expect.closeTo(1, 1) } });
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

  it('a long fall hurts, a normal jump does not', () => {
    const w = createWorld({ ...map, creatures: [] });
    stepWorld(w, { ...cmd(), jump: true }, map, DT);
    for (let i = 0; i < 90; i++) stepWorld(w, cmd(), map, DT);
    expect(w.playerHp).toBe(PLAYER.hp);
    Object.assign(w.player, { y: 8, onGround: false });
    const events = [];
    for (let i = 0; i < 90; i++) {
      stepWorld(w, cmd(), map, DT);
      events.push(...w.events);
    }
    expect(w.playerHp).toBeLessThan(PLAYER.hp);
    expect(events.some((e) => e.type === 'hurt')).toBe(true);
  });
});

describe('stepWorld gathering and crafting', () => {
  const herbs: MapData = {
    ...map,
    creatures: [],
    pickups: [
      { item: 'herb', x: 0, z: 1 },
      { item: 'herb', x: 1, z: 0 },
      { item: 'herb', x: 20, z: 20 }, // out of reach
    ],
  };
  const press = (w: World, m: MapData, extra: Partial<PlayerCommand>) =>
    stepWorld(w, { ...cmd(), ...extra }, m, DT);

  it('E picks up the nearest herb in reach, once; herbs make a poultice; Q heals with it', () => {
    const w = createWorld(herbs);
    press(w, herbs, { interact: true });
    press(w, herbs, { interact: true });
    press(w, herbs, { interact: true }); // nothing left in reach
    expect(w.inventory.herb).toBe(2);
    expect(w.taken).toEqual([true, true, false]);
    expect(nearestInteractable(w, herbs)).toBeNull();

    expect(craft(w, 'poultice')).toBe(true);
    expect(w.inventory).toMatchObject({ herb: 0, poultice: 1 });
    expect(craft(w, 'poultice')).toBe(false);

    press(w, herbs, { heal: true }); // full health: the poultice is kept
    expect(w.inventory.poultice).toBe(1);
    w.playerHp = 30;
    press(w, herbs, { heal: true });
    expect(w.playerHp).toBe(70);
    expect(w.inventory.poultice).toBe(0);
    expect(w.events).toContainEqual({ type: 'heal', amount: 40 });
  });

  it('a dead animal can be skinned once; spear tips go in order and raise damage', () => {
    const w = createWorld(map);
    const hits = Math.ceil(CREATURES.fox.hp / WEAPONS.spear.damage);
    for (let i = 0; i < hits; i++) thrust(w);
    expect(fox(w).mode).toBe('dead');
    // The win froze the world; skin it anyway by resuming play.
    w.outcome = 'playing';
    for (let i = 0; i < 10; i++) step(w); // let the hit freeze pass
    stepWorld(w, { ...cmd(), interact: true }, map, DT);
    expect(w.inventory.hide).toBe(1);
    expect(w.creatures[0].looted).toBe(true);

    Object.assign(w.inventory, { bone: 5, hide: 1, alpha_fang: 1 });
    expect(canCraft(w, 'fang_tip')).toBe(false); // needs the bone tip first
    expect(craft(w, 'bone_tip')).toBe(true);
    expect(craft(w, 'fang_tip')).toBe(true);
    expect(w.spearTier).toBe(2);

    const v = createWorld(map);
    v.spearTier = 2;
    const events = thrust(v);
    expect(events.find((e) => e.type === 'hit')).toMatchObject({
      damage: WEAPONS.spear.damage * 1.6,
    });
  });
});
