import { createMenus } from './ui/menu';
import { createLoop, SIM_DT } from './core/loop';
import { createInput } from './input/input';
import { createRenderer } from './render/scene';
import { createDebugOverlay } from './debug/overlay';
import { createAudio } from './audio/audio';
import { loadProps } from './render/props';
import { loadWarriors } from './render/warrior';
import { createWeaponView } from './render/weaponView';
import { createMissiles } from './render/missiles';
import { createHud, lowHealth } from './ui/hud';
import { createTdmHud } from './ui/tdmHud';
import { tribalWar } from './maps/tribalWar';
import { createMatch, stepMatch, type Fighter, type FighterCommand, type Match } from './sim/tdm';
import { botCommand, createMind } from './sim/bot';
import { WEAPON_ORDER } from './config/arsenal';
import { FIGHTER } from './config/arsenal';
import type { SpearState } from './sim/spear';
import { t } from './i18n';

const PER_TEAM = 4; // 4 vs 4: you and three warriors against four

type State = 'menu' | 'playing' | 'paused' | 'ended';

/** Tribal War vs bots (`?mode=tdm`): the same renderer as the story, a different map and simulation. */
export function runTdm() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = createInput(canvas, () => {}); // no bag in Tribal War
  const audio = createAudio();
  let state: State = 'menu';

  async function play() {
    audio.unlock();
    if (state === 'ended') restart();
    try {
      await input.lock();
    } catch {
      menus.showRelockHint();
    }
  }
  const menus = createMenus(
    play,
    () => {
      restart();
      state = 'menu';
      menus.show('menu');
    },
    () => (location.search = ''), // Story lives on the plain URL
    () => void play(),
  );

  const map = tribalWar;
  const renderer = createRenderer(canvas, map);
  renderer.viewmodel.update({ held: false } as SpearState); // the story spear stays hidden here
  const debug = createDebugOverlay(renderer.engine, renderer.scene);
  createHud(); // health bar, vignette, crosshair (updated below for Tribal War)
  const hud = createTdmHud();
  const weaponView = createWeaponView(renderer.scene, renderer.camera, renderer.motion);
  const missiles = createMissiles(renderer.scene);
  void loadProps(renderer.scene, map.props ?? [], renderer.castShadow);

  let match: Match = createMatch(map, PER_TEAM);
  let minds = match.fighters.map((_, i) => createMind(i * 7 + 3));
  const copy = (f: Fighter): Fighter => ({ ...f, body: { ...f.body } });
  let prev = match.fighters.map(copy);
  type Body = { update(p: Fighter, c: Fighter, a: number): void };
  let bodies: (Body | null)[] = match.fighters.map(() => null);
  void loadWarriors(renderer.scene, renderer.castShadow).then((spawn) => {
    bodies = match.fighters.map((f, i) => (i === 0 ? null : spawn(`fighter_${i}`, f.team)));
  });
  if (import.meta.env.DEV) {
    // console inspection; getters (Object.assign would copy today's values)
    Object.assign(window, { scene: renderer.scene, renderer, weaponView });
    Object.defineProperties(window, {
      match: { get: () => match, configurable: true },
      bodies: { get: () => bodies, configurable: true },
    });
  }

  function restart() {
    match = createMatch(map, PER_TEAM);
    minds = match.fighters.map((_, i) => createMind(i * 7 + 3 + Math.floor(Math.random() * 1000)));
    prev = match.fighters.map(copy);
    input.look.yaw = match.fighters[0].yaw;
    input.look.pitch = 0;
    renderer.effects.clear();
  }
  input.look.yaw = match.fighters[0].yaw;

  document.addEventListener('pointerlockchange', () => {
    if (input.isLocked()) {
      state = 'playing';
      menus.show(null);
    } else if (state === 'playing') {
      state = 'paused';
      menus.show('pause');
    }
  });

  const crosshair = document.querySelector<HTMLElement>('.crosshair')!;
  const vignette = document.querySelector<HTMLElement>('.hud-vignette')!;
  const flash = (cls: string, ms: number) => {
    crosshair.classList.add(cls);
    setTimeout(() => crosshair.classList.remove(cls), ms);
  };

  const loop = createLoop(
    () => {
      if (state !== 'playing') return;
      prev = match.fighters.map(copy);
      const raw = input.command();
      const me: FighterCommand = {
        ...raw,
        slot: raw.slot ? WEAPON_ORDER[raw.slot - 1] : undefined,
      };
      const cmds = match.fighters.map((_, i) =>
        i === 0 ? me : botCommand(match, i, minds[i], SIM_DT),
      );
      stepMatch(match, cmds, map, SIM_DT);
      for (const e of match.events) {
        if (e.type === 'swing' || e.type === 'throw') {
          if (e.fighter === 0) audio.play(e.type === 'swing' ? 'sfx_thrust' : 'sfx_throw');
        } else if (e.type === 'hit') {
          audio.play(e.killed ? 'sfx_kill' : 'sfx_hit', e.at);
          renderer.effects.blood(e.at, renderer.camera.position);
          if (e.attacker === 0) flash(e.killed ? 'kill' : 'hit', e.killed ? 400 : 150);
          if (e.victim === 0) {
            audio.play('sfx_hurt');
            renderer.shake();
            vignette.classList.add('hurt');
            setTimeout(() => vignette.classList.remove('hurt'), 60);
          }
        } else if (e.type === 'kill') {
          hud.kill(e.killer, e.victim, match.fighters[e.killer].team);
        } else if (e.type === 'impact') {
          audio.play('sfx_stick', e.at);
          renderer.effects.dust(e.at);
        } else if (e.type === 'pickup' && e.fighter === 0) {
          audio.play('sfx_pickup');
        } else if (e.type === 'respawn' && e.fighter === 0) {
          input.look.yaw = match.fighters[0].yaw;
          input.look.pitch = 0;
          prev[0] = copy(match.fighters[0]);
        } else if (e.type === 'end') {
          state = 'ended';
          document.exitPointerLock();
          const me = match.fighters[0];
          const panel = document.getElementById('menu-end')!;
          menus.show('end');
          panel.querySelector('.end-title')!.textContent = t(
            e.winner === null ? 'tdm.draw' : e.winner === 0 ? 'tdm.won' : 'tdm.lost',
          );
          panel.querySelector('.end-stats')!.textContent = t('tdm.stats', {
            a: match.score[0],
            b: match.score[1],
            k: me.kills,
            d: me.deaths,
          });
          panel.querySelector<HTMLElement>('.end-unlock')!.hidden = true;
        }
      }
    },
    (alpha) => {
      const me = match.fighters[0];
      bodies.forEach((b, i) => b?.update(prev[i], match.fighters[i], alpha));
      missiles.update(match.missiles);
      weaponView.update(me);
      hud.update(match);
      const k = lowHealth((me.hp / FIGHTER.hp) * 100);
      canvas.style.filter = k > 0 ? `saturate(${1 - 0.8 * k})` : '';
      audio.heartbeat(state === 'playing' && me.alive ? k : 0);
      renderer.render(prev[0].body, me.body, alpha, input.look.yaw, input.look.pitch);
      const cam = renderer.camera;
      audio.setListener(cam.position, cam.rotation.y, cam.rotation.x);
    },
  );
  renderer.engine.runRenderLoop(() => {
    loop.tick(performance.now());
    debug.update();
  });
  menus.show('menu');
}
