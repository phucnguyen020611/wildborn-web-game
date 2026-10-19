import { PLAYER } from '../config/player';
import { CREATURES } from '../config/creatures';
import { nearestInteractable, type World } from '../sim/world';
import type { MapData } from '../maps/types';
import type { Inventory } from '../config/items';
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
  const prompt = $('.hud-prompt');
  const bag = $('.hud-bag');
  const toasts = $('.hud-toasts');
  let markerTimer = 0;
  let last = {
    hp: -1,
    target: -1,
    targetHp: -1,
    held: null as boolean | null,
    engaged: false,
    prompt: '',
    poultice: -1,
  };

  function setBar(bar: HTMLElement, fill: HTMLElement, value: number, max: number) {
    fill.style.transform = `scaleX(${value / max})`;
    bar.setAttribute('aria-valuenow', String(Math.round((value / max) * 100)));
  }

  return {
    update(w: World, map: MapData) {
      if (w.playerHp !== last.hp) {
        setBar(playerBar, playerFill, w.playerHp, PLAYER.hp);
        hpValue.textContent = String(Math.ceil(w.playerHp));
        const low = w.playerHp / PLAYER.hp <= LOW_HP;
        player.classList.toggle('low', low);
        vignette.classList.toggle('low', low);
        const k = lowHealth(w.playerHp); // the world drains of colour as you near death
        canvas.style.filter = k > 0 ? `saturate(${1 - 0.8 * k})` : '';
      }
      // The bar shows the animal you last hit (while it lives), else the boss once the fight starts.
      const focus =
        w.lastHit >= 0 && w.creatures[w.lastHit].state.mode !== 'dead' ? w.lastHit : w.target;
      const { kind, state } = w.creatures[focus];
      const maxHp = CREATURES[kind].hp;
      const engaged = state.hp < maxHp || state.angry;
      if (engaged !== last.engaged || focus !== last.target) {
        target.hidden = !engaged;
        targetName.dataset.i18n = `creature.${kind}`;
        targetName.textContent = t(targetName.dataset.i18n);
      }
      if (state.hp !== last.targetHp || focus !== last.target)
        setBar(targetBar, targetFill, state.hp, maxHp);
      if (w.spear.held !== last.held) {
        spear.dataset.i18n = w.spear.held ? 'hud.spear_held' : 'hud.spear_thrown';
        spear.textContent = t(spear.dataset.i18n);
        spear.classList.toggle('away', !w.spear.held);
      }
      const near = nearestInteractable(w, map);
      const text = !near
        ? ''
        : near.kind === 'pickup'
          ? t('prompt.herb')
          : t('prompt.skin', { name: t(`creature.${w.creatures[near.index].kind}`) });
      if (text !== last.prompt) {
        prompt.hidden = !text;
        prompt.textContent = text;
      }
      if (w.inventory.poultice !== last.poultice)
        bag.textContent = t('hud.bag', { n: w.inventory.poultice });
      last = {
        hp: w.playerHp,
        target: focus,
        targetHp: focus === last.target ? state.hp : -1,
        held: w.spear.held,
        engaged,
        prompt: text,
        poultice: w.inventory.poultice,
      };
    },

    /** Forces a full redraw (after a restart). */
    reset() {
      last = { ...last, hp: -1, target: -1, targetHp: -1, held: null, prompt: '-', poultice: -1 };
      toasts.replaceChildren();
    },

    /** "+2 Hide" lines that fade out on their own. */
    loot(items: Partial<Inventory>) {
      for (const [id, n] of Object.entries(items)) {
        const line = document.createElement('p');
        line.className = 'hud-toast';
        line.textContent = t('hud.loot', { n, item: t(`item.${id}`) });
        toasts.append(line);
        setTimeout(() => line.remove(), 2600);
      }
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
