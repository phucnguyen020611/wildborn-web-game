import '@fontsource/saira-extra-condensed/700.css';
import './style.css';
import { applyI18n } from './i18n';
import { createMenus } from './ui/menu';
import { createLoop, SIM_DT } from './core/loop';
import { createInput } from './input/input';
import { createRenderer } from './render/scene';
import { createDebugOverlay } from './debug/overlay';
import { createBench } from './debug/bench';
import { createWorld, placeAtCamp, stepWorld } from './sim/world';
import type { PlayerCommand } from './sim/player';
import { createHud, lowHealth } from './ui/hud';
import { createAudio } from './audio/audio';
import { loadCreature } from './render/creature';
import { loadProps } from './render/props';
import { CREATURES } from './config/creatures';
import { LOOT } from './config/items';
import { testArena } from './maps/testArena';
import { pineValley } from './maps/pineValley';
import { groundAt } from './sim/terrain';
import { renderActs } from './ui/acts';
import { renderBag } from './ui/bag';
import { completeAct, isUnlocked, loadBag, saveBag } from './core/progress';
import { t } from './i18n';

type State = 'menu' | 'playing' | 'paused' | 'bag' | 'ended';

function main() {
  applyI18n();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = createInput(canvas, openBag);
  let state: State = 'menu';

  const audio = createAudio();
  async function play() {
    audio.unlock(); // must happen inside the click gesture
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
    () => {
      // Act select. Only act 1 is built (docs/STORY_MODE.md); entering an act starts it fresh.
      renderActs(document.getElementById('menu-acts')!, () => {
        restart();
        state = 'menu';
        void play();
      });
      menus.show('acts');
    },
  );

  /** Tab: pause into the bag to craft; Resume re-locks the pointer and play continues. */
  function openBag() {
    if (state !== 'playing') return;
    state = 'bag';
    document.exitPointerLock();
    renderBag(document.getElementById('menu-craft')!, world);
    menus.show('craft');
  }

  if (!document.createElement('canvas').getContext('webgl2')) {
    menus.show('error');
    return;
  }

  const map = new URLSearchParams(location.search).get('map') === 'arena' ? testArena : pineValley;
  const renderer = createRenderer(canvas, map);
  const debug = createDebugOverlay(renderer.engine, renderer.scene);
  const hud = createHud();
  const world = createWorld(map);
  // Last step's state, for render interpolation.
  const prev = {
    player: { ...world.player },
    creatures: world.creatures.map((c) => ({ ...c.state })),
    thrown: null as typeof world.thrown,
  };
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
  // One view per creature, filled in as models finish loading.
  const views: (Awaited<ReturnType<typeof loadCreature>> | null)[] = world.creatures.map(
    () => null,
  );
  const trail = world.creatures.map((c) => ({ x: c.state.x, z: c.state.z })); // where each last dripped
  if (import.meta.env.DEV)
    Object.assign(window, { scene: renderer.scene, renderer, views, world, prev, input, map }); // console inspection
  // Herbs are props too; their nodes are hidden once picked.
  const herbs = (map.pickups ?? []).map((p, i) => ({
    id: 'herb' as const,
    x: p.x,
    y: groundAt(map, p.x, p.z),
    z: p.z,
    rot: i * 2.4,
    scale: 1,
  }));
  let herbNodes: { setEnabled(on: boolean): void }[] = [];
  loadProps(renderer.scene, [...(map.props ?? []), ...herbs], renderer.castShadow).then(
    (nodes) => (herbNodes = nodes.slice(nodes.length - herbs.length)),
    (err) => console.error('Failed to load props', err),
  );
  world.creatures.forEach((c, i) =>
    loadCreature(renderer.scene, CREATURES[c.kind], renderer.castShadow).then(
      (v) => (views[i] = v),
      (err) => console.error(`Failed to load ${c.kind}`, err),
    ),
  );

  function restart() {
    Object.assign(world, createWorld(map));
    // Story map: pick up where the last rest left off (bag, spear, camp to start from).
    const bag = map.camps && loadBag('act1');
    if (bag) {
      Object.assign(world.inventory, bag.inventory);
      world.spearTier = bag.spearTier;
      world.camp = Math.min(bag.camp, map.camps!.length - 1);
      placeAtCamp(world, map, world.camp);
    }
    Object.assign(prev.player, world.player);
    world.creatures.forEach((c, i) => Object.assign(prev.creatures[i], c.state));
    prev.thrown = null;
    input.look.yaw = input.look.pitch = 0;
    hud.reset();
    renderer.effects.clear();
    views.forEach((v) => v?.clearWounds());
  }

  // Esc always releases pointer lock (browser rule), so lock state drives pause.
  document.addEventListener('pointerlockchange', () => {
    if (input.isLocked()) {
      state = 'playing';
      menus.show(null);
    } else if (state === 'playing') {
      state = 'paused';
      menus.show('pause');
    }
  });

  const bench = new URLSearchParams(location.search).has('bench')
    ? createBench((s) => {
        const gl = renderer.engine.getGlInfo();
        const lines = [
          'BENCH RESULT',
          `avg      ${s.avgMs.toFixed(2)} ms (${s.fps.toFixed(0)} FPS)`,
          `p95      ${s.p95Ms.toFixed(2)} ms`,
          `p99      ${s.p99Ms.toFixed(2)} ms`,
          `max      ${s.maxMs.toFixed(2)} ms`,
          `frames   ${s.frames}`,
          `gpu      ${gl.renderer}`,
          `screen   ${innerWidth}x${innerHeight} @${devicePixelRatio}x`,
          `browser  ${navigator.userAgent}`,
        ];
        debug.showReport(lines.join('\n'));
        console.log(lines.join('\n'));
      })
    : null;

  const loop = createLoop(
    () => {
      if (state !== 'playing' && !bench?.running) return;
      Object.assign(prev.player, world.player);
      world.creatures.forEach((c, i) => Object.assign(prev.creatures[i], c.state));
      prev.thrown = world.thrown && { ...world.thrown };
      stepWorld(world, state === 'playing' ? input.command() : idle, map, SIM_DT);
      for (const e of world.events) {
        if (e.type === 'thrust') audio.play('sfx_thrust');
        else if (e.type === 'throw') audio.play('sfx_throw');
        else if (e.type === 'pickup') audio.play('sfx_pickup');
        else if (e.type === 'stick') {
          audio.play('sfx_stick', e.at);
          renderer.effects.dust(e.at);
        } else if (e.type === 'strike') {
          audio.play('sfx_stick', e.at);
          renderer.effects.strike(
            e.at,
            e.ground,
            renderer.camera.position,
            renderer.camera.getForwardRay().direction,
          );
        } else if (e.type === 'hurt') {
          audio.play('sfx_hurt');
          renderer.shake();
          hud.hurt();
        } else if (e.type === 'loot') {
          audio.play('sfx_pickup', e.at);
          hud.loot(e.items);
        } else if (e.type === 'heal') {
          audio.play('sfx_pickup');
        } else if (e.type === 'rest') {
          audio.play('sfx_pickup');
          saveBag('act1', {
            inventory: { ...world.inventory },
            spearTier: world.spearTier,
            camp: e.camp,
          });
          hud.notice(t('hud.rested'));
        } else if (e.type === 'respawn') {
          Object.assign(prev.player, world.player);
          prev.thrown = null;
          hud.notice(t('hud.respawn'));
        } else if (e.type === 'end') {
          state = 'ended';
          document.exitPointerLock();
          let unlocked: string | undefined;
          if (e.outcome === 'won' && map === pineValley) {
            if (!isUnlocked('act2')) unlocked = t('act.act2.title');
            completeAct('act1');
          }
          menus.showEnd({
            outcome: e.outcome,
            time: world.time,
            hits: world.hits,
            attacks: world.attacks,
            unlocked,
          });
        } else if (e.type === 'hit') {
          audio.play(e.killed ? 'sfx_kill' : 'sfx_hit', e.at);
          renderer.shake();
          views[e.creature]?.flash();
          views[e.creature]?.wound(renderer.camera.position, e.at);
          renderer.effects.blood(e.at, renderer.camera.position);
          hud.hitMarker(e.killed);
        }
      }
      // Wounded animals leave a blood trail to follow.
      world.creatures.forEach((c, i) => {
        const s = c.state;
        const last = trail[i];
        if (s.mode === 'dead' || s.hp >= CREATURES[c.kind].hp)
          return void (trail[i] = { x: s.x, z: s.z });
        if (Math.hypot(s.x - last.x, s.z - last.z) > 0.9) {
          renderer.effects.drip(s.x, s.z);
          trail[i] = { x: s.x, z: s.z };
        }
      });
    },
    (alpha) => {
      world.creatures.forEach((c, i) =>
        views[i]?.update(
          prev.creatures[i],
          c.state,
          alpha,
          c.state.mode === 'dead' && !c.looted && Object.keys(LOOT[c.kind]).length > 0,
        ),
      );
      hud.update(world, map);
      herbNodes.forEach((n, i) => n.setEnabled(!world.taken[i]));
      audio.heartbeat(state === 'playing' ? lowHealth(world.playerHp) : 0);
      renderer.viewmodel.update(world.spear);
      renderer.thrownSpear.update(prev.thrown, world.thrown, alpha);
      if (bench?.running) {
        const p = bench.tick(performance.now());
        p.y = groundAt(map, p.x, p.z);
        renderer.render(p, p, 1, p.yaw, 0);
      } else {
        renderer.render(prev.player, world.player, alpha, input.look.yaw, input.look.pitch);
      }
      const cam = renderer.camera;
      audio.setListener(cam.position, cam.rotation.y, cam.rotation.x);
    },
  );

  renderer.engine.runRenderLoop(() => {
    loop.tick(performance.now());
    debug.update();
  });

  menus.show(bench ? null : 'menu');
}

main();
