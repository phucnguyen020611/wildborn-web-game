import '@fontsource/saira-extra-condensed/700.css';
import './style.css';
import { applyI18n } from './i18n';
import { createMenus } from './ui/menu';
import { createLoop, SIM_DT } from './core/loop';
import { createInput } from './input/input';
import { createRenderer } from './render/scene';
import { createDebugOverlay } from './debug/overlay';
import { createBench } from './debug/bench';
import { createWorld, stepWorld } from './sim/world';
import type { PlayerCommand } from './sim/player';
import { createHud } from './ui/hud';
import { createAudio } from './audio/audio';
import { loadCreature } from './render/creature';
import { loadProps } from './render/props';
import { CREATURES } from './config/creatures';
import { testArena } from './maps/testArena';
import { pineValley } from './maps/pineValley';
import { groundAt } from './sim/terrain';

type State = 'menu' | 'playing' | 'paused' | 'ended';

function main() {
  applyI18n();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = createInput(canvas);
  let state: State = 'menu';

  const audio = createAudio();
  const menus = createMenus(
    async () => {
      audio.unlock(); // must happen inside the click gesture
      if (state === 'ended') restart();
      try {
        await input.lock();
      } catch {
        menus.showRelockHint();
      }
    },
    () => {
      restart();
      state = 'menu';
      menus.show('menu');
    },
  );

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
  if (import.meta.env.DEV)
    Object.assign(window, { scene: renderer.scene, world, prev, input, map }); // console inspection
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
  if (map.props)
    loadProps(renderer.scene, map.props, renderer.castShadow).catch((err) =>
      console.error('Failed to load props', err),
    );
  world.creatures.forEach((c, i) =>
    loadCreature(renderer.scene, CREATURES[c.kind], renderer.castShadow).then(
      (v) => (views[i] = v),
      (err) => console.error(`Failed to load ${c.kind}`, err),
    ),
  );

  function restart() {
    Object.assign(world, createWorld(map));
    Object.assign(prev.player, world.player);
    world.creatures.forEach((c, i) => Object.assign(prev.creatures[i], c.state));
    prev.thrown = null;
    input.look.yaw = input.look.pitch = 0;
    hud.reset();
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
        else if (e.type === 'stick') audio.play('sfx_stick', e.at);
        else if (e.type === 'hurt') {
          audio.play('sfx_hurt');
          renderer.shake();
          hud.hurt();
        } else if (e.type === 'end') {
          state = 'ended';
          document.exitPointerLock();
          menus.showEnd({
            outcome: e.outcome,
            time: world.time,
            hits: world.hits,
            attacks: world.attacks,
          });
        } else if (e.type === 'hit') {
          audio.play(e.killed ? 'sfx_kill' : 'sfx_hit', e.at);
          renderer.shake();
          views[e.creature]?.flash();
          hud.hitMarker(e.killed);
        }
      }
    },
    (alpha) => {
      world.creatures.forEach((c, i) => views[i]?.update(prev.creatures[i], c.state, alpha));
      hud.update(world);
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
