import { PLAYER } from '../config/player';
import { CREATURES } from '../config/creatures';
import type { World } from '../sim/world';
import { t } from '../i18n';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const LOW_HP = 0.3;

/** 0 above 30% health, rising to 1 at zero: drives the desaturation and the heartbeat. */
export const lowHealth = (hp: number) => Math.max(0, 1 - hp / (PLAYER.hp * LOW_HP));

/** In-game HUD. `update` runs every frame but only touches the DOM when a value changes. */
export function createHud() {
  const canvas = $('#game');
  const crosshair = $('.crosshair');
  const vignette = $('.hud-vignette');
  const target = $('.hud-target');
  const targetName = $('#hud-target-name');
  const targetBar = $('.hud-target .bar');
  const targetFill = $('.hud-target .bar-fill');
  const player = $('.hud-player');
  const playerBar = $('.hud-player .bar');
  const playerFill = $('.hud-player .bar-fill');
  const hpValue = $('.hud-hp-value');
  const spear = $('.hud-spear');
  let markerTimer = 0;
  let last = { hp: -1, targetHp: -1, held: null as boolean | null, engaged: false };

  function setBar(bar: HTMLElement, fill: HTMLElement, value: number, max: number) {
    fill.style.transform = `scaleX(${value / max})`;
    bar.setAttribute('aria-valuenow', String(Math.round((value / max) * 100)));
  }

  return {
    update(w: World) {
      if (w.playerHp !== last.hp) {
        setBar(playerBar, playerFill, w.playerHp, PLAYER.hp);
        hpValue.textContent = String(Math.ceil(w.playerHp));
        const low = w.playerHp / PLAYER.hp <= LOW_HP;
        player.classList.toggle('low', low);
        vignette.classList.toggle('low', low);
        const k = lowHealth(w.playerHp); // the world drains of colour as you near death
        canvas.style.filter = k > 0 ? `saturate(${1 - 0.8 * k})` : '';
      }
      // The target bar appears once the fight starts, so it doesn't spoil the hunt.
      const { kind, state } = w.creatures[w.target];
      const maxHp = CREATURES[kind].hp;
      const engaged = state.hp < maxHp || state.angry;
      if (engaged !== last.engaged) {
        target.hidden = !engaged;
        targetName.dataset.i18n = `creature.${kind}`;
        targetName.textContent = t(targetName.dataset.i18n);
      }
      if (state.hp !== last.targetHp) setBar(targetBar, targetFill, state.hp, maxHp);
      if (w.spear.held !== last.held) {
        spear.dataset.i18n = w.spear.held ? 'hud.spear_held' : 'hud.spear_thrown';
        spear.textContent = t(spear.dataset.i18n);
        spear.classList.toggle('away', !w.spear.held);
      }
      last = { hp: w.playerHp, targetHp: state.hp, held: w.spear.held, engaged };
    },

    /** Forces a full redraw (after a restart). */
    reset() {
      last = { hp: -1, targetHp: -1, held: null, engaged: true };
    },

    /** Crosshair flashes on a hit (longer and red on a kill). */
    hitMarker(killed: boolean) {
      crosshair.classList.remove('hit', 'kill');
      crosshair.classList.add(killed ? 'kill' : 'hit');
      clearTimeout(markerTimer);
      markerTimer = window.setTimeout(
        () => crosshair.classList.remove('hit', 'kill'),
        killed ? 400 : 150,
      );
    },

    /** Red screen-edge flash when the player takes damage. */
    hurt() {
      vignette.classList.add('hurt');
      setTimeout(() => vignette.classList.remove('hurt'), 60); // then fades out via CSS transition
    },
  };
}
